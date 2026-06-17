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
    const res = await fetch(endpoint, { credentials: 'include' });
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

// ── Strategy 2: Staffbase REST API ─────────────────────────────────────────

async function tryApiInjection(thumbnailUrl: string): Promise<boolean> {
  const contentId = extractContentId();
  if (!contentId) {
    console.warn('[KrogerVideoWidget] Could not parse content ID from URL:', getTopOrigin());
    return false;
  }
  try {
    const url = `${getTopOrigin()}/api/articles/${contentId}`;
    const payloads = [
      { thumbnail:     { url: thumbnailUrl, type: 'image' } },
      { headerImage:   { url: thumbnailUrl } },
      { coverImageUrl: thumbnailUrl },
    ];
    for (const body of payloads) {
      const res = await fetch(url, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        console.info('[KrogerVideoWidget] Article cover set via Staffbase API. Payload:', body);
        return true;
      }
    }
    console.warn('[KrogerVideoWidget] Staffbase API did not accept cover image payload.');
  } catch (e) {
    console.warn('[KrogerVideoWidget] Staffbase API call failed:', e);
  }
  return false;
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function injectArticleCoverImage(videoUrl: string, fallbackThumbnailUrl: string): Promise<void> {
  if (!videoUrl && !fallbackThumbnailUrl) return;

  // Strategy 0: call Staffbase's own iframely to get a trusted thumbnail URL
  const iframelyThumb = await fetchIframelyThumbnail(videoUrl);
  if (iframelyThumb && tryDomInjection(iframelyThumb)) return;

  // Strategy 1: DOM injection with the original Qumu thumbnail URL
  if (fallbackThumbnailUrl && tryDomInjection(fallbackThumbnailUrl)) return;

  // Strategy 2: Staffbase REST API
  const thumbToUse = iframelyThumb || fallbackThumbnailUrl;
  if (thumbToUse) {
    const ok = await tryApiInjection(thumbToUse);
    if (ok) return;
  }

  console.warn(
    '[KrogerVideoWidget] Could not auto-populate Article Image/Video.',
    'Inspect the Staffbase editor DOM and add the correct selector to CANDIDATE_SELECTORS.',
    'Video URL:', videoUrl, '| Thumbnail:', fallbackThumbnailUrl
  );
}
