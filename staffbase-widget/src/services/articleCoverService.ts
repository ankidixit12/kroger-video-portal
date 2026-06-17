/**
 * Injects a video thumbnail into Staffbase's Article Image/Video field.
 *
 * The Article Image/Video section is a media picker with a multi-step UI:
 *   1. Click the "Article Image/Video" section label → drag-drop panel opens
 *   2. Click "Choose from ∨" button → dropdown appears
 *   3. Click "URL" / "By URL" option → URL input appears
 *   4. Fill the URL input via React native setter
 *
 * A MutationObserver runs throughout to catch the URL input the moment it
 * appears, regardless of which step triggers it.
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

// ── DOM helpers ─────────────────────────────────────────────────────────────

// URL input selectors — tried each time an input might have appeared
const URL_INPUT_SELECTORS = [
  'input[type="url"]',
  '[data-testid="content-header-media-url-input"]',
  '[data-testid="article-header-image-url"]',
  '[data-testid="cover-image-url-input"]',
  '[data-testid="media-url-input"]',
  '[data-testid="thumbnail-url-input"]',
  '[data-testid="header-image-url"]',
  '[data-testid="image-url-input"]',
  '[data-testid="url-input"]',
  'input[name="headerImageUrl"]',
  'input[name="coverImageUrl"]',
  'input[name="thumbnailUrl"]',
  'input[name="imageUrl"]',
  'input[name="mediaUrl"]',
  'input[placeholder*="https" i]',
  'input[placeholder*="url" i]',
  'input[placeholder*="image" i]',
  'input[placeholder*="thumbnail" i]',
  '[aria-label*="url" i]',
  '[aria-label*="image url" i]',
];

function findAndFillUrlInput(topDoc: Document, url: string): boolean {
  for (const sel of URL_INPUT_SELECTORS) {
    const el = topDoc.querySelector<HTMLInputElement>(sel);
    if (el) {
      setReactInputValue(el, url);
      console.info('[KrogerVideoWidget] ✅ Filled URL input via selector:', sel, el);
      return true;
    }
  }
  return false;
}

// Find a visible clickable element whose text matches the given string.
function findByText(topDoc: Document, query: string, tag = 'button, [role="button"], [role="menuitem"], [role="option"], li, a, span'): HTMLElement | null {
  const q = query.toLowerCase();
  const candidates = Array.from(topDoc.querySelectorAll<HTMLElement>(tag));
  // exact match first
  const exact = candidates.find(el => el.textContent?.trim().toLowerCase() === q);
  if (exact) return exact;
  // partial match
  return candidates.find(el => {
    const t = el.textContent?.trim().toLowerCase() || '';
    return t.includes(q) && t.length < 40;
  }) || null;
}

// ── Multi-step click chain ─────────────────────────────────────────────────

function stepClickChooseFrom(topDoc: Document): void {
  const btn = findByText(topDoc, 'choose from') || findByText(topDoc, 'choose');
  if (btn) {
    console.info('[KrogerVideoWidget] Step 2: clicking "Choose from" button →', btn.textContent?.trim());
    btn.click();
  } else {
    console.warn('[KrogerVideoWidget] Step 2: "Choose from" button not found. Logging all visible buttons:');
    Array.from(topDoc.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .filter(el => el.getBoundingClientRect().width > 0)
      .forEach((el, i) => console.info(`  btn[${i}]:`, el.textContent?.trim(), el.dataset));
  }
}

function stepClickUrlOption(topDoc: Document): void {
  // Look for a "URL" / "By URL" / "From URL" menu item
  const opt =
    findByText(topDoc, 'url',       '[role="menuitem"], [role="option"], li, button, a') ||
    findByText(topDoc, 'by url',    '[role="menuitem"], [role="option"], li, button, a') ||
    findByText(topDoc, 'from url',  '[role="menuitem"], [role="option"], li, button, a') ||
    findByText(topDoc, 'link',      '[role="menuitem"], [role="option"], li, button, a') ||
    findByText(topDoc, 'external',  '[role="menuitem"], [role="option"], li, button, a');

  if (opt) {
    console.info('[KrogerVideoWidget] Step 3: clicking URL option →', opt.textContent?.trim());
    opt.click();
  } else {
    console.warn('[KrogerVideoWidget] Step 3: URL option not found. Logging all visible menu items:');
    Array.from(topDoc.querySelectorAll<HTMLElement>('[role="menuitem"], [role="option"], li'))
      .filter(el => el.getBoundingClientRect().width > 0)
      .forEach((el, i) => console.info(`  item[${i}]:`, el.textContent?.trim()));
  }
}

function stepClickArticleImageSection(topDoc: Document): void {
  // Find the Article Image/Video container or its label
  const candidates = [
    topDoc.querySelector<HTMLElement>('[data-testid="article-header-media"]'),
    topDoc.querySelector<HTMLElement>('[data-testid="cover-media"]'),
    topDoc.querySelector<HTMLElement>('[data-testid="content-header-media"]'),
    topDoc.querySelector<HTMLElement>('[class*="HeaderMedia"]'),
    topDoc.querySelector<HTMLElement>('[class*="headerMedia"]'),
    topDoc.querySelector<HTMLElement>('[class*="CoverMedia"]'),
    findByText(topDoc, 'article image/video', 'label, h3, h4, p, span, div'),
    findByText(topDoc, 'image/video',         'label, h3, h4, p, span, div'),
  ].filter(Boolean) as HTMLElement[];

  if (candidates.length > 0) {
    const el = candidates[0];
    console.info('[KrogerVideoWidget] Step 1: clicking Article Image/Video section →', el.textContent?.trim()?.slice(0, 60));
    el.click();
    (el.parentElement as HTMLElement)?.click();
  } else {
    console.warn('[KrogerVideoWidget] Step 1: Article Image/Video section not found. Will rely on MutationObserver.');
  }
}

// ── MutationObserver + polling ─────────────────────────────────────────────

let activeObserver: MutationObserver | null = null;

function startWatching(thumbUrl: string, topDoc: Document): void {
  if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }

  const done = (): void => {
    if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
  };

  const tryFill = (): boolean => {
    if (findAndFillUrlInput(topDoc, thumbUrl)) { done(); return true; }
    return false;
  };

  // Disconnect after 20 seconds regardless
  const timeout = setTimeout(() => {
    done();
    console.warn('[KrogerVideoWidget] Gave up waiting for URL input after 20s. Log all inputs:');
    Array.from(topDoc.querySelectorAll<HTMLInputElement>('input')).forEach((el, i) => {
      console.info(`  input[${i}]:`, { id: el.id, type: el.type, name: el.name, placeholder: el.placeholder, 'data-testid': el.dataset['testid'], 'aria-label': el.getAttribute('aria-label') });
    });
  }, 20000);

  activeObserver = new MutationObserver(() => {
    if (tryFill()) clearTimeout(timeout);
  });
  activeObserver.observe(topDoc.body, { childList: true, subtree: true, attributes: true });
  console.info('[KrogerVideoWidget] Watching for URL input to appear...');
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function injectArticleCoverImage(videoUrl: string, fallbackThumbnailUrl: string): Promise<void> {
  if (!videoUrl && !fallbackThumbnailUrl) return;

  const iframelyThumb = await fetchIframelyThumbnail(videoUrl);
  const thumbUrl = iframelyThumb || fallbackThumbnailUrl;
  if (!thumbUrl) return;

  let topDoc: Document;
  try { topDoc = (window.top as Window).document; } catch { return; }

  // Step 0: try immediately in case the panel is already open
  if (findAndFillUrlInput(topDoc, thumbUrl)) return;

  // Start watching for the URL input throughout the whole flow
  startWatching(thumbUrl, topDoc);

  // Step 1 (0ms): click the Article Image/Video section → reveals drag-drop panel
  stepClickArticleImageSection(topDoc);

  // Step 2 (600ms): click "Choose from ∨" → reveals dropdown
  setTimeout(() => stepClickChooseFrom(topDoc), 600);

  // Step 3 (1200ms): click "URL" option in dropdown → reveals URL input
  setTimeout(() => stepClickUrlOption(topDoc), 1200);

  // Step 3b (1800ms): retry URL option click (dropdown may have animated in)
  setTimeout(() => stepClickUrlOption(topDoc), 1800);

  // Polling fallback every 700ms for 15s — catches the input whenever it appears
  let polls = 0;
  const poll = setInterval(() => {
    polls++;
    if (findAndFillUrlInput(topDoc, thumbUrl) || polls >= 22) clearInterval(poll);
  }, 700);
}
