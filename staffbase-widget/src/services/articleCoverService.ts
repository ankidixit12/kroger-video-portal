/**
 * Injects a video thumbnail into Staffbase's Article Image/Video field
 * automatically when a video is selected in the widget editor.
 *
 * Strategy 0 — Staffbase iframely (primary):
 *   Calls Staffbase's own internal iframely endpoint with the video URL.
 *   Iframely resolves the trusted thumbnail (YouTube/Qumu CDN) that Staffbase
 *   already accepts, then injects that URL via DOM.
 *
 * Strategy 1 — DOM injection with original thumbnail:
 *   Tries known Staffbase input selectors against the parent frame DOM.
 *   Add the correct selector to CANDIDATE_SELECTORS once discovered via DevTools.
 *
 * Strategy 2 — Staffbase REST API:
 *   PATCHes the article via /api/v3/contents/{id} using the existing browser session.
 */

const CANDIDATE_SELECTORS = [
  '[data-testid="content-header-media-url-input"]',
  '[data-testid="article-header-image-url"]',
  '[data-testid="cover-image-url-input"]',
  '[data-testid="media-url-input"]',
  '[data-testid="thumbnail-url-input"]',
  'input[name="headerImageUrl"]',
  'input[name="coverImageUrl"]',
  'input[name="thumbnailUrl"]',
  'input[name="thumbnail"]',
  'input[name="headerImage"]',
  'input[name="coverImage"]',
  'input[placeholder*="image" i]',
  'input[placeholder*="thumbnail" i]',
  'input[placeholder*="video" i]',
];

const CONTENT_ID_PATTERNS = [
  /\/post\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\b/i,
  /\/posts\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\b/i,
  /\/content\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\b/i,
  /\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\/edit\b/i,
  /\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\/?\s*$/i,
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getTopOrigin(): string {
  try { return (window.top as Window).location.origin; } catch { return ''; }
}

// Use the parent frame's fetch so requests originate from the Staffbase origin,
// not the widget iframe origin — avoids CORS 405 on PATCH/GET calls.
function topFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return (window.top as Window).fetch(input, init);
  } catch {
    return fetch(input, init);
  }
}

function setReactInputValue(el: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function tryDomInjection(url: string): boolean {
  try {
    const topDoc = (window.top as Window).document;
    for (const selector of CANDIDATE_SELECTORS) {
      const el = topDoc.querySelector<HTMLInputElement>(selector);
      if (el) {
        setReactInputValue(el, url);
        console.info('[KrogerVideoWidget] Article cover injected via DOM selector:', selector);
        return true;
      }
    }
  } catch { /* cross-origin guard */ }
  return false;
}

function extractContentId(): string | null {
  try {
    const href = (window.top as Window).location.href;
    for (const pattern of CONTENT_ID_PATTERNS) {
      const match = href.match(pattern);
      if (match?.[1]) return match[1];
    }
  } catch { /* cross-origin */ }
  return null;
}

// ── Strategy 0: Staffbase iframely ─────────────────────────────────────────

async function fetchIframelyThumbnail(videoUrl: string): Promise<string | null> {
  if (!videoUrl) return null;
  try {
    const origin  = getTopOrigin();
    if (!origin)  return null;

    // TODO: replace hardcoded URL with encodeURIComponent(videoUrl) once testing is complete
    const HARDCODED_TEST_URL = 'https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D62XccJOh9Lg%26list%3DRD62XccJOh9Lg%26start_radio%3D1';
    const endpoint = `${origin}/api/iframely?url=${HARDCODED_TEST_URL}&nowrap=on&callback=`;
    const res = await topFetch(endpoint, { credentials: 'include' });
    if (!res.ok) {
      console.warn('[KrogerVideoWidget] iframely API returned', res.status);
      return null;
    }

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // iframely sometimes wraps in JSONP — strip any leading/trailing callback wrapper
      const stripped = text.replace(/^\s*\w+\s*\(/, '').replace(/\)\s*;?\s*$/, '');
      data = JSON.parse(stripped);
    }

    // iframely response shapes — try most specific first
    const thumb =
      data?.links?.thumbnail?.[0]?.href   ||   // standard iframely links
      data?.links?.icon?.[0]?.href         ||
      data?.meta?.thumbnail_url            ||   // oEmbed-style
      data?.thumbnail_url                  ||
      null;

    if (thumb) console.info('[KrogerVideoWidget] iframely resolved thumbnail:', thumb);
    return thumb;
  } catch (e) {
    console.warn('[KrogerVideoWidget] iframely fetch failed:', e);
    return null;
  }
}

// ── Strategy 2: Staffbase articles PATCH ──────────────────────────────────

async function tryApiInjection(thumbnailUrl: string): Promise<boolean> {
  const contentId = extractContentId();
  if (!contentId) {
    console.warn('[KrogerVideoWidget] Could not parse content ID from URL:', getTopOrigin());
    return false;
  }
  const url = `${getTopOrigin()}/api/articles/${contentId}`;

  // Try payload shapes in order — update once the correct one is confirmed
  const payloads = [
    { thumbnail: { url: thumbnailUrl, type: 'image/jpeg' } },
    { thumbnail: { url: thumbnailUrl } },
    { thumbnail: thumbnailUrl },
    { image:     { url: thumbnailUrl } },
    { headerImage: { url: thumbnailUrl } },
  ];

  for (const body of payloads) {
    try {
      const res = await topFetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      console.info(`[KrogerVideoWidget] PATCH ${url} with`, body, '→', res.status);
      if (res.ok) {
        console.info('[KrogerVideoWidget] Article cover set. Working payload:', JSON.stringify(body));
        return true;
      }
    } catch (e) {
      console.warn('[KrogerVideoWidget] PATCH failed:', e);
    }
  }
  console.warn('[KrogerVideoWidget] All PATCH payloads failed. Share the console output to identify the correct field name.');
  return false;
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function injectArticleCoverImage(videoUrl: string, fallbackThumbnailUrl: string): Promise<void> {
  if (!videoUrl && !fallbackThumbnailUrl) return;

  // Step 1: resolve a trusted thumbnail via Staffbase's own iframely
  const iframelyThumb = await fetchIframelyThumbnail(videoUrl);
  const thumbToUse = iframelyThumb || fallbackThumbnailUrl;

  // Step 2: always PATCH the article — this is the only call that actually saves
  if (thumbToUse) {
    await tryApiInjection(thumbToUse);
  }

  // Step 3: also attempt DOM injection for immediate visual preview (best-effort)
  if (iframelyThumb) tryDomInjection(iframelyThumb);
  else if (fallbackThumbnailUrl) tryDomInjection(fallbackThumbnailUrl);
}
