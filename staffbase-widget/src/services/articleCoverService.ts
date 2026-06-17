/**
 * Injects a video thumbnail into Staffbase's Article Image/Video field
 * automatically when a video is selected in the widget editor.
 *
 * Strategy 1 — DOM injection (primary):
 *   Tries known Staffbase input selectors, then falls back to scanning all
 *   visible text inputs in the parent frame. Logs every candidate found so
 *   the correct selector can be identified in DevTools Console.
 *
 * Strategy 0 — Staffbase iframely (thumbnail source):
 *   Calls Staffbase's own internal iframely endpoint to resolve a trusted
 *   thumbnail URL (YouTube CDN) that Staffbase accepts in the image field.
 */

// Use the parent frame's fetch so requests originate from the Staffbase origin.
function topFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return (window.top as Window).fetch(input, init);
  } catch {
    return fetch(input, init);
  }
}

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
  el.dispatchEvent(new Event('blur',   { bubbles: true }));
}

// ── Strategy 0: Staffbase iframely thumbnail resolver ──────────────────────

async function fetchIframelyThumbnail(videoUrl: string): Promise<string | null> {
  if (!videoUrl) return null;
  try {
    const origin = getTopOrigin();
    if (!origin) return null;

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
      const stripped = text.replace(/^\s*\w+\s*\(/, '').replace(/\)\s*;?\s*$/, '');
      data = JSON.parse(stripped);
    }

    const thumb =
      data?.links?.thumbnail?.[0]?.href ||
      data?.links?.icon?.[0]?.href      ||
      data?.meta?.thumbnail_url         ||
      data?.thumbnail_url               ||
      null;

    if (thumb) console.info('[KrogerVideoWidget] iframely resolved thumbnail:', thumb);
    return thumb;
  } catch (e) {
    console.warn('[KrogerVideoWidget] iframely fetch failed:', e);
    return null;
  }
}

// ── Strategy 1: DOM injection ──────────────────────────────────────────────

const CANDIDATE_SELECTORS = [
  // Known Staffbase data-testid patterns
  '[data-testid="content-header-media-url-input"]',
  '[data-testid="article-header-image-url"]',
  '[data-testid="cover-image-url-input"]',
  '[data-testid="media-url-input"]',
  '[data-testid="thumbnail-url-input"]',
  '[data-testid="header-image-url"]',
  '[data-testid="image-url"]',
  '[data-testid="headerImage"]',
  // name-based selectors
  'input[name="headerImageUrl"]',
  'input[name="coverImageUrl"]',
  'input[name="thumbnailUrl"]',
  'input[name="thumbnail"]',
  'input[name="headerImage"]',
  'input[name="coverImage"]',
  'input[name="imageUrl"]',
  // placeholder-based (case-insensitive)
  'input[placeholder*="image" i]',
  'input[placeholder*="thumbnail" i]',
  'input[placeholder*="video" i]',
  'input[placeholder*="url" i]',
  // aria-label based
  '[aria-label*="image" i]',
  '[aria-label*="thumbnail" i]',
  '[aria-label*="cover" i]',
  '[aria-label*="header" i]',
];

function tryDomInjection(url: string): boolean {
  try {
    const topDoc = (window.top as Window).document;

    // 1. Try all known selectors first
    for (const selector of CANDIDATE_SELECTORS) {
      const el = topDoc.querySelector<HTMLInputElement>(selector);
      if (el) {
        setReactInputValue(el, url);
        console.info('[KrogerVideoWidget] ✅ Article cover injected via selector:', selector);
        return true;
      }
    }

    // 2. Fallback: scan ALL visible text inputs and log them so we can find the right one
    const allInputs = Array.from(topDoc.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'));
    const visible = allInputs.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    console.info('[KrogerVideoWidget] No known selector matched. Scanning visible inputs:', visible.length);
    visible.forEach((el, i) => {
      console.info(`[KrogerVideoWidget] Input[${i}]`, {
        id:          el.id          || '(none)',
        name:        el.name        || '(none)',
        placeholder: el.placeholder || '(none)',
        'data-testid': el.dataset['testid'] || '(none)',
        'aria-label':  el.getAttribute('aria-label') || '(none)',
        value:       el.value       || '(empty)',
        className:   el.className   || '(none)',
      });
    });

    // 3. Try to find an input that looks like a URL field (empty or contains http)
    const urlLike = visible.find(el =>
      el.placeholder?.toLowerCase().includes('http') ||
      el.value?.startsWith('http') ||
      el.value === '' && (
        el.placeholder?.toLowerCase().includes('url') ||
        el.getAttribute('aria-label')?.toLowerCase().includes('url')
      )
    );
    if (urlLike) {
      setReactInputValue(urlLike, url);
      console.info('[KrogerVideoWidget] ✅ Article cover injected via URL-like input heuristic', {
        id: urlLike.id, name: urlLike.name, placeholder: urlLike.placeholder,
        'data-testid': urlLike.dataset['testid'],
      });
      return true;
    }

    console.warn('[KrogerVideoWidget] ❌ Could not find Article Image/Video input. Check the Input[N] logs above in DevTools to find the correct selector, then add it to CANDIDATE_SELECTORS.');
  } catch (e) {
    console.warn('[KrogerVideoWidget] DOM injection error:', e);
  }
  return false;
}

// Retry DOM injection up to 3 times with 500ms delay — the Staffbase editor
// panel may not have rendered yet when a video is first selected.
function tryDomInjectionWithRetry(url: string, attemptsLeft = 3): void {
  if (tryDomInjection(url)) return;
  if (attemptsLeft <= 0) return;
  setTimeout(() => tryDomInjectionWithRetry(url, attemptsLeft - 1), 500);
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function injectArticleCoverImage(videoUrl: string, fallbackThumbnailUrl: string): Promise<void> {
  if (!videoUrl && !fallbackThumbnailUrl) return;

  // Step 1: resolve a trusted thumbnail via Staffbase's own iframely
  const iframelyThumb = await fetchIframelyThumbnail(videoUrl);
  const thumbToUse = iframelyThumb || fallbackThumbnailUrl;

  // Step 2: inject via DOM with retry (primary approach)
  if (thumbToUse) {
    tryDomInjectionWithRetry(thumbToUse);
  }
}
