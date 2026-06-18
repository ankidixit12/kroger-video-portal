/**
 * On video selection:
 *   1. Calls iframely to get the thumbnail URL.
 *   2. Hooks window.top.fetch.
 *      - On the FIRST Staffbase request it intercepts (any kind), it reads the
 *        CSRF token from that request's headers and immediately PATCHes the
 *        article cover image directly — no need to wait for the user to save.
 *      - On every subsequent article save/publish, it injects the thumbnail
 *        into the payload as a safety net.
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
      console.info('[KrogerVideoWidget] Article ID (from globals):', fromGlobals);
      return String(fromGlobals);
    }
  } catch {}
  console.warn('[KrogerVideoWidget] Could not extract article ID from parent URL.');
  return null;
}

/** Read CSRF token from a fetch RequestInit's headers (any casing). */
function extractCsrfFromHeaders(headers: HeadersInit | undefined): string | null {
  if (!headers) return null;
  try {
    if (headers instanceof Headers) {
      return headers.get('X-CSRF-Token') || headers.get('X-XSRF-TOKEN') || null;
    }
    if (Array.isArray(headers)) {
      for (const [k, v] of headers) {
        const kl = k.toLowerCase();
        if (kl === 'x-csrf-token' || kl === 'x-xsrf-token') return v;
      }
      return null;
    }
    const obj = headers as Record<string, string>;
    return (
      obj['X-CSRF-Token']  ||
      obj['X-XSRF-TOKEN']  ||
      obj['x-csrf-token']  ||
      obj['x-xsrf-token']  ||
      null
    );
  } catch {}
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

  payload.thumbnail  = imageWithType;
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

// ── Step 1: iframely call ──────────────────────────────────────────────────

const HARDCODED_YOUTUBE_URL = 'https://www.youtube.com/watch?v=62XccJOh9Lg&list=RD62XccJOh9Lg&start_radio=1';

async function fetchIframelyThumbnail(): Promise<string | null> {
  try {
    const origin = getTopOrigin();
    if (!origin) return null;
    const encoded  = encodeURIComponent(HARDCODED_YOUTUBE_URL);
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

// ── Step 2: direct API call using CSRF token captured from Staffbase ───────

async function callStaffbaseArticleAPIWithCsrf(thumbUrl: string, csrfToken: string): Promise<boolean> {
  const origin    = getTopOrigin();
  const articleId = extractArticleId();
  if (!origin || !articleId) return false;

  const payload = {
    coverImage:  { url: thumbUrl },
    headerImage: { url: thumbUrl },
    thumbnail:   { url: thumbUrl, type: 'image/jpeg' },
    media:       { url: thumbUrl, type: 'image' },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    'X-XSRF-TOKEN': csrfToken,
  };

  // PUT first — /api/articles/ returns 405 on PATCH
  const attempts: Array<{ path: string; method: string }> = [
    { path: `/api/articles/${articleId}`,    method: 'PUT'   },
    { path: `/api/v3/contents/${articleId}`, method: 'PATCH' },
    { path: `/api/v3/contents/${articleId}`, method: 'PUT'   },
    { path: `/api/content/${articleId}`,     method: 'PATCH' },
    { path: `/api/news/${articleId}`,        method: 'PATCH' },
    { path: `/api/posts/${articleId}`,       method: 'PATCH' },
  ];

  for (const { path, method } of attempts) {
    try {
      const res = await topFetch(origin + path, { method, headers, credentials: 'include', body: JSON.stringify(payload) });
      console.info('[KrogerVideoWidget]', method, path, '→', res.status);
      if (res.ok) {
        console.info('[KrogerVideoWidget] ✅ Article cover image set directly:', thumbUrl);
        return true;
      }
    } catch (e) {
      console.warn('[KrogerVideoWidget] Error on', method, path, e);
    }
  }

  console.warn('[KrogerVideoWidget] Direct API attempts all failed — thumbnail will be injected on next save.');
  return false;
}

// ── Step 3: hook window.top.fetch ──────────────────────────────────────────

function hookTopFetch(thumbUrl: string): void {
  let topWin: Window;
  try { topWin = window.top as Window; } catch { return; }

  const origin       = getTopOrigin();
  const originalFetch = (topWin as any).fetch.bind(topWin);
  let csrfCaptured   = false;   // fire the direct call only once

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

    // ── Capture CSRF token from the first Staffbase request we see ──
    if (!csrfCaptured && url.startsWith(origin) && !url.includes('/api/iframely')) {
      const csrfToken = extractCsrfFromHeaders(init?.headers);
      if (csrfToken) {
        csrfCaptured = true;
        console.info('[KrogerVideoWidget] CSRF token captured — firing direct article API call.');
        callStaffbaseArticleAPIWithCsrf(thumbUrl, csrfToken);
      }
    }

    // ── Log every non-trivial Staffbase call ────────────────────────
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

    // ── Inject thumbnail on article save/publish (safety net) ───────
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
          const hasTitle = hasTitleInPayload(body);
          if (!hasTitle) {
            console.info('[KrogerVideoWidget] Skipping injection — no title in payload (autosave).');
          } else {
            injectThumbnailIntoPayload(body, thumbUrl);
            const patched = { ...init, body: JSON.stringify(body) };
            console.info('[KrogerVideoWidget] ✅ Injected thumbnail into save payload:', thumbUrl);
            clearTimeout(restoreTimer);
            (topWin as any).fetch = originalFetch;
            return originalFetch(input, patched);
          }
        }
      } catch (e) {
        console.warn('[KrogerVideoWidget] Could not parse body:', e);
      }
    }

    return originalFetch(input, init);
  };

  console.info('[KrogerVideoWidget] Fetch hook installed — waiting for first Staffbase request to capture CSRF token.');

  // XHR hook (safety net in case Staffbase uses XHR instead of fetch)
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
              console.info('[KrogerVideoWidget] ✅ XHR thumbnail injected:', thumbUrl);
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

export async function injectArticleCoverImage(_videoUrl: string, fallbackThumbnailUrl: string): Promise<void> {
  if (!getTopOrigin()) return;

  const iframelyThumb = await fetchIframelyThumbnail();
  const thumbUrl = iframelyThumb || fallbackThumbnailUrl;

  if (!thumbUrl) {
    console.warn('[KrogerVideoWidget] No thumbnail URL available, skipping.');
    return;
  }

  // Install hook — it captures the CSRF token from the first Staffbase request
  // and immediately fires the direct article API call with that token.
  // It also injects the thumbnail on every subsequent article save as a safety net.
  hookTopFetch(thumbUrl);
}
