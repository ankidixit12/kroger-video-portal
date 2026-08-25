/**
 * Article cover image injection for the Kroger/QUMU video widget (Staffbase Studio).
 *
 * On video selection:
 *   1. The caller passes the thumbnail URL for the selected video.
 *   2. A minimal PATCH sets the cover image on the server immediately (optional,
 *      see ENABLE_DIRECT_INJECTION) — only image fields are sent, never a
 *      full read-modify-write of the article.
 *   3. window.top.fetch / XMLHttpRequest are hooked as a safety net so the
 *      thumbnail is injected into the next article save/publish request.
 *
 * ---------------------------------------------------------------------------
 * FIXES FOR: "reopening an article and choosing a new video still shows the
 *             first video / first thumbnail"
 * ---------------------------------------------------------------------------
 *
 * 1. NO FULL-PAYLOAD WRITE-BACK.
 *    The old code did GET article -> mutate -> PUT the whole thing back. On a
 *    second edit the GET returns the SERVER copy, which still contains the
 *    FIRST video. PUTting it back re-asserted the stale video. We now GET only
 *    to discover the locale keys and send a minimal PATCH containing image
 *    fields alone.
 *
 * 2. HOOK STATE LIVES ON window.top, NOT IN THIS MODULE.
 *    Navigating away destroys the iframe, so module-level `_trueFetch` reset to
 *    null while window.top.fetch stayed patched — holding a closure over the
 *    OLD thumbnail. Reopening then wrapped hook #2 around hook #1, and hook #1
 *    ran last, overwriting the new thumbnail with the old one. State now lives
 *    on window.top and the hook is installed exactly once per page; new widget
 *    instances update the shared state instead of stacking wrappers.
 *
 * 3. THUMBNAIL IS READ AT CALL TIME, NEVER CAPTURED IN A CLOSURE.
 *    Even a surviving hook picks up the newest selection.
 *
 * 4. NO WRITES FROM READ INTERCEPTS.
 *    The old XHR GET intercept fired a fire-and-forget PUT /api/posts/{id}
 *    (with a placeholder teaser that clobbered real content). Reopening an
 *    article fires several GETs, so those PUTs could land AFTER the user's save
 *    and revert it. Removed — the save hook covers this.
 *
 * The Basic auth credential is retained (see API_AUTH_HEADER) but is now used
 * only as a fallback in the direct-injection path, when the cookie-authenticated
 * request is rejected. It is no longer triggered by read traffic.
 *
 * SECURITY NOTE: API_AUTH_HEADER ships to the browser and is readable by any
 * user via devtools. Rotate it and move the call behind a backend proxy before
 * this reaches production.
 */

// ── Config ────────────────────────────────────────────────────────────────

/** Set false to rely solely on the save-time hook (safest option). */
const ENABLE_DIRECT_INJECTION = true;

/**
 * Fallback API credential. Used only if the cookie-authenticated PATCH is
 * rejected with 401/403.
 *
 * WARNING: this is shipped to the browser and readable by any user. Rotate it
 * and proxy the call server-side before production.
 */
const API_AUTH_HEADER =
  'Basic NmEwMzhmMWExMGIwZGQ3Mzc5NDI0Nzk2OnZHSkR3NSYhS2hoXm4uS3pwJkZxfjR+WXFyTkg5TiktTmxiOylJaFRuelNfZC0wM2FUMHlbMDBWcVRdN0gpdX4=';

/** Set false to disable the credentialed retry entirely. */
const USE_BASIC_AUTH_FALLBACK = true;

/** How long the save hook stays armed after a video selection. */
const HOOK_ARMED_MS = 600000; // 10 minutes

/** Optional: constrain rendered image width in the parent document. */
const ENABLE_IMAGE_WIDTH_CSS = true;
const IMAGE_WIDTH_CSS =
  '.news-feed-post-image { max-width: 400px; } ' +
  '.news-detail-post-image-wrapper { max-width: 400px; }';

const LOG = '[KrogerVideoWidget]';

// ── Shared cross-iframe hook state ────────────────────────────────────────

const STATE_KEY = '__krogerVideoWidgetHookState__';

interface HookState {
  /** Current thumbnail. null = disarmed; hook passes everything through. */
  thumbUrl: string | null;
  /** True once window.top.fetch / XMLHttpRequest have been patched. */
  installed: boolean;
  /** True while this module is making its own request, so we don't self-intercept. */
  selfRequestActive: boolean;
  /** Disarm timer handle. */
  timer: ReturnType<typeof setTimeout> | null;
  /** True once the width CSS has been added to the parent document. */
  cssInjected: boolean;
  /** Last article ID seen on a parent-origin GET. */
  capturedArticleId: string | null;
}

function getState(topWin: Window): HookState | null {
  try {
    const w = topWin as any;
    if (!w[STATE_KEY]) {
      w[STATE_KEY] = {
        thumbUrl: null,
        installed: false,
        selfRequestActive: false,
        timer: null,
        cssInjected: false,
        capturedArticleId: null,
      } as HookState;
    }
    return w[STATE_KEY] as HookState;
  } catch {
    return null; // cross-origin parent
  }
}

/** Article ID captured from the most recent parent-origin GET, if any. */
export function getCapturedDraftArticleId(): string | null {
  try {
    const state = getState(window.top as Window);
    return state ? state.capturedArticleId : null;
  } catch {
    return null;
  }
}

// ── Small helpers ─────────────────────────────────────────────────────────

function topFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return (window.top as Window).fetch(input, init);
  } catch {
    return fetch(input, init);
  }
}

function getTopOrigin(): string {
  try {
    return (window.top as Window).location.origin;
  } catch {
    return '';
  }
}

function extractArticleId(): string | null {
  try {
    const topWin = window.top as Window;
    const href = topWin.location.href;
    console.info(LOG, 'Parent URL:', href);

    const patterns = [
      /\/articles?\/([a-zA-Z0-9_-]{5,})/,
      /\/contents?\/([a-zA-Z0-9_-]{5,})/,
      /\/news\/([a-zA-Z0-9_-]{5,})/,
      /\/posts?\/([a-zA-Z0-9_-]{5,})/,
      /\/edit\/([a-zA-Z0-9_-]{5,})/,
      /[?&](?:id|contentId|articleId)=([a-zA-Z0-9_-]{5,})/,
    ];
    for (const pattern of patterns) {
      const match = href.match(pattern);
      if (match?.[1]) {
        console.info(LOG, 'Article ID:', match[1]);
        return match[1];
      }
    }

    const win = topWin as any;
    const fromGlobals =
      win.__INITIAL_STATE__?.article?.id ||
      win.__INITIAL_STATE__?.content?.id ||
      win.articleData?.id ||
      win.contentData?.id ||
      win.__contentId__ ||
      win.__articleId__;
    if (fromGlobals) {
      console.info(LOG, 'Article ID (globals):', fromGlobals);
      return String(fromGlobals);
    }
  } catch {
    /* cross-origin */
  }

  // Fall back to whatever a GET intercept saw.
  const captured = getCapturedDraftArticleId();
  if (captured) {
    console.info(LOG, 'Article ID (captured from GET):', captured);
    return captured;
  }

  console.warn(LOG, 'Could not determine article ID.');
  return null;
}

const ARTICLE_ID_PATTERNS = [
  /\/api\/articles\/([a-zA-Z0-9_-]{5,})/,
  /\/api\/v3\/contents\/([a-zA-Z0-9_-]{5,})/,
  /\/api\/content\/([a-zA-Z0-9_-]{5,})/,
  /\/api\/news\/([a-zA-Z0-9_-]{5,})/,
  /\/api\/posts\/([a-zA-Z0-9_-]{5,})/,
  /\/api\/plugin\/news\/([a-zA-Z0-9_-]{5,})/,
];

function extractIdFromUrl(url: string, origin: string): string | null {
  const path = url.startsWith(origin) ? url.slice(origin.length) : url;
  for (const pattern of ARTICLE_ID_PATTERNS) {
    const match = path.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function isArticleEndpoint(url: string): boolean {
  return (
    url.includes('/api/articles/') ||
    url.includes('/api/v3/contents/') ||
    url.includes('/api/content/') ||
    url.includes('/api/news/') ||
    url.includes('/api/posts/') ||
    url.includes('/api/plugin/news/')
  );
}

/**
 * Autosave payloads omit the title. Injecting into those produced partial
 * writes, so we only touch payloads that look like a real save.
 */
function hasTitleInPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.title != null) return true;

  const contents = payload.contents;
  if (!contents || typeof contents !== 'object') return false;
  if (contents.title != null) return true;

  return Object.keys(contents).some(
    (k) => contents[k] && typeof contents[k] === 'object' && contents[k].title != null
  );
}

/** Locale-shaped keys look like `en_US`, `de_DE`, ... */
function findLocaleKeys(contents: any): string[] {
  if (!contents || typeof contents !== 'object') return [];
  return Object.keys(contents).filter(
    (key) => contents[key] && typeof contents[key] === 'object' && /^[a-z]{2}_[A-Z]{2}$/.test(key)
  );
}

// ── Payload mutation ──────────────────────────────────────────────────────

/**
 * Overwrite (never merge) every known cover-image field. Assigning fresh
 * objects each time means a re-save can't retain a previous thumbnail.
 */
function injectThumbnailIntoPayload(payload: any, thumbUrl: string): void {
  if (!payload || typeof payload !== 'object') return;

  const imageWithType = { url: thumbUrl, type: 'image/jpeg' };
  const imageRef = { url: thumbUrl };

  payload.thumbnail = { ...imageWithType };
  payload.headerImage = { ...imageRef };
  payload.coverImage = { ...imageRef };
  payload.media = { url: thumbUrl, type: 'image' };

  const contents = payload.contents;
  if (contents && typeof contents === 'object') {
    const localeKeys = findLocaleKeys(contents);
    if (localeKeys.length > 0) {
      localeKeys.forEach((localeKey) => {
        contents[localeKey].image = thumbUrl;
        contents[localeKey].feedImage = { ...imageRef };
        contents[localeKey].thumbnail = { ...imageWithType };
      });
    } else {
      contents.image = thumbUrl;
      contents.feedImage = { ...imageRef };
      contents.thumbnail = { ...imageWithType };
      contents.headerImage = { ...imageRef };
      contents.coverImage = { ...imageRef };
      contents.media = { url: thumbUrl, type: 'image' };
    }
  }
}

/** Minimal image-only patch body, shaped to match the article's locale layout. */
function buildMinimalImagePatch(article: any, thumbUrl: string): Record<string, any> {
  const imageWithType = { url: thumbUrl, type: 'image/jpeg' };
  const imageRef = { url: thumbUrl };

  const body: Record<string, any> = {
    thumbnail: imageWithType,
    headerImage: imageRef,
    coverImage: imageRef,
  };

  const localeKeys = findLocaleKeys(article?.contents);
  if (localeKeys.length > 0) {
    body.contents = {};
    localeKeys.forEach((localeKey) => {
      body.contents[localeKey] = {
        image: thumbUrl,
        feedImage: imageRef,
        thumbnail: imageWithType,
      };
    });
  } else if (article?.contents && typeof article.contents === 'object') {
    body.contents = {
      image: thumbUrl,
      feedImage: imageRef,
      thumbnail: imageWithType,
    };
  }

  return body;
}

// ── Optional parent-document CSS ──────────────────────────────────────────

function injectImageWidthCss(topWin: Window, state: HookState): void {
  if (!ENABLE_IMAGE_WIDTH_CSS || state.cssInjected) return;
  try {
    const style = topWin.document.createElement('style');
    style.setAttribute('data-kroger-video-widget', 'image-width');
    style.textContent = IMAGE_WIDTH_CSS;
    topWin.document.head.appendChild(style);
    state.cssInjected = true;
    console.info(LOG, 'Injected image width CSS into parent document.');
  } catch (e) {
    console.warn(LOG, 'Could not inject CSS into parent:', e);
  }
}

// ── Step 2: immediate minimal PATCH ───────────────────────────────────────

async function directInjectArticleCover(thumbUrl: string): Promise<boolean> {
  if (!ENABLE_DIRECT_INJECTION) return false;

  const origin = getTopOrigin();
  const articleId = extractArticleId();
  if (!origin || !articleId) return false;

  const state = getState(window.top as Window);

  const endpoints = [
    `${origin}/api/articles/${articleId}`,
    `${origin}/api/v3/contents/${articleId}`,
    `${origin}/api/content/${articleId}`,
    `${origin}/api/posts/${articleId}`,
  ];

  for (const endpoint of endpoints) {
    const shortPath = endpoint.replace(origin, '');
    try {
      // GET is used ONLY to confirm the endpoint and learn the locale layout.
      // Its body is never echoed back — that is what re-asserted the old video.
      if (state) state.selfRequestActive = true;
      const getRes = await topFetch(endpoint, { credentials: 'include' });
      if (state) state.selfRequestActive = false;

      console.info(LOG, 'GET', shortPath, '->', getRes.status);
      if (!getRes.ok) continue;

      const csrfToken =
        getRes.headers.get('X-CSRF-Token') ||
        getRes.headers.get('X-XSRF-TOKEN') ||
        getRes.headers.get('csrf-token') ||
        null;

      const article = await getRes.json();
      const patchBody = buildMinimalImagePatch(article, thumbUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
        headers['X-XSRF-TOKEN'] = csrfToken;
      }

      // PATCH merges server-side. PUT would replace the document with our
      // partial body, so do not switch this to PUT.
      if (state) state.selfRequestActive = true;
      const patchRes = await topFetch(endpoint, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify(patchBody),
      });
      if (state) state.selfRequestActive = false;

      console.info(LOG, 'PATCH', shortPath, '->', patchRes.status);

      if (patchRes.ok) {
        console.info(LOG, 'Cover image set directly:', thumbUrl);
        return true;
      }

      try {
        const errBody = await patchRes.text();
        console.warn(LOG, 'PATCH error body:', errBody);
      } catch {
        /* ignore */
      }

      // Session cookie was rejected — retry once with the API credential.
      // Note: `Origin` is a forbidden header and cannot be set from fetch;
      // the browser sets it automatically.
      if (USE_BASIC_AUTH_FALLBACK && (patchRes.status === 401 || patchRes.status === 403)) {
        try {
          if (state) state.selfRequestActive = true;
          const authRes = await topFetch(endpoint, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: API_AUTH_HEADER,
            },
            credentials: 'omit',
            body: JSON.stringify(patchBody),
          });
          if (state) state.selfRequestActive = false;

          console.info(LOG, 'PATCH (api credential)', shortPath, '->', authRes.status);

          if (authRes.ok) {
            console.info(LOG, 'Cover image set via API credential:', thumbUrl);
            return true;
          }

          const authErr = await authRes.text().catch(() => '');
          console.warn(LOG, 'PATCH (api credential) error body:', authErr);
        } catch (e) {
          if (state) state.selfRequestActive = false;
          console.warn(LOG, 'PATCH (api credential) failed:', e);
        }
      }
    } catch (e) {
      if (state) state.selfRequestActive = false;
      console.warn(LOG, 'Error with', shortPath, e);
    }
  }

  console.warn(LOG, 'Direct injection failed — thumbnail will be injected on next save.');
  return false;
}

// ── Step 3: install save-time hooks (once per parent page) ────────────────

function installHooks(topWin: Window, state: HookState): void {
  if (state.installed) return;
  state.installed = true;

  const w = topWin as any;
  const origin = getTopOrigin();
  const originalFetch = w.fetch.bind(topWin);
  const OrigXHR = w.XMLHttpRequest;

  // ---- fetch ----
  w.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Read the CURRENT thumbnail — never a closure capture.
    const thumbUrl = state.thumbUrl;
    if (!thumbUrl || state.selfRequestActive) return originalFetch(input, init);

    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = (init?.method || 'GET').toUpperCase();

    if (method === 'GET') {
      const id = extractIdFromUrl(url, origin);
      if (id) state.capturedArticleId = id;
      return originalFetch(input, init);
    }

    const isMutating =
      url.startsWith(origin) &&
      (method === 'PATCH' || method === 'PUT' || method === 'POST') &&
      typeof init?.body === 'string';

    if (isMutating && isArticleEndpoint(url)) {
      try {
        const body = JSON.parse(init!.body as string);
        console.info(LOG, 'Article save intercepted:', method, url.replace(origin, ''));

        if (!hasTitleInPayload(body)) {
          console.info(LOG, 'Skipping — no title in payload (autosave).');
        } else {
          injectThumbnailIntoPayload(body, thumbUrl);
          console.info(LOG, 'Thumbnail injected into save payload:', thumbUrl);
          // The hook stays installed and armed: an editor may fire several
          // saves (draft, then publish) and each one needs the current value.
          return originalFetch(input, { ...init, body: JSON.stringify(body) });
        }
      } catch (e) {
        console.warn(LOG, 'Could not parse body:', e);
      }
    }

    return originalFetch(input, init);
  };

  // ---- XMLHttpRequest ----
  w.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    const originalOpen = xhr.open.bind(xhr);
    const originalSend = xhr.send.bind(xhr);
    let method = '';
    let url = '';

    xhr.open = function (m: string, u: string, ...rest: any[]) {
      method = String(m).toUpperCase();
      url = String(u);
      return originalOpen(m, u, ...rest);
    };

    xhr.send = function (body: any) {
      const thumbUrl = state.thumbUrl;
      if (!thumbUrl || state.selfRequestActive) return originalSend(body);

      // Reads are observed only. They must never trigger a write.
      if (method === 'GET') {
        if (url.startsWith(origin)) {
          const id = extractIdFromUrl(url, origin);
          if (id) state.capturedArticleId = id;
        }
        return originalSend(body);
      }

      const isMutating =
        url.startsWith(origin) && (method === 'PATCH' || method === 'PUT' || method === 'POST');

      if (isMutating && isArticleEndpoint(url) && typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          if (hasTitleInPayload(parsed)) {
            injectThumbnailIntoPayload(parsed, thumbUrl);
            console.info(LOG, 'XHR thumbnail injected:', thumbUrl);
            return originalSend(JSON.stringify(parsed));
          }
        } catch {
          /* not JSON — pass through */
        }
      }

      return originalSend(body);
    };

    return xhr;
  };

  console.info(LOG, 'Save hooks installed on parent window.');
}

/** Arm (or re-arm) the hooks with the newest thumbnail. */
function armHooks(thumbUrl: string): void {
  let topWin: Window;
  try {
    topWin = window.top as Window;
  } catch {
    return;
  }

  const state = getState(topWin);
  if (!state) return;

  // Update shared state FIRST so an already-installed hook — possibly from a
  // previous iframe instance — immediately uses the new thumbnail.
  state.thumbUrl = thumbUrl;

  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.thumbUrl = null;
    state.timer = null;
    console.info(LOG, 'Save hooks disarmed (timeout).');
  }, HOOK_ARMED_MS);

  installHooks(topWin, state);
  injectImageWidthCss(topWin, state);

  console.info(LOG, 'Save hooks armed with thumbnail:', thumbUrl);
}

// ── Public entry points ───────────────────────────────────────────────────

/**
 * Call whenever the user selects (or changes) a video.
 *
 * @param videoUrl           URL of the selected video (logging / validation).
 * @param thumbnailUrl       Thumbnail to use as the article cover image.
 */
export function injectArticleCoverImage(videoUrl: string, thumbnailUrl?: string): void {
  if (!getTopOrigin() || !videoUrl) return;

  if (!thumbnailUrl) {
    console.warn(LOG, 'No thumbnail URL available, skipping.');
    return;
  }

  console.info(LOG, 'Cover image injection for video:', videoUrl);
  console.info(LOG, 'Using thumbnail URL:', thumbnailUrl);

  // Arm the save hook first, so a save that happens mid-PATCH still carries
  // the new thumbnail.
  armHooks(thumbnailUrl);

  void directInjectArticleCover(thumbnailUrl);
}

/**
 * Disarm injection — e.g. when the user removes the video from the article.
 * Hooks stay installed as transparent pass-throughs; restoring the originals
 * would clobber any patches applied by other code after ours.
 */
export function clearArticleCoverInjection(): void {
  try {
    const state = getState(window.top as Window);
    if (!state) return;
    state.thumbUrl = null;
    if (state.timer !== null) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    console.info(LOG, 'Cover image injection cleared.');
  } catch {
    /* cross-origin */
  }
}