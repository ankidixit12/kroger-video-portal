/**
 * On video selection:
 *   1. Calls Staffbase's iframely endpoint with the hardcoded YouTube URL.
 *   2. Gets back the trusted thumbnail URL (e.g. hqdefault.jpg).
 *   3. Sets up a MutationObserver — no auto-clicking.
 *      When the user manually opens Article Image/Video → Choose from → ELinks,
 *      the "Choose video" input[type="url"] is filled automatically.
 */

function topFetch(input: string, init?: RequestInit): Promise<Response> {
  try { return (window.top as Window).fetch(input, init); }
  catch { return fetch(input, init); }
}

function getTopOrigin(): string {
  try { return (window.top as Window).location.origin; } catch { return ''; }
}

function setReactInputValue(el: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur',   { bubbles: true }));
}

// ── Step 1: call iframely ──────────────────────────────────────────────────

async function fetchIframelyThumbnail(_videoUrl: string): Promise<string | null> {
  try {
    const origin = getTopOrigin();
    if (!origin) return null;

    // Hardcoded YouTube URL for testing
    const HARDCODED_TEST_URL = encodeURIComponent('https://www.youtube.com/watch?v=62XccJOh9Lg&list=RD62XccJOh9Lg&start_radio=1');
    const endpoint = `${origin}/api/iframely?url=${HARDCODED_TEST_URL}&nowrap=on&callback=`;

    console.info('[KrogerVideoWidget] Calling iframely:', endpoint);
    const res = await topFetch(endpoint, { credentials: 'include' });
    if (!res.ok) { console.warn('[KrogerVideoWidget] iframely returned', res.status); return null; }

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); }
    catch {
      const stripped = text.replace(/^\s*\w+\s*\(/, '').replace(/\)\s*;?\s*$/, '');
      data = JSON.parse(stripped);
    }

    const thumb =
      data?.links?.thumbnail?.[0]?.href ||
      data?.links?.icon?.[0]?.href      ||
      data?.meta?.thumbnail_url         ||
      data?.thumbnail_url               ||
      null;

    console.info('[KrogerVideoWidget] iframely thumbnail resolved:', thumb);
    return thumb;
  } catch (e) {
    console.warn('[KrogerVideoWidget] iframely call failed:', e);
    return null;
  }
}

// ── Step 2: watch for URL input (no auto-clicking) ─────────────────────────

const URL_INPUT_SELECTORS = [
  'input[type="url"]',
  '[data-testid="content-header-media-url-input"]',
  '[data-testid="media-url-input"]',
  '[data-testid="url-input"]',
  '[data-testid="video-url-input"]',
  'input[placeholder*="youtube" i]',
  'input[placeholder*="vimeo" i]',
  'input[placeholder*="video" i]',
  'input[placeholder*="https" i]',
];

let activeObserver: MutationObserver | null = null;

function watchAndFill(fillUrl: string, topDoc: Document): void {
  if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }

  function tryFill(): boolean {
    for (const sel of URL_INPUT_SELECTORS) {
      const el = topDoc.querySelector<HTMLInputElement>(sel);
      if (el) {
        setReactInputValue(el, fillUrl);
        console.info('[KrogerVideoWidget] ✅ Auto-filled Article Image/Video input via:', sel);
        if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
        return true;
      }
    }
    return false;
  }

  if (tryFill()) return;

  const timeout = setTimeout(() => {
    if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
    console.info('[KrogerVideoWidget] Observer stopped (20s timeout).');
  }, 20000);

  activeObserver = new MutationObserver(() => {
    if (tryFill()) clearTimeout(timeout);
  });
  activeObserver.observe(topDoc.body, { childList: true, subtree: true });
  console.info('[KrogerVideoWidget] Watching for Article Image/Video URL input — open the dialog manually to trigger auto-fill.');
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function injectArticleCoverImage(videoUrl: string, _fallbackThumbnailUrl: string): Promise<void> {
  if (!videoUrl) return;

  let topDoc: Document;
  try { topDoc = (window.top as Window).document; } catch { return; }

  // Call iframely with the hardcoded YouTube URL (logged in console + Network tab)
  await fetchIframelyThumbnail(videoUrl);

  // Fill the "Choose video" dialog with the hardcoded YouTube URL when it appears.
  const HARDCODED_YOUTUBE_URL = 'https://www.youtube.com/watch?v=62XccJOh9Lg&list=RD62XccJOh9Lg&start_radio=1';
  watchAndFill(HARDCODED_YOUTUBE_URL, topDoc);
}
