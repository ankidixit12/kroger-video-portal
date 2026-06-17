/**
 * Attempts to inject a thumbnail URL into Staffbase's Article Image/Video field
 * automatically when a video is selected in the widget editor.
 *
 * Strategy 1 — DOM injection: searches the parent frame for known input selectors
 * and triggers React's synthetic event system to update the field value.
 *
 * Strategy 2 — Staffbase REST API: extracts the article ID from the editor URL
 * and PATCHes the article using the existing browser session (same-origin, no
 * extra token needed).
 *
 * If neither strategy works, run this snippet in the Staffbase editor DevTools
 * console to discover the right selector:
 *
 *   window.document.querySelectorAll('input, textarea').forEach(el => {
 *     console.log(el.name, el.id, el.getAttribute('data-testid'), el.placeholder, el);
 *   });
 *
 * Then add the matching selector to CANDIDATE_SELECTORS below.
 */

// Ordered list of selectors to try — most specific first.
// Extend this list once you inspect the Staffbase editor DOM.
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

// Staffbase URL patterns that contain the article/content ID.
// Typical: /app/news/post/{id}/edit  or  /app/content/{id}
const CONTENT_ID_PATTERNS = [
  /\/post\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\b/i,
  /\/posts\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\b/i,
  /\/content\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\b/i,
  /\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\/edit\b/i,
  /\/([a-f0-9]{20,}(?:-[a-f0-9]+)*)\/?\s*$/i,
];

function setReactInputValue(el: HTMLInputElement, value: string): void {
  // React overrides the native setter — use the prototype-level setter so
  // React's onChange fires correctly even for controlled inputs.
  const nativeSetter =
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function tryDomInjection(thumbnailUrl: string): boolean {
  try {
    const topDoc = (window.top as Window).document;
    for (const selector of CANDIDATE_SELECTORS) {
      const el = topDoc.querySelector<HTMLInputElement>(selector);
      if (el) {
        setReactInputValue(el, thumbnailUrl);
        console.info('[KrogerVideoWidget] Article cover image injected via selector:', selector);
        return true;
      }
    }
  } catch {
    // cross-origin guard — shouldn't happen since window.top is same-origin
  }
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

async function tryApiInjection(thumbnailUrl: string): Promise<boolean> {
  const contentId = extractContentId();
  if (!contentId) {
    console.warn(
      '[KrogerVideoWidget] Article cover image: could not parse content ID from URL.',
      'URL:', (() => { try { return (window.top as Window).location.href; } catch { return 'unknown'; } })()
    );
    return false;
  }

  try {
    const origin = (window.top as Window).location.origin;
    const url    = `${origin}/api/v3/contents/${contentId}`;

    // Try the two most common Staffbase thumbnail field shapes.
    const payloads = [
      { thumbnail:     { url: thumbnailUrl, type: 'image' } },
      { headerImage:   { url: thumbnailUrl } },
      { coverImageUrl: thumbnailUrl },
    ];

    for (const body of payloads) {
      const res = await fetch(url, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(body),
      });
      if (res.ok) {
        console.info('[KrogerVideoWidget] Article cover image set via Staffbase API. Payload:', body);
        return true;
      }
    }
    console.warn(
      '[KrogerVideoWidget] Staffbase API did not accept any cover image payload.',
      'Check the network tab when manually setting the cover image to find the correct field name.'
    );
  } catch (e) {
    console.warn('[KrogerVideoWidget] Staffbase API call failed:', e);
  }
  return false;
}

export async function injectArticleCoverImage(thumbnailUrl: string): Promise<void> {
  if (!thumbnailUrl) return;

  // Strategy 1: direct DOM manipulation (synchronous, instant)
  if (tryDomInjection(thumbnailUrl)) return;

  // Strategy 2: Staffbase REST API (async, requires article ID in URL)
  const ok = await tryApiInjection(thumbnailUrl);

  if (!ok) {
    console.warn(
      '[KrogerVideoWidget] Article cover image could not be set automatically.',
      'To fix: open the Staffbase editor, inspect the Article Image/Video input,',
      'and add its selector to CANDIDATE_SELECTORS in articleCoverService.ts.',
      'Thumbnail URL:', thumbnailUrl
    );
  }
}
