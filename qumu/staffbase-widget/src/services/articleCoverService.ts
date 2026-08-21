import { getQumuPostUrl } from './videoService';
import { getAccessToken } from '../../../../staffbase-widget/src/services/pingone-auth';

/**
 * On video selection:
 *   1. Calls iframely to get the thumbnail URL.
 *   2. GETs the current article from Staffbase, injects the thumbnail into the
 *      full payload, then PUTs it back — so the cover image is set immediately
 *      when "Add Video" is clicked without waiting for the user to save.
 *   3. Also hooks window.top.fetch as a safety net: if the direct call fails,
 *      the thumbnail is injected into the next article save/publish request.
 */

function topFetch(input: string, init?: RequestInit): Promise<Response> {
  try { return (window.top as Window).fetch(input, init); }
  catch { return fetch(input, init); }
}

function getTopOrigin(): string {
  try { return (window.top as Window).location.origin; } catch { return ''; }
}


function extractArticleId(): string | null {
  try {
    const topWin = window.top as Window;
    const href = topWin.location.href;
    console.info('[KrogerVideoWidget] Parent URL:', href);

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
        console.info('[KrogerVideoWidget] Article ID:', match[1]);
        return match[1];
      }
    }

    const win = topWin as any;
    const fromGlobals =
      win.__INITIAL_STATE__?.article?.id ||
      win.__INITIAL_STATE__?.content?.id ||
      win.articleData?.id               ||
      win.contentData?.id               ||
      win.__contentId__                 ||
      win.__articleId__;
    if (fromGlobals) {
      console.info('[KrogerVideoWidget] Article ID (globals):', fromGlobals);
      return String(fromGlobals);
    }
  } catch {}
  console.warn('[KrogerVideoWidget] Could not extract article ID from parent URL.');
  return null;
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

function injectThumbnailIntoPayload(payload: any, thumbUrl: string): void {
  if (!payload || typeof payload !== 'object') return;

  const imageWithType = { url: thumbUrl, type: 'image/jpeg' };
  const imageRef      = { url: thumbUrl };

  payload.thumbnail   = imageWithType;
  payload.headerImage = imageRef;
  payload.coverImage  = imageRef;
  payload.media       = { url: thumbUrl, type: 'image' };

  const contents = payload.contents;
  if (contents && typeof contents === 'object') {
    const localeLikeKeys = Object.keys(contents).filter(
      (key) => contents[key] && typeof contents[key] === 'object' && key.includes('_')
    );
    if (localeLikeKeys.length > 0) {
      localeLikeKeys.forEach((localeKey) => {
        contents[localeKey].image      = imageRef;
        contents[localeKey].feedImage  = imageRef;
        contents[localeKey].thumbnail  = imageWithType;
      });
    } else {
      contents.image       = imageRef;
      contents.feedImage   = imageRef;
      contents.thumbnail   = imageWithType;
      contents.headerImage = imageRef;
      contents.coverImage  = imageRef;
      contents.media       = { url: thumbUrl, type: 'image' };
    }
  }
}


// ── Step 2: GET article → inject thumbnail → PUT back ─────────────────────

async function directInjectArticleCover(thumbUrl: string): Promise<boolean> {
  const origin    = getTopOrigin();
  const articleId = extractArticleId();
  if (!origin || !articleId) return false;

  const endpoints = [
    `${origin}/api/articles/${articleId}`,
    `${origin}/api/v3/contents/${articleId}`,
    `${origin}/api/content/${articleId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      // 1. GET the full current article (no CSRF needed for reads)
      _widgetFetchActive = true;
      const getRes = await topFetch(endpoint);
      _widgetFetchActive = false;
      console.info('[KrogerVideoWidget] GET', endpoint.replace(origin, ''), '→', getRes.status);
      if (!getRes.ok) continue;

      // Log all response headers — helps find where the CSRF / auth token lives
      const respHeaders: Record<string, string> = {};
      getRes.headers.forEach((v, k) => { respHeaders[k] = v; });

      // Pull any CSRF token Staffbase might return in the response
      const csrfToken =
        getRes.headers.get('X-CSRF-Token')  ||
        getRes.headers.get('X-XSRF-TOKEN')  ||
        getRes.headers.get('csrf-token')    ||
        null;

      const article = await getRes.json();
      console.info('[KrogerVideoWidget] Article keys:', Object.keys(article));

      // 2. Inject thumbnail into the full article payload
      injectThumbnailIntoPayload(article, thumbUrl);

      // 3. PUT the full updated payload back
      const putHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        putHeaders['X-CSRF-Token'] = csrfToken;
        putHeaders['X-XSRF-TOKEN'] = csrfToken;
        console.info('[KrogerVideoWidget] Using CSRF from GET response:', csrfToken);
      }

      const putRes = await topFetch(endpoint, {
        method: 'PUT',
        headers: putHeaders,
        body: JSON.stringify(article),
      });
      console.info('[KrogerVideoWidget] PUT', endpoint.replace(origin, ''), '→', putRes.status);

      if (putRes.ok) {
        console.info('[KrogerVideoWidget] Article cover image set directly:', thumbUrl);
        return true;
      }

      // Log PUT response body on failure for diagnostics
      try {
        const errBody = await putRes.text();
        console.warn('[KrogerVideoWidget] PUT error body:', errBody);
      } catch {}

    } catch (e) {
      _widgetFetchActive = false;
      console.warn('[KrogerVideoWidget] Error with', endpoint.replace(origin, ''), e);
    }
  }

  console.warn('[KrogerVideoWidget] Direct injection failed — thumbnail will be injected on next article save.');
  return false;
}

// ── Captured article ID (populated by GET intercept on Save Draft) ────────

export let capturedDraftArticleId: string | null = null;
let _widgetFetchActive = false;

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

// ── Step 3: hook window.top.fetch (safety net on save) ────────────────────

function hookTopFetch(thumbUrl: string, qumuThumbUrl?: string): void {
  let topWin: Window;
  try { topWin = window.top as Window; } catch { return; }

  const origin        = getTopOrigin();
  const originalFetch = (topWin as any).fetch.bind(topWin);
  const OrigXHR       = (topWin as any).XMLHttpRequest;
  let hooksRestored   = false;
  let restoreTimer: ReturnType<typeof setTimeout> | null = null;

  function restoreHooks(reason: string): void {
    if (hooksRestored) return;
    hooksRestored = true;
    if (restoreTimer !== null) {
      clearTimeout(restoreTimer);
      restoreTimer = null;
    }
    (topWin as any).fetch = originalFetch;
    (topWin as any).XMLHttpRequest = OrigXHR;
    console.info('[KrogerVideoWidget] Fetch/XHR hooks removed (' + reason + ').');
  }

  restoreTimer = setTimeout(() => {
    restoreHooks('timeout');
  }, 600000);

  (topWin as any).fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = (init?.method || 'GET').toUpperCase();

    const isMutating =
      url.startsWith(origin) &&
      (method === 'PATCH' || method === 'PUT' || method === 'POST') &&
      typeof init?.body === 'string';

    if (isMutating) {
      try {
        const body = JSON.parse(init!.body as string);

        const isArticleSave =
          url.includes('/api/articles/')    ||
          url.includes('/api/v3/contents/') ||
          url.includes('/api/content/')     ||
          url.includes('/api/news/')        ||
          url.includes('/api/posts/')       ||
          url.includes('/api/plugin/news/');

        if (isArticleSave) {
          console.info('[KrogerVideoWidget] Article save intercepted:', method, url.replace(origin, ''));
          const hasTitle = hasTitleInPayload(body);
          if (!hasTitle) {
            console.info('[KrogerVideoWidget] Skipping — no title in payload (autosave).');
          } else {
            injectThumbnailIntoPayload(body, thumbUrl);
            const patched = { ...init, body: JSON.stringify(body) };
            console.info('[KrogerVideoWidget] Thumbnail injected into save payload:', thumbUrl);
            restoreHooks('fetch-success');
            return originalFetch(input, patched);
          }
        }
      } catch (e) {
        console.warn('[KrogerVideoWidget] Could not parse body:', e);
      }
    }

    return originalFetch(input, init);
  };

  console.info('[KrogerVideoWidget] Fetch hook installed (safety net for article save).');

  // XHR hook for Staffbase environments that use XHR instead of fetch
  (topWin as any).XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    const originalOpen = xhr.open.bind(xhr);
    const originalSend = xhr.send.bind(xhr);
    let _method = '';
    let _url    = '';

    xhr.open = function (method: string, url: string, ...rest: any[]) {
      _method = method.toUpperCase();
      _url    = url;
      return originalOpen(method, url, ...rest);
    };

    xhr.send = function (body: any) {
      if (_method === 'GET' && _url.startsWith(origin) && !_widgetFetchActive) {
        const id = extractIdFromUrl(_url, origin);
        if (id) {
          capturedDraftArticleId = id;
          console.info('[KrogerVideoWidget] Draft article ID captured from XHR GET:', id);
          const putUrl   = getQumuPostUrl(id);
          const imageUrl = qumuThumbUrl || thumbUrl;
          (async () => {
            try {
              const payload = {
                contents: { en_US: { image: imageUrl, teaser: 'This teaser should be text only.' } },
                notificationChannels: ['email', 'push'],
              };
              const putRes = await originalFetch(putUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Origin': origin,
                  'Authorization': `Bearer ${await getAccessToken()}`,
                },
                credentials: 'include',
                body: JSON.stringify(payload),
              });
              console.info('[KrogerVideoWidget] PUT /api/posts/ →', putRes.status);
              if (!putRes.ok) {
                const errBody = await putRes.text().catch(() => '');
                console.warn('[KrogerVideoWidget] PUT /api/posts/ error body:', errBody);
              } else {
                restoreHooks('xhr-put-success');
              }
            } catch (e) {
              console.warn('[KrogerVideoWidget] PUT /api/posts/ failed:', e);
            }
          })();
        }
      }
      if (_url.startsWith(origin) && (_method === 'PATCH' || _method === 'PUT' || _method === 'POST')) {
        if (typeof body === 'string') {
          try {
            const parsed = JSON.parse(body);
            const isArticleSave =
              _url.includes('/api/articles/')    ||
              _url.includes('/api/v3/contents/') ||
              _url.includes('/api/content/')     ||
              _url.includes('/api/news/')        ||
              _url.includes('/api/posts/');
            if (isArticleSave && hasTitleInPayload(parsed)) {
              injectThumbnailIntoPayload(parsed, thumbUrl);
              console.info('[KrogerVideoWidget] XHR thumbnail injected:', thumbUrl);
              restoreHooks('xhr-save-success');
              return originalSend(JSON.stringify(parsed));
            }
          } catch {}
        }
      }
      return originalSend(body);
    };
    return xhr;
  };
}

// ── Public entry point ─────────────────────────────────────────────────────

export function injectArticleCoverImage(videoUrl: string, fallbackThumbnailUrl?: string): void {
  if (!getTopOrigin() || !videoUrl) return;

  console.info('[KrogerVideoWidget] Starting cover image injection for video:', videoUrl);

  const thumbUrl = fallbackThumbnailUrl;

  if (thumbUrl) {
    console.info('[KrogerVideoWidget] Using thumbnail URL:', thumbUrl);
    // Try immediate injection via GET → PUT; fall back to hook on Save Draft.
    directInjectArticleCover(thumbUrl).then((ok) => {
      if (!ok) hookTopFetch(thumbUrl, fallbackThumbnailUrl);
    });
  } else {
    // No thumbnail selected — still install the hook so the PUT is made on Save Draft.
    console.warn('[KrogerVideoWidget] No thumbnail — hook installed to fire PUT on Save Draft.');
    hookTopFetch('', undefined);
  }
}
