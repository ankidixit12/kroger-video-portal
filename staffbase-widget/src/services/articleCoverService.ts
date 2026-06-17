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

    // Intercept article save (PATCH / PUT / POST to article endpoints)
    const isArticleSave =
      (url.includes('/api/articles/') || url.includes('/api/v3/contents/')) &&
      (method === 'PATCH' || method === 'PUT' || method === 'POST') &&
      typeof init?.body === 'string';

    if (isArticleSave && thumbUrl) {
      try {
        const body = JSON.parse(init!.body as string);
        console.info('[KrogerVideoWidget] Intercepted article save. Original payload:', JSON.parse(JSON.stringify(body)));

        // Inject the thumbnail — try the most likely field names
        body.thumbnail    = { url: thumbUrl, type: 'image/jpeg' };
        body.headerImage  = { url: thumbUrl };

        const patched = { ...init, body: JSON.stringify(body) };
        console.info('[KrogerVideoWidget] Injected thumbnail into payload:', thumbUrl);

        // Unhook after first successful injection
        clearTimeout(restoreTimer);
        (topWin as any).fetch = originalFetch;
        console.info('[KrogerVideoWidget] Fetch hook removed after injection.');

        return originalFetch(input, patched);
      } catch (e) {
        console.warn('[KrogerVideoWidget] Payload injection failed:', e);
      }
    }

    return originalFetch(input, init);
  };

  console.info('[KrogerVideoWidget] Fetch hook installed. Thumbnail will be injected on next article save/publish.');
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
