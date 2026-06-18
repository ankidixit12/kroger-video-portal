/**
 * On video selection:
 *   1. Calls iframely (at krogertest.staffbase.com) to get the thumbnail URL
 *      for the selected YouTube video.
 *   2. Immediately PATCHes the Staffbase article API to set the cover image
 *      as soon as "Add Video" is clicked.
 *   3. Also hooks window.top.fetch as a safety net so the thumbnail is
 *      re-injected if the user saves/publishes the article afterwards.
 */

function topFetch(input: string, init?: RequestInit): Promise<Response> {
  try { return (window.top as Window).fetch(input, init); }
  catch { return fetch(input, init); }
}

function getTopOrigin(): string {
  try { return (window.top as Window).location.origin; } catch { return ''; }
}

/**
 * Extracts the article ID from the Staffbase Studio URL or parent window globals.
 * Logs the full parent URL to help diagnose ID extraction issues.
 */
function extractArticleId(): string | null {
  try {
    const topWin = window.top as Window;
    const href = topWin.location.href;
    console.info('[KrogerVideoWidget] Parent URL:', href);

    // URL patterns — ordered most-specific first
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
        console.info('[KrogerVideoWidget] Extracted article ID from URL:', match[1]);
        return match[1];
      }
    }

    // Fall back to window-level variables Staffbase may expose
    const win = topWin as any;
    const fromGlobals =
      win.__INITIAL_STATE__?.article?.id ||
      win.__INITIAL_STATE__?.content?.id ||
      win.articleData?.id               ||
      win.contentData?.id               ||
      win.__contentId__                 ||
      win.__articleId__;
    if (fromGlobals) {
      console.info('[KrogerVideoWidget] Extracted article ID from window globals:', fromGlobals);
      return String(fromGlobals);
    }
  } catch {}
  console.warn('[KrogerVideoWidget] Could not extract article ID — parent URL did not match any known pattern.');
  return null;
}

function hasTitleInPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.title != null) return true;

  const contents = payload.contents;
  if (!contents || typeof contents !== 'object') return false;
  if (contents.title != null) return true;

  return Object.values(contents).some(
    (localized: any) => localized && typeof localized === 'object' && localized.title != null
  );
}

function injectThumbnailIntoPayload(payload: any, thumbUrl: string): void {
  if (!payload || typeof payload !== 'object') return;

  const imageWithType = { url: thumbUrl, type: 'image/jpeg' };
  const imageRef = { url: thumbUrl };

  payload.thumbnail = imageWithType;
  payload.headerImage = imageRef;
  payload.coverImage = imageRef;
  payload.media = { url: thumbUrl, type: 'image' };

  const contents = payload.contents;
  if (contents && typeof contents === 'object') {
    const keys = Object.keys(contents);
    const localeLikeKeys = keys.filter(
      (key) => contents[key] && typeof contents[key] === 'object' && key.includes('_')
    );

    if (localeLikeKeys.length > 0) {
      localeLikeKeys.forEach((localeKey) => {
        contents[localeKey].image = imageRef;
        contents[localeKey].feedImage = imageRef;
        contents[localeKey].thumbnail = imageWithType;
      });
    } else {
      contents.image = imageRef;
      contents.feedImage = imageRef;
      contents.thumbnail = imageWithType;
      contents.headerImage = imageRef;
      contents.coverImage = imageRef;
      contents.media = { url: thumbUrl, type: 'image' };
    }
  }
}

// ── Step 1: iframely call ──────────────────────────────────────────────────

const HARDCODED_YOUTUBE_URL = 'https://www.youtube.com/watch?v=62XccJOh9Lg&list=RD62XccJOh9Lg&start_radio=1';

async function fetchIframelyThumbnail(): Promise<string | null> {
  try {
    const origin = getTopOrigin();
    if (!origin) return null;
    const encoded = encodeURIComponent(HARDCODED_YOUTUBE_URL);
    const endpoint = `${origin}/api/iframely?url=${encoded}&nowrap=on&callback=`;
    console.info('[KrogerVideoWidget] iframely call:', endpoint);
    const res = await topFetch(endpoint, { credentials: 'include' });
    if (!res.ok) { console.warn('[KrogerVideoWidget] iframely returned', res.status); return null; }
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); }
    catch {
      const s = text.replace(/^\s*\w+\s*\(/, '').replace(/\)\s*;?\s*$/, '');
      data = JSON.parse(s);
    }
    const thumb =
      data?.links?.thumbnail?.[0]?.href ||
      data?.links?.icon?.[0]?.href      ||
      data?.meta?.thumbnail_url         ||
      data?.thumbnail_url               ||
      null;
    console.info('[KrogerVideoWidget] iframely thumbnail:', thumb);
    return thumb;
  } catch (e) {
    console.warn('[KrogerVideoWidget] iframely failed:', e);
    return null;
  }
}

// ── Step 2: direct Staffbase article API call ──────────────────────────────

/**
 * Immediately calls the Staffbase article API to set the cover/header image
 * as soon as "Add Video" is clicked.
 *
 * Tries PUT before PATCH because /api/articles/ returns 405 on PATCH.
 * The 404 on /api/v3/contents/ means the extracted ID might be a slug —
 * both forms are attempted so the console logs reveal which one works.
 */
async function callStaffbaseArticleAPI(thumbUrl: string): Promise<boolean> {
  const origin = getTopOrigin();
  if (!origin) return false;

  const articleId = extractArticleId();
  if (!articleId) {
    console.warn('[KrogerVideoWidget] Could not extract article ID — will rely on fetch hook instead.');
    return false;
  }

  const payload = {
    coverImage:  { url: thumbUrl },
    headerImage: { url: thumbUrl },
    thumbnail:   { url: thumbUrl, type: 'image/jpeg' },
    media:       { url: thumbUrl, type: 'image' },
  };

  // PUT tried before PATCH — /api/articles/ returns 405 on PATCH
  const attempts: Array<{ path: string; method: string }> = [
    { path: `/api/articles/${articleId}`,    method: 'PUT'   },
    { path: `/api/articles/${articleId}`,    method: 'PATCH' },
    { path: `/api/v3/contents/${articleId}`, method: 'PATCH' },
    { path: `/api/v3/contents/${articleId}`, method: 'PUT'   },
    { path: `/api/content/${articleId}`,     method: 'PATCH' },
    { path: `/api/content/${articleId}`,     method: 'PUT'   },
    { path: `/api/news/${articleId}`,        method: 'PATCH' },
    { path: `/api/posts/${articleId}`,       method: 'PATCH' },
  ];

  for (const { path, method } of attempts) {
    const url = origin + path;
    try {
      const res = await topFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      console.info('[KrogerVideoWidget]', method, path, '→', res.status);
      if (res.ok) {
        console.info('[KrogerVideoWidget] ✅ Article cover image set:', thumbUrl);
        return true;
      }
    } catch (e) {
      console.warn('[KrogerVideoWidget] Error on', method, path, e);
    }
  }

  console.warn('[KrogerVideoWidget] All direct API attempts failed — will rely on fetch hook.');
  return false;
}

// ── Step 3: hook window.top.fetch (safety net) ────────────────────────────

function hookTopFetch(thumbUrl: string): void {
  let topWin: Window;
  try { topWin = window.top as Window; } catch { return; }

  const origin = getTopOrigin();
  const originalFetch = (topWin as any).fetch.bind(topWin);

  const restoreTimer = setTimeout(() => {
    (topWin as any).fetch = originalFetch;
    console.info('[KrogerVideoWidget] Fetch hook removed (timeout).');
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

    if (
      url.startsWith(origin) &&
      !url.includes('/api/iframely') &&
      !url.includes('/count') &&
      !url.includes('.js') &&
      !url.includes('.css')
    ) {
      try {
        const bodyParsed = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        console.info('[KrogerVideoWidget] Staffbase fetch →', method, url.replace(origin, ''), bodyParsed ?? '');
      } catch {
        console.info('[KrogerVideoWidget] Staffbase fetch →', method, url.replace(origin, ''));
      }
    }

    const isMutating =
      url.startsWith(origin) &&
      (method === 'PATCH' || method === 'PUT' || method === 'POST') &&
      typeof init?.body === 'string';

    if (isMutating) {
      try {
        const body = JSON.parse(init!.body as string);
        console.info('[KrogerVideoWidget] Mutating call intercepted:', method, url.replace(origin, ''), JSON.parse(JSON.stringify(body)));

        const isArticleSave =
          url.includes('/api/articles/') ||
          url.includes('/api/v3/contents/') ||
          url.includes('/api/content/') ||
          url.includes('/api/news/') ||
          url.includes('/api/posts/') ||
          url.includes('/api/plugin/news/');

        if (isArticleSave) {
          console.info('[KrogerVideoWidget] Fetch contents:', JSON.stringify(body.contents ?? body));
          const hasTitle = hasTitleInPayload(body);
          if (!hasTitle) {
            console.info('[KrogerVideoWidget] Skipping fetch injection — no title in payload (partial/autosave).');
          } else {
            injectThumbnailIntoPayload(body, thumbUrl);
            const patched = { ...init, body: JSON.stringify(body) };
            console.info('[KrogerVideoWidget] ✅ Injected thumbnail into save payload:', thumbUrl);
            clearTimeout(restoreTimer);
            (topWin as any).fetch = originalFetch;
            console.info('[KrogerVideoWidget] Fetch hook removed after injection.');
            return originalFetch(input, patched);
          }
        }
      } catch (e) {
        console.warn('[KrogerVideoWidget] Could not parse body:', e);
      }
    }

    return originalFetch(input, init);
  };

  console.info('[KrogerVideoWidget] Fetch hook installed as safety net for article save/publish.');

  const OrigXHR = (topWin as any).XMLHttpRequest;
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
      if (_url.startsWith(origin) && (_method === 'PATCH' || _method === 'PUT' || _method === 'POST')) {
        console.info('[KrogerVideoWidget] XHR mutating call:', _method, _url.replace(origin, ''));
        if (typeof body === 'string') {
          try {
            const parsed = JSON.parse(body);
            console.info('[KrogerVideoWidget] XHR payload:', JSON.parse(JSON.stringify(parsed)));
            const isArticleSave =
              _url.includes('/api/articles/') ||
              _url.includes('/api/v3/contents/') ||
              _url.includes('/api/content/') ||
              _url.includes('/api/news/') ||
              _url.includes('/api/posts/');
            if (isArticleSave) {
              console.info('[KrogerVideoWidget] XHR contents:', JSON.stringify(parsed.contents ?? parsed));
              const hasTitle = hasTitleInPayload(parsed);
              if (!hasTitle) {
                console.info('[KrogerVideoWidget] Skipping XHR injection — no title in payload (partial/autosave).');
              } else {
                injectThumbnailIntoPayload(parsed, thumbUrl);
                console.info('[KrogerVideoWidget] ✅ XHR thumbnail injected:', thumbUrl);
                return originalSend(JSON.stringify(parsed));
              }
            }
          } catch {}
        }
      }
      return originalSend(body);
    };
    return xhr;
  };
  console.info('[KrogerVideoWidget] XHR hook installed.');
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function injectArticleCoverImage(_videoUrl: string, fallbackThumbnailUrl: string): Promise<void> {
  if (!getTopOrigin()) return;

  // Step 1: get thumbnail via iframely using the hardcoded YouTube URL
  const iframelyThumb = await fetchIframelyThumbnail();
  const thumbUrl = iframelyThumb || fallbackThumbnailUrl;

  if (!thumbUrl) {
    console.warn('[KrogerVideoWidget] No thumbnail URL available, skipping.');
    return;
  }

  // Step 2: immediately call Staffbase article API on "Add Video" click
  await callStaffbaseArticleAPI(thumbUrl);

  // Step 3: also install fetch hook as safety net for article save/publish
  hookTopFetch(thumbUrl);
}
