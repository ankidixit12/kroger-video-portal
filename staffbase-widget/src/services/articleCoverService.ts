/**
 * On video selection, automatically populates Staffbase's Article Image/Video:
 *   1. Calls iframely with the hardcoded YouTube URL (visible in Network tab).
 *   2. Auto-clicks: Article Image/Video label → "Choose from" → "ELinks"
 *   3. Auto-fills the "Choose video" input with the YouTube URL.
 *   4. Auto-clicks Save → Staffbase resolves the thumbnail from YouTube.
 *
 * No manual steps required.
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

const HARDCODED_YOUTUBE_URL = 'https://www.youtube.com/watch?v=62XccJOh9Lg&list=RD62XccJOh9Lg&start_radio=1';

// ── Step 0: iframely call (for Network tab visibility) ─────────────────────

async function callIframely(): Promise<void> {
  try {
    const origin = getTopOrigin();
    if (!origin) return;
    const encoded = encodeURIComponent(HARDCODED_YOUTUBE_URL);
    const endpoint = `${origin}/api/iframely?url=${encoded}&nowrap=on&callback=`;
    console.info('[KrogerVideoWidget] iframely call:', endpoint);
    const res = await topFetch(endpoint, { credentials: 'include' });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = {}; }
    const thumb = data?.links?.thumbnail?.[0]?.href || data?.meta?.thumbnail_url || null;
    console.info('[KrogerVideoWidget] iframely thumbnail:', thumb);
  } catch (e) {
    console.warn('[KrogerVideoWidget] iframely failed:', e);
  }
}

// ── Click helpers ──────────────────────────────────────────────────────────

function findByText(
  topDoc: Document,
  query: string,
  tag = 'button,[role="button"],[role="menuitem"],[role="option"],li,a,span'
): HTMLElement | null {
  const q = query.toLowerCase();
  const all = Array.from(topDoc.querySelectorAll<HTMLElement>(tag));
  return (
    all.find(el => el.textContent?.trim().toLowerCase() === q) ||
    all.find(el => { const t = el.textContent?.trim().toLowerCase() || ''; return t.includes(q) && t.length < 50; }) ||
    null
  );
}

function clickArticleImageSection(topDoc: Document): void {
  const el =
    topDoc.querySelector<HTMLElement>('[data-testid="article-header-media"]') ||
    topDoc.querySelector<HTMLElement>('[data-testid="cover-media"]') ||
    topDoc.querySelector<HTMLElement>('[class*="HeaderMedia"]') ||
    topDoc.querySelector<HTMLElement>('[class*="headerMedia"]') ||
    findByText(topDoc, 'article image/video', 'label,h3,h4,p,span,div') ||
    findByText(topDoc, 'image/video',         'label,h3,h4,p,span,div');
  if (el) {
    console.info('[KrogerVideoWidget] Step 1: clicking Article Image/Video →', el.textContent?.trim().slice(0, 50));
    el.click();
    (el.parentElement as HTMLElement)?.click();
  } else {
    console.warn('[KrogerVideoWidget] Step 1: Article Image/Video section not found.');
  }
}

function clickChooseFrom(topDoc: Document): void {
  const btn = findByText(topDoc, 'choose from') || findByText(topDoc, 'choose');
  if (btn) {
    console.info('[KrogerVideoWidget] Step 2: clicking "Choose from" →', btn.textContent?.trim());
    btn.click();
  } else {
    console.warn('[KrogerVideoWidget] Step 2: "Choose from" button not found.');
  }
}

function clickELinksOption(topDoc: Document): void {
  const opt =
    findByText(topDoc, 'elinks',   '[role="menuitem"],[role="option"],li,button,a') ||
    findByText(topDoc, 'url',      '[role="menuitem"],[role="option"],li,button,a') ||
    findByText(topDoc, 'external', '[role="menuitem"],[role="option"],li,button,a') ||
    findByText(topDoc, 'video',    '[role="menuitem"],[role="option"],li,button,a') ||
    findByText(topDoc, 'link',     '[role="menuitem"],[role="option"],li,button,a');
  if (opt) {
    console.info('[KrogerVideoWidget] Step 3: clicking option →', opt.textContent?.trim());
    opt.click();
  } else {
    console.warn('[KrogerVideoWidget] Step 3: ELinks/URL option not found.');
  }
}

// ── Step 4+5: fill input and click Save ────────────────────────────────────

const URL_INPUT_SELECTORS = [
  'input[type="url"]',
  '[data-testid="media-url-input"]',
  '[data-testid="url-input"]',
  '[data-testid="video-url-input"]',
  'input[placeholder*="youtube" i]',
  'input[placeholder*="vimeo" i]',
  'input[placeholder*="https" i]',
  'input[placeholder*="video" i]',
  'input[placeholder*="url" i]',
];

function fillAndSave(topDoc: Document): boolean {
  for (const sel of URL_INPUT_SELECTORS) {
    const el = topDoc.querySelector<HTMLInputElement>(sel);
    if (el) {
      setReactInputValue(el, HARDCODED_YOUTUBE_URL);
      console.info('[KrogerVideoWidget] Step 4: filled input via', sel, '→', HARDCODED_YOUTUBE_URL.slice(0, 50));

      setTimeout(() => {
        const saveBtn =
          findByText(topDoc, 'save',   'button') ||
          findByText(topDoc, 'add',    'button') ||
          findByText(topDoc, 'insert', 'button') ||
          findByText(topDoc, 'ok',     'button');
        if (saveBtn) {
          console.info('[KrogerVideoWidget] Step 5: clicking Save →', saveBtn.textContent?.trim());
          saveBtn.click();
        } else {
          console.warn('[KrogerVideoWidget] Step 5: Save button not found.');
        }
      }, 400);

      return true;
    }
  }
  return false;
}

// MutationObserver catches the "Choose video" input the moment it appears.
let activeObserver: MutationObserver | null = null;

function startObserver(topDoc: Document): void {
  if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }

  const timeout = setTimeout(() => {
    if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
    console.warn('[KrogerVideoWidget] Timed out (20s) waiting for URL input.');
  }, 20000);

  activeObserver = new MutationObserver(() => {
    if (fillAndSave(topDoc)) {
      clearTimeout(timeout);
      if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
    }
  });
  activeObserver.observe(topDoc.body, { childList: true, subtree: true });
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function injectArticleCoverImage(_videoUrl: string, _fallbackThumbnailUrl: string): Promise<void> {
  if (!getTopOrigin()) return;

  let topDoc: Document;
  try { topDoc = (window.top as Window).document; } catch { return; }

  // Step 0: iframely call (makes the hqdefault.jpg fetch appear in Network tab)
  callIframely();

  // Step 0b: if URL input is already open, fill immediately
  if (fillAndSave(topDoc)) return;

  // Start observer BEFORE clicking so we don't miss the dialog
  startObserver(topDoc);

  // Step 1 → 2 → 3: open the dialog
  clickArticleImageSection(topDoc);
  setTimeout(() => clickChooseFrom(topDoc),    600);
  setTimeout(() => clickELinksOption(topDoc), 1200);
  setTimeout(() => clickELinksOption(topDoc), 1900);  // retry
}
