/**
 * Article cover image injection for the Kroger/QUMU video widget (Staffbase Studio).
 *
 * FLOW
 *   1. Widget calls injectArticleCoverImage(videoUrl, thumbnailUrl) on selection.
 *   2. Hooks are armed with the new thumbnail and a fresh selection token.
 *   3. Optional immediate PATCH sets the cover right away.
 *   4. Save hooks watch parent traffic. When an article save SUCCEEDS, a
 *      PUT /api/posts/{id} runs AFTERWARDS to set the image.
 *
 * ---------------------------------------------------------------------------
 * WHY THE PUT IS A POST-SAVE STEP, NOT A GET INTERCEPT
 * ---------------------------------------------------------------------------
 * The original code fired PUT /api/posts/{id} from inside the XHR GET
 * intercept. Reopening an article fires several GETs, so those PUTs raced the
 * editor's own save — sometimes landing before it and being overwritten,
 * sometimes after. That is the stale-thumbnail bug.
 *
 * Now: the save is allowed through untouched, and only once its response comes
 * back OK do we PUT the image. Writing last means we win.
 *
 * ---------------------------------------------------------------------------
 * KEEPING THUMBNAIL IN SYNC WITH THE SELECTED VIDEO
 * ---------------------------------------------------------------------------
 *   - Shared state on window.top survives iframe teardown, so a hook installed
 *     by a previous instance still reads the CURRENT thumbnail.
 *   - Every selection increments `selectionToken`. An in-flight PUT whose token
 *     no longer matches is abandoned, so a slow request from video #1 can never
 *     land on top of video #2.
 *   - The save-payload injection is best-effort; the post-save PUT is the
 *     authoritative write and does NOT depend on the payload containing a title
 *     (Save Draft may send a partial payload).
 *
 * SECURITY NOTE: API_AUTH_HEADER ships to the browser and is readable by any
 * user via devtools. Rotate it and proxy the call server-side before this
 * reaches production.
 */

// ── Config ────────────────────────────────────────────────────────────────

/** Immediate PATCH on selection, before any save. */
const ENABLE_DIRECT_INJECTION = true;

/** PUT /api/posts/{id} after a successful article save. This is the main path. */
const ENABLE_POST_SAVE_SYNC = true;

/**
 * Fallback API credential, used when the cookie-authenticated request is
 * rejected (401/403).
 *
 * WARNING: shipped to the browser, readable by any user. Rotate + proxy.
 */
const API_AUTH_HEADER =
  'Basic NmEwMzhmMWExMGIwZGQ3Mzc5NDI0Nzk2OnZHSkR3NSYhS2hoXm4uS3pwJkZxfjR+WXFyTkg5TiktTmxiOylJaFRuelNfZC0wM2FUMHlbMDBWcVRdN0gpdX4=';

const USE_BASIC_AUTH_FALLBACK = true;

/**
 * Send notificationChannels on the post-save PUT.
 * OFF by default: including this on a draft can trigger real email/push sends.
 * Only turn it on if you have confirmed the API ignores it for drafts.
 */
const SEND_NOTIFICATION_CHANNELS = false;
const NOTIFICATION_CHANNELS = ['email', 'push'];

/** Locale used when the article's locale layout is unknown. */
const DEFAULT_LOCALE = 'en_US';

/** Wait after a save response before writing, to let the server settle. */
const POST_SAVE_DELAY_MS = 350;

/** Collapse a burst of saves into one write. */
const SYNC_DEBOUNCE_MS = 400;

/** One retry if the write fails. */
const SYNC_RETRY_DELAY_MS = 900;

/** How long the hooks stay armed after a selection. */
const HOOK_ARMED_MS = 600000; // 10 min

/** Log the post's image field after writing, to confirm what stuck. */
const VERIFY_AFTER_SYNC = true;

const ENABLE_IMAGE_WIDTH_CSS = true;
const IMAGE_WIDTH_CSS =
  '.news-feed-post-image { max-width: 400px; } ' +
  '.news-detail-post-image-wrapper { max-width: 400px; }';

const LOG = '[KrogerVideoWidget]';

// ── Shared cross-iframe state ─────────────────────────────────────────────

const STATE_KEY = '__krogerVideoWidgetHookState__';

interface HookState {
  /** Thumbnail for the currently selected video. null = disarmed. */
  thumbUrl: string | null;
  /** Currently selected video, for logging and sanity checks. */
  videoUrl: string | null;
  /** Bumped on every selection. Stale async work compares against this. */
  selectionToken: number;
  installed: boolean;
  /** Suppresses self-interception while this module issues its own requests. */
  selfRequestActive: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  syncTimer: ReturnType<typeof setTimeout> | null;
  cssInjected: boolean;
  /** Article ID, from the URL or from observed traffic. */
  articleId: string | null;
  /** Locale keys learned from a GET, e.g. ['en_US']. */
  localeKeys: string[] | null;
  /** Thumbnail last written successfully, to skip redundant writes. */
  lastSyncedThumb: string | null;
}

function getState(topWin: Window): HookState | null {
  try {
    const w = topWin as any;
    if (!w[STATE_KEY]) {
      w[STATE_KEY] = {
        thumbUrl: null,
        videoUrl: null,
        selectionToken: 0,
        installed: false,
        selfRequestActive: false,
        timer: null,
        syncTimer: null,
        cssInjected: false,
        articleId: null,
        localeKeys: null,
        lastSyncedThumb: null,
      } as HookState;
    }
    return w[STATE_KEY] as HookState;
  } catch {
    return null; // cross-origin parent
  }
}

function currentState(): HookState | null {
  try {
    return getState(window.top as Window);
  } catch {
    return null;
  }
}

/** Article ID resolved from the URL or observed traffic. */
export function getCapturedDraftArticleId(): string | null {
  const state = currentState();
  return state ? state.articleId : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

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

function extractArticleIdFromLocation(): string | null {
  try {
    const href = (window.top as Window).location.href;
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
      if (match?.[1]) return match[1];
    }

    const win = window.top as any;
    const fromGlobals =
      win.__INITIAL_STATE__?.article?.id ||
      win.__INITIAL_STATE__?.content?.id ||
      win.articleData?.id ||
      win.contentData?.id ||
      win.__contentId__ ||
      win.__articleId__;
    if (fromGlobals) return String(fromGlobals);
  } catch {
    /* cross-origin */
  }
  return null;
}

/** Prefer an ID seen in traffic — on a brand-new draft the URL has none yet. */
function resolveArticleId(state: HookState | null): string | null {
  if (state?.articleId) return state.articleId;
  const fromLocation = extractArticleIdFromLocation();
  if (fromLocation && state) state.articleId = fromLocation;
  return fromLocation;
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

function rememberLocaleKeys(state: HookState | null, payload: any): void {
  if (!state) return;
  const keys = findLocaleKeys(payload?.contents);
  if (keys.length > 0) state.localeKeys = keys;
}

function localesFor(state: HookState | null): string[] {
  return state?.localeKeys?.length ? state.localeKeys : [DEFAULT_LOCALE];
}

// ── Payload mutation (best-effort, on the save request itself) ─────────────

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

// ── Authoritative write: PUT /api/posts/{id} ──────────────────────────────

/**
 * Body shape matches the call that was verified working against Staffbase:
 * contents[locale].image as a plain URL string.
 * The teaser is deliberately NOT sent — the old code overwrote it with
 * placeholder text on every save.
 */
function buildPostImageBody(state: HookState | null, thumbUrl: string): Record<string, any> {
  const contents: Record<string, any> = {};
  localesFor(state).forEach((locale) => {
    contents[locale] = { image: thumbUrl };
  });

  const body: Record<string, any> = { contents };
  if (SEND_NOTIFICATION_CHANNELS) body.notificationChannels = NOTIFICATION_CHANNELS;
  return body;
}

async function putWithAuthFallback(
  url: string,
  body: Record<string, any>,
  state: HookState | null,
  label: string
): Promise<boolean> {
  const payload = JSON.stringify(body);

  // Attempt 1 — the editor's own session.
  try {
    if (state) state.selfRequestActive = true;
    const res = await topFetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: payload,
    });
    if (state) state.selfRequestActive = false;

    console.info(LOG, label, 'PUT (session) ->', res.status);
    if (res.ok) return true;

    const errBody = await res.text().catch(() => '');
    console.warn(LOG, label, 'PUT (session) error body:', errBody);

    if (!USE_BASIC_AUTH_FALLBACK || (res.status !== 401 && res.status !== 403)) return false;
  } catch (e) {
    if (state) state.selfRequestActive = false;
    console.warn(LOG, label, 'PUT (session) failed:', e);
    if (!USE_BASIC_AUTH_FALLBACK) return false;
  }

  // Attempt 2 — API credential.
  // `Origin` is a forbidden header and cannot be set from fetch; the browser
  // supplies it. Setting it in code was a no-op.
  try {
    if (state) state.selfRequestActive = true;
    const res = await topFetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: API_AUTH_HEADER,
      },
      credentials: 'omit',
      body: payload,
    });
    if (state) state.selfRequestActive = false;

    console.info(LOG, label, 'PUT (api credential) ->', res.status);
    if (res.ok) return true;

    const errBody = await res.text().catch(() => '');
    console.warn(LOG, label, 'PUT (api credential) error body:', errBody);
  } catch (e) {
    if (state) state.selfRequestActive = false;
    console.warn(LOG, label, 'PUT (api credential) failed:', e);
  }

  return false;
}

async function verifySyncedImage(origin: string, articleId: string, state: HookState | null): Promise<void> {
  if (!VERIFY_AFTER_SYNC) return;
  try {
    if (state) state.selfRequestActive = true;
    const res = await topFetch(`${origin}/api/posts/${articleId}`, { credentials: 'include' });
    if (state) state.selfRequestActive = false;
    if (!res.ok) return;

    const post = await res.json();
    rememberLocaleKeys(state, post);
    const locale = localesFor(state)[0];
    console.info(LOG, 'Verified stored image:', post?.contents?.[locale]?.image ?? '(none)');
  } catch {
    if (state) state.selfRequestActive = false;
  }
}

/** The authoritative write. Aborts if the selection changed underneath it. */
async function syncThumbnailToPost(reason: string, isRetry = false): Promise<boolean> {
  if (!ENABLE_POST_SAVE_SYNC) return false;

  const state = currentState();
  const origin = getTopOrigin();
  if (!state || !origin) return false;

  const thumbUrl = state.thumbUrl;
  const token = state.selectionToken;
  if (!thumbUrl) {
    console.info(LOG, 'Sync skipped — no armed thumbnail.');
    return false;
  }

  const articleId = resolveArticleId(state);
  if (!articleId) {
    console.warn(LOG, 'Sync skipped — no article ID yet.');
    return false;
  }

  console.info(LOG, `Syncing thumbnail (${reason}) for post ${articleId}:`, thumbUrl);
  console.info(LOG, 'Selected video:', state.videoUrl ?? '(unknown)');

  const url = `${origin}/api/posts/${articleId}`;
  const ok = await putWithAuthFallback(url, buildPostImageBody(state, thumbUrl), state, 'sync');

  // A newer video was picked while this was in flight — discard the result so
  // an older thumbnail can never be treated as current.
  if (state.selectionToken !== token) {
    console.info(LOG, 'Selection changed during sync — discarding stale result.');
    return false;
  }

  if (ok) {
    state.lastSyncedThumb = thumbUrl;
    console.info(LOG, 'Thumbnail synced to post:', thumbUrl);
    void verifySyncedImage(origin, articleId, state);
    return true;
  }

  if (!isRetry) {
    console.info(LOG, `Sync failed — retrying in ${SYNC_RETRY_DELAY_MS}ms.`);
    setTimeout(() => {
      const s = currentState();
      if (s && s.selectionToken === token) void syncThumbnailToPost(reason + ' retry', true);
    }, SYNC_RETRY_DELAY_MS);
  }

  return false;
}

/** Debounced trigger — a save burst produces one write. */
function scheduleThumbnailSync(reason: string, delayMs = SYNC_DEBOUNCE_MS): void {
  const state = currentState();
  if (!state || !state.thumbUrl) return;

  if (state.syncTimer !== null) clearTimeout(state.syncTimer);
  state.syncTimer = setTimeout(() => {
    state.syncTimer = null;
    void syncThumbnailToPost(reason);
  }, delayMs);
}

// ── Optional immediate PATCH on selection ─────────────────────────────────

async function directInjectArticleCover(thumbUrl: string): Promise<boolean> {
  if (!ENABLE_DIRECT_INJECTION) return false;

  const state = currentState();
  const origin = getTopOrigin();
  const articleId = resolveArticleId(state);
  if (!origin || !articleId) return false;

  // Learn the locale layout so later writes target the right keys.
  try {
    if (state) state.selfRequestActive = true;
    const getRes = await topFetch(`${origin}/api/posts/${articleId}`, { credentials: 'include' });
    if (state) state.selfRequestActive = false;
    if (getRes.ok) {
      const post = await getRes.json();
      rememberLocaleKeys(state, post);
      console.info(LOG, 'Locales detected:', localesFor(state).join(', '));
    }
  } catch {
    if (state) state.selfRequestActive = false;
  }

  const url = `${origin}/api/posts/${articleId}`;
  const ok = await putWithAuthFallback(url, buildPostImageBody(state, thumbUrl), state, 'immediate');
  if (ok) {
    console.info(LOG, 'Cover image set immediately:', thumbUrl);
    if (state) state.lastSyncedThumb = thumbUrl;
  } else {
    console.info(LOG, 'Immediate set failed — will sync after the next save.');
  }
  return ok;
}

// ── Parent CSS ────────────────────────────────────────────────────────────

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

// ── Save hooks (installed once per parent page) ───────────────────────────

function installHooks(topWin: Window, state: HookState): void {
  if (state.installed) return;
  state.installed = true;

  const w = topWin as any;
  const origin = getTopOrigin();
  const originalFetch = w.fetch.bind(topWin);
  const OrigXHR = w.XMLHttpRequest;

  // ---- fetch ----
  w.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (state.selfRequestActive) return originalFetch(input, init);

    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = (init?.method || 'GET').toUpperCase();

    if (!url.startsWith(origin)) return originalFetch(input, init);

    // Reads: observe the article ID only, never write.
    if (method === 'GET') {
      const id = extractIdFromUrl(url, origin);
      if (id) state.articleId = id;
      return originalFetch(input, init);
    }

    const isMutating = method === 'PATCH' || method === 'PUT' || method === 'POST';
    if (!isMutating || !isArticleEndpoint(url)) return originalFetch(input, init);

    const idFromSave = extractIdFromUrl(url, origin);
    if (idFromSave) state.articleId = idFromSave;

    console.info(LOG, 'Article save seen:', method, url.replace(origin, ''));

    let request: Promise<Response>;

    // Best-effort injection into the save body itself.
    if (state.thumbUrl && typeof init?.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        rememberLocaleKeys(state, body);

        if (hasTitleInPayload(body)) {
          injectThumbnailIntoPayload(body, state.thumbUrl);
          console.info(LOG, 'Thumbnail injected into save payload:', state.thumbUrl);
          request = originalFetch(input, { ...init, body: JSON.stringify(body) });
        } else {
          // Autosave / partial payload — leave it alone. The post-save PUT
          // below still runs, which is why draft saves now work.
          console.info(LOG, 'Partial payload (no title) — relying on post-save sync.');
          request = originalFetch(input, init);
        }
      } catch {
        request = originalFetch(input, init);
      }
    } else {
      request = originalFetch(input, init);
    }

    // The authoritative write, AFTER the save lands.
    request
      .then((res) => {
        if (res.ok && state.thumbUrl) {
          console.info(LOG, 'Save succeeded -> scheduling thumbnail sync.');
          scheduleThumbnailSync('after fetch save', POST_SAVE_DELAY_MS);
        }
      })
      .catch(() => {});

    return request;
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
      if (state.selfRequestActive || !url.startsWith(origin)) return originalSend(body);

      // Reads: observe only.
      if (method === 'GET') {
        const id = extractIdFromUrl(url, origin);
        if (id) state.articleId = id;
        return originalSend(body);
      }

      const isMutating = method === 'PATCH' || method === 'PUT' || method === 'POST';
      if (!isMutating || !isArticleEndpoint(url)) return originalSend(body);

      const idFromSave = extractIdFromUrl(url, origin);
      if (idFromSave) state.articleId = idFromSave;

      console.info(LOG, 'Article save seen (XHR):', method, url.replace(origin, ''));

      // Fire the authoritative write once this save completes.
      xhr.addEventListener('loadend', function () {
        const status = xhr.status;
        if (status >= 200 && status < 300 && state.thumbUrl) {
          console.info(LOG, 'XHR save succeeded -> scheduling thumbnail sync.');
          scheduleThumbnailSync('after XHR save', POST_SAVE_DELAY_MS);
        } else if (state.thumbUrl) {
          console.info(LOG, 'XHR save returned', status, '— no sync.');
        }
      });

      // Best-effort injection into the save body.
      if (state.thumbUrl && typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          rememberLocaleKeys(state, parsed);
          if (hasTitleInPayload(parsed)) {
            injectThumbnailIntoPayload(parsed, state.thumbUrl);
            console.info(LOG, 'XHR thumbnail injected:', state.thumbUrl);
            return originalSend(JSON.stringify(parsed));
          }
          console.info(LOG, 'Partial XHR payload (no title) — relying on post-save sync.');
        } catch {
          /* not JSON */
        }
      }

      return originalSend(body);
    };

    return xhr;
  };

  console.info(LOG, 'Save hooks installed on parent window.');
}

function armHooks(videoUrl: string, thumbUrl: string): void {
  let topWin: Window;
  try {
    topWin = window.top as Window;
  } catch {
    return;
  }

  const state = getState(topWin);
  if (!state) return;

  // Update shared state FIRST so an already-installed hook — possibly from a
  // previous iframe instance — immediately uses the new values.
  state.thumbUrl = thumbUrl;
  state.videoUrl = videoUrl;
  state.selectionToken += 1;
  state.lastSyncedThumb = null;

  if (state.syncTimer !== null) {
    clearTimeout(state.syncTimer);
    state.syncTimer = null;
  }
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.thumbUrl = null;
    state.videoUrl = null;
    state.timer = null;
    console.info(LOG, 'Save hooks disarmed (timeout).');
  }, HOOK_ARMED_MS);

  installHooks(topWin, state);
  injectImageWidthCss(topWin, state);

  console.info(LOG, 'Armed. selection #' + state.selectionToken, '| thumb:', thumbUrl);
}

// ── Public entry points ───────────────────────────────────────────────────

/**
 * Call whenever the user selects OR changes a video.
 *
 * @param videoUrl      URL of the selected video.
 * @param thumbnailUrl  Thumbnail to use as the article cover image.
 */
export function injectArticleCoverImage(videoUrl: string, thumbnailUrl?: string): void {
  if (!getTopOrigin() || !videoUrl) return;

  if (!thumbnailUrl) {
    console.warn(LOG, 'No thumbnail URL available, skipping.');
    return;
  }

  console.info(LOG, 'Video selected:', videoUrl);
  console.info(LOG, 'Thumbnail:', thumbnailUrl);

  armHooks(videoUrl, thumbnailUrl);
  void directInjectArticleCover(thumbnailUrl);
}

/** Force the write immediately — e.g. from the widget's own save handler. */
export function syncThumbnailNow(): Promise<boolean> {
  return syncThumbnailToPost('manual');
}

/** Disarm — e.g. when the video is removed from the article. */
export function clearArticleCoverInjection(): void {
  const state = currentState();
  if (!state) return;

  state.thumbUrl = null;
  state.videoUrl = null;
  state.selectionToken += 1;
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  if (state.syncTimer !== null) {
    clearTimeout(state.syncTimer);
    state.syncTimer = null;
  }
  console.info(LOG, 'Cover image injection cleared.');
}