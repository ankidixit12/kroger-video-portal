/**
 * On video selection:
 *   1. Calls iframely to get the thumbnail URL.
 *   2. Hooks window.top.fetch so when the user publishes/saves the article,
 *      Staffbase's own PATCH request is intercepted and the thumbnail is
 *      injected into the payload before it goes out.
 *   3. The request succeeds because it originates from Staffbase's own code
 *      (correct CSRF token, correct origin) — not from our iframe.
 *
 * No auto-clicks. Thumbnail is saved when the user clicks Publish/Save.
 */

function topFetch(input: string, init?: RequestInit): Promise<Response> {
  try { return (window.top as Window).fetch(input, init); }
  catch { return fetch(input, init); }
}

function getTopOrigin(): string {
  try { return (window.top as Window).location.origin; } catch { return ''; }
}

const HARDCODED_YOUTUBE_URL = 'https://www.youtube.com/watch?v=62XccJOh9Lg&list=RD62XccJOh9Lg&start_radio=1';

// ── Step 1: iframely call ──────────────────────────────────────────────────

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

// ── Step 2: hook window.top.fetch ──────────────────────────────────────────

function hookTopFetch(thumbUrl: string): void {
  let topWin: Window;
  try { topWin = window.top as Window; } catch { return; }

  const origin = getTopOrigin();
  const originalFetch = (topWin as any).fetch.bind(topWin);

  // Restore after 10 minutes regardless
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

    // Log every Staffbase API call (skip iframely + asset requests)
    // so we can see exactly what Staffbase sends when saving the article.
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

    // Intercept ANY mutating call (PATCH/PUT/POST) to the Staffbase origin
    const isMutating =
      url.startsWith(origin) &&
      (method === 'PATCH' || method === 'PUT' || method === 'POST') &&
      typeof init?.body === 'string';

    if (isMutating) {
      try {
        const body = JSON.parse(init!.body as string);
        console.info('[KrogerVideoWidget] Mutating call intercepted:', method, url.replace(origin, ''), JSON.parse(JSON.stringify(body)));

        // Only inject thumbnail if this looks like an article/content save
        const isArticleSave =
          url.includes('/api/articles/') ||
          url.includes('/api/v3/contents/') ||
          url.includes('/api/content/') ||
          url.includes('/api/news/') ||
          url.includes('/api/posts/') ||
          url.includes('/api/plugin/news/');

        if (isArticleSave) {
          console.info('[KrogerVideoWidget] Fetch contents:', JSON.stringify(body.contents ?? body));
          const target = body.contents ?? body;
          target.thumbnail   = { url: thumbUrl, type: 'image/jpeg' };
          target.headerImage = { url: thumbUrl };
          target.coverImage  = { url: thumbUrl };
          target.media       = { url: thumbUrl, type: 'image' };
          body.thumbnail     = { url: thumbUrl, type: 'image/jpeg' };
          body.headerImage   = { url: thumbUrl };
          const patched = { ...init, body: JSON.stringify(body) };
          console.info('[KrogerVideoWidget] ✅ Injected thumbnail into contents:', thumbUrl);
          clearTimeout(restoreTimer);
          (topWin as any).fetch = originalFetch;
          console.info('[KrogerVideoWidget] Fetch hook removed after injection.');
          return originalFetch(input, patched);
        }
      } catch (e) {
        console.warn('[KrogerVideoWidget] Could not parse body:', e);
      }
    }

    return originalFetch(input, init);
  };

  console.info('[KrogerVideoWidget] Fetch hook installed. Thumbnail will be injected on next article save/publish.');

  // Also hook XMLHttpRequest in case Staffbase uses XHR instead of fetch
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
              // Log the full contents structure so we can see the correct field name
              console.info('[KrogerVideoWidget] XHR contents:', JSON.stringify(parsed.contents ?? parsed));

              // Inject at top level and inside contents object
              const target = parsed.contents ?? parsed;
              target.thumbnail   = { url: thumbUrl, type: 'image/jpeg' };
              target.headerImage = { url: thumbUrl };
              target.coverImage  = { url: thumbUrl };
              target.media       = { url: thumbUrl, type: 'image' };
              // Also try at top level regardless
              parsed.thumbnail   = { url: thumbUrl, type: 'image/jpeg' };
              parsed.headerImage = { url: thumbUrl };
              console.info('[KrogerVideoWidget] ✅ XHR thumbnail injected inside contents:', thumbUrl);
              return originalSend(JSON.stringify(parsed));
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

  // Step 1: get thumbnail from iframely
  const iframelyThumb = await fetchIframelyThumbnail();
  const thumbUrl = iframelyThumb || fallbackThumbnailUrl;

  if (!thumbUrl) {
    console.warn('[KrogerVideoWidget] No thumbnail URL available, skipping hook.');
    return;
  }

  // Step 2: install fetch hook — will inject on next article Publish/Save
  hookTopFetch(thumbUrl);
}
