/**
 * Injects a video thumbnail into Staffbase's Article Image/Video field.
 *
 * The Article Image/Video URL input is NOT in the DOM until the user (or we)
 * clicks that section. Strategy:
 *   1. Resolve thumbnail via iframely.
 *   2. Try to auto-click the Article Image/Video container to reveal the URL input.
 *   3. Watch the parent frame DOM with MutationObserver — the moment a URL
 *      input appears, fill it and disconnect.
 *   4. Also retry direct injection every 500 ms for 10 seconds as a fallback.
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

// ── iframely thumbnail resolver ────────────────────────────────────────────

async function fetchIframelyThumbnail(videoUrl: string): Promise<string | null> {
  if (!videoUrl) return null;
  try {
    const origin = getTopOrigin();
    if (!origin) return null;

    // TODO: replace hardcoded URL with encodeURIComponent(videoUrl) once testing is complete
    const HARDCODED_TEST_URL = 'https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D62XccJOh9Lg%26list%3DRD62XccJOh9Lg%26start_radio%3D1';
    const endpoint = `${origin}/api/iframely?url=${HARDCODED_TEST_URL}&nowrap=on&callback=`;
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
    if (thumb) console.info('[KrogerVideoWidget] iframely thumbnail:', thumb);
    return thumb;
  } catch (e) {
    console.warn('[KrogerVideoWidget] iframely failed:', e);
    return null;
  }
}

// ── DOM injection ──────────────────────────────────────────────────────────

const KNOWN_SELECTORS = [
  // data-testid
  '[data-testid="content-header-media-url-input"]',
  '[data-testid="article-header-image-url"]',
  '[data-testid="cover-image-url-input"]',
  '[data-testid="media-url-input"]',
  '[data-testid="thumbnail-url-input"]',
  '[data-testid="header-image-url"]',
  '[data-testid="image-url"]',
  '[data-testid="headerImage"]',
  // name
  'input[name="headerImageUrl"]',
  'input[name="coverImageUrl"]',
  'input[name="thumbnailUrl"]',
  'input[name="thumbnail"]',
  'input[name="headerImage"]',
  'input[name="coverImage"]',
  'input[name="imageUrl"]',
  // type="url" (Staffbase uses this for media URL fields)
  'input[type="url"]',
  // placeholder / aria-label
  'input[placeholder*="image" i]',
  'input[placeholder*="thumbnail" i]',
  'input[placeholder*="video" i]',
  'input[placeholder*="url" i]',
  '[aria-label*="image" i]',
  '[aria-label*="thumbnail" i]',
  '[aria-label*="cover" i]',
  '[aria-label*="header" i]',
];

// Selectors for the Article Image/Video container that we should click to
// reveal the URL input panel.
const MEDIA_SECTION_SELECTORS = [
  '[data-testid="article-header-media"]',
  '[data-testid="cover-media"]',
  '[data-testid="content-header-media"]',
  '[data-testid="header-media"]',
  '[data-testid="media-section"]',
  '[class*="HeaderMedia"]',
  '[class*="headerMedia"]',
  '[class*="CoverMedia"]',
  '[class*="coverMedia"]',
  '[class*="ArticleHeader"]',
  '[class*="articleHeader"]',
  // fallback: a label whose text mentions "Image" or "Video"
  'label',
];

function tryInjectIntoEl(el: HTMLInputElement, url: string, label: string): boolean {
  if (!el) return false;
  setReactInputValue(el, url);
  console.info('[KrogerVideoWidget] ✅ Injected into', label, el);
  return true;
}

function tryKnownSelectors(topDoc: Document, url: string): boolean {
  for (const sel of KNOWN_SELECTORS) {
    const el = topDoc.querySelector<HTMLInputElement>(sel);
    if (el) return tryInjectIntoEl(el, url, sel);
  }
  return false;
}

function logAllInputs(topDoc: Document): void {
  const all = Array.from(topDoc.querySelectorAll<HTMLInputElement>('input'));
  console.info(`[KrogerVideoWidget] ALL inputs in parent frame (${all.length}):`);
  all.forEach((el, i) => {
    console.info(`  [${i}]`, {
      id:          el.id          || '—',
      type:        el.type        || '—',
      name:        el.name        || '—',
      placeholder: el.placeholder || '—',
      'data-testid': el.dataset['testid'] || '—',
      'aria-label':  el.getAttribute('aria-label') || '—',
      value:       el.value || '(empty)',
      visible:     el.getBoundingClientRect().width > 0,
    });
  });
}

// Try to find and click the Article Image/Video container so the URL input appears.
function tryClickMediaSection(topDoc: Document): void {
  // First try explicit selectors
  for (const sel of MEDIA_SECTION_SELECTORS) {
    if (sel === 'label') continue;
    const el = topDoc.querySelector<HTMLElement>(sel);
    if (el) {
      console.info('[KrogerVideoWidget] Clicking media section:', sel);
      el.click();
      return;
    }
  }

  // Fallback: find a label whose text contains "Image" or "Video"
  const labels = Array.from(topDoc.querySelectorAll<HTMLElement>('label, [class*="label" i], h3, h4, span'));
  const mediaLabel = labels.find(el => {
    const t = el.textContent?.toLowerCase() || '';
    return (t.includes('image') || t.includes('video')) && t.length < 60;
  });
  if (mediaLabel) {
    console.info('[KrogerVideoWidget] Clicking label-like element:', mediaLabel.textContent?.trim());
    mediaLabel.click();
    // also try clicking its parent/sibling container
    (mediaLabel.parentElement as HTMLElement)?.click();
  } else {
    console.warn('[KrogerVideoWidget] Could not find Article Image/Video section to click.');
    logAllInputs(topDoc);
  }
}

// Watch the parent frame for new inputs appearing after the media section is clicked.
let activeObserver: MutationObserver | null = null;

function watchForMediaInput(url: string): void {
  if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }

  let topDoc: Document;
  try { topDoc = (window.top as Window).document; } catch { return; }

  const timeout = setTimeout(() => {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
      console.warn('[KrogerVideoWidget] Timed out waiting for Article Image/Video input. Logging all inputs:');
      logAllInputs(topDoc);
    }
  }, 15000);

  activeObserver = new MutationObserver(() => {
    if (tryKnownSelectors(topDoc, url)) {
      clearTimeout(timeout);
      if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
    }
  });

  activeObserver.observe(topDoc.body, { childList: true, subtree: true, attributes: true });
  console.info('[KrogerVideoWidget] Watching for Article Image/Video input to appear...');
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function injectArticleCoverImage(videoUrl: string, fallbackThumbnailUrl: string): Promise<void> {
  if (!videoUrl && !fallbackThumbnailUrl) return;

  const iframelyThumb = await fetchIframelyThumbnail(videoUrl);
  const thumbToUse = iframelyThumb || fallbackThumbnailUrl;
  if (!thumbToUse) return;

  let topDoc: Document;
  try { topDoc = (window.top as Window).document; } catch { return; }

  // Step 1: try known selectors immediately (in case input is already visible)
  if (tryKnownSelectors(topDoc, thumbToUse)) return;

  // Step 2: set up MutationObserver BEFORE clicking, so we don't miss it
  watchForMediaInput(thumbToUse);

  // Step 3: click the Article Image/Video section to reveal its URL input
  tryClickMediaSection(topDoc);

  // Step 4: also poll every 600ms for 10s as a belt-and-suspenders fallback
  let polls = 0;
  const poll = setInterval(() => {
    polls++;
    if (tryKnownSelectors(topDoc, thumbToUse) || polls >= 17) {
      clearInterval(poll);
    }
  }, 600);
}
