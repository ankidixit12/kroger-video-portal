/**
 * Injects the video URL into Staffbase's Article Image/Video "Choose video"
 * dialog automatically when a video is selected in the widget editor.
 *
 * Flow Staffbase uses manually:
 *   1. User clicks Article Image/Video section
 *   2. Clicks "Choose from ∨" → dropdown
 *   3. Clicks "ELinks" (External Links) → "Choose video" dialog opens
 *   4. User pastes video URL → Staffbase calls iframely internally → thumbnail set
 *   5. User clicks "Save"
 *
 * We automate steps 1–5.
 */

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

// ── DOM helpers ─────────────────────────────────────────────────────────────

// URL input selectors for the "Choose video" dialog
const URL_INPUT_SELECTORS = [
  'input[type="url"]',
  '[data-testid="content-header-media-url-input"]',
  '[data-testid="article-header-image-url"]',
  '[data-testid="cover-image-url-input"]',
  '[data-testid="media-url-input"]',
  '[data-testid="url-input"]',
  '[data-testid="video-url-input"]',
  'input[name="url"]',
  'input[name="videoUrl"]',
  'input[name="mediaUrl"]',
  'input[placeholder*="youtube" i]',
  'input[placeholder*="vimeo" i]',
  'input[placeholder*="video" i]',
  'input[placeholder*="url" i]',
  'input[placeholder*="https" i]',
];

function findByText(
  topDoc: Document,
  query: string,
  tag = 'button, [role="button"], [role="menuitem"], [role="option"], li, a, span'
): HTMLElement | null {
  const q = query.toLowerCase();
  const candidates = Array.from(topDoc.querySelectorAll<HTMLElement>(tag));
  const exact = candidates.find(el => el.textContent?.trim().toLowerCase() === q);
  if (exact) return exact;
  return candidates.find(el => {
    const t = el.textContent?.trim().toLowerCase() || '';
    return t.includes(q) && t.length < 50;
  }) || null;
}

// Fill the URL input with the video URL, then click Save.
function fillAndSave(topDoc: Document, videoUrl: string): boolean {
  for (const sel of URL_INPUT_SELECTORS) {
    const el = topDoc.querySelector<HTMLInputElement>(sel);
    if (el) {
      setReactInputValue(el, videoUrl);
      console.info('[KrogerVideoWidget] ✅ Filled "Choose video" input with video URL:', videoUrl.slice(0, 60));

      // Click Save after a short delay to let React process the input change
      setTimeout(() => {
        const saveBtn =
          findByText(topDoc, 'save',   'button') ||
          findByText(topDoc, 'add',    'button') ||
          findByText(topDoc, 'insert', 'button') ||
          findByText(topDoc, 'ok',     'button');
        if (saveBtn) {
          console.info('[KrogerVideoWidget] Clicking Save →', saveBtn.textContent?.trim());
          saveBtn.click();
        } else {
          console.warn('[KrogerVideoWidget] Save button not found — fill was successful but user must click Save manually.');
        }
      }, 400);

      return true;
    }
  }
  return false;
}

// ── Multi-step click chain ─────────────────────────────────────────────────

function stepClickArticleImageSection(topDoc: Document): void {
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
    console.info('[KrogerVideoWidget] Step 1: clicking Article Image/Video →', el.textContent?.trim()?.slice(0, 60));
    el.click();
    (el.parentElement as HTMLElement)?.click();
  } else {
    console.warn('[KrogerVideoWidget] Step 1: section not found — relying on MutationObserver.');
  }
}

function stepClickChooseFrom(topDoc: Document): void {
  const btn = findByText(topDoc, 'choose from') || findByText(topDoc, 'choose');
  if (btn) {
    console.info('[KrogerVideoWidget] Step 2: clicking "Choose from" →', btn.textContent?.trim());
    btn.click();
  } else {
    console.warn('[KrogerVideoWidget] Step 2: "Choose from" button not found. Visible buttons:');
    Array.from(topDoc.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .filter(el => el.getBoundingClientRect().width > 0)
      .forEach((el, i) => console.info(`  btn[${i}]:`, el.textContent?.trim()));
  }
}

function stepClickVideoUrlOption(topDoc: Document): void {
  // Look for ELinks / URL / External / Video option in the dropdown
  const opt =
    findByText(topDoc, 'elinks',    '[role="menuitem"],[role="option"],li,button,a') ||
    findByText(topDoc, 'url',       '[role="menuitem"],[role="option"],li,button,a') ||
    findByText(topDoc, 'external',  '[role="menuitem"],[role="option"],li,button,a') ||
    findByText(topDoc, 'video',     '[role="menuitem"],[role="option"],li,button,a') ||
    findByText(topDoc, 'link',      '[role="menuitem"],[role="option"],li,button,a') ||
    findByText(topDoc, 'by url',    '[role="menuitem"],[role="option"],li,button,a');

  if (opt) {
    console.info('[KrogerVideoWidget] Step 3: clicking video URL option →', opt.textContent?.trim());
    opt.click();
  } else {
    console.warn('[KrogerVideoWidget] Step 3: video URL option not found. Visible menu items:');
    Array.from(topDoc.querySelectorAll<HTMLElement>('[role="menuitem"],[role="option"],li'))
      .filter(el => el.getBoundingClientRect().width > 0)
      .forEach((el, i) => console.info(`  item[${i}]:`, el.textContent?.trim()));
  }
}

// ── MutationObserver ───────────────────────────────────────────────────────

let activeObserver: MutationObserver | null = null;

function startWatching(videoUrl: string, topDoc: Document): void {
  if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }

  const done = (): void => {
    if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
  };

  const timeout = setTimeout(() => {
    done();
    console.warn('[KrogerVideoWidget] Timed out waiting for URL input. All inputs:');
    Array.from(topDoc.querySelectorAll<HTMLInputElement>('input')).forEach((el, i) => {
      console.info(`  input[${i}]:`, { id: el.id, type: el.type, name: el.name, placeholder: el.placeholder, 'data-testid': el.dataset['testid'] });
    });
  }, 20000);

  activeObserver = new MutationObserver(() => {
    if (fillAndSave(topDoc, videoUrl)) {
      clearTimeout(timeout);
      done();
    }
  });
  activeObserver.observe(topDoc.body, { childList: true, subtree: true, attributes: true });
  console.info('[KrogerVideoWidget] Watching for URL input to appear...');
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function injectArticleCoverImage(videoUrl: string, _fallbackThumbnailUrl: string): Promise<void> {
  if (!videoUrl) return;

  // Use the origin check as a sanity guard
  if (!getTopOrigin()) return;

  let topDoc: Document;
  try { topDoc = (window.top as Window).document; } catch { return; }

  // Step 0: try immediately (dialog might already be open)
  if (fillAndSave(topDoc, videoUrl)) return;

  // Start watching before clicking so we don't miss the dialog appearing
  startWatching(videoUrl, topDoc);

  // Step 1 (0ms): click Article Image/Video section → drag-drop panel opens
  stepClickArticleImageSection(topDoc);

  // Step 2 (600ms): click "Choose from ∨" → dropdown appears
  setTimeout(() => stepClickChooseFrom(topDoc), 600);

  // Step 3 (1200ms): click "ELinks"/"URL" option → "Choose video" dialog opens
  setTimeout(() => stepClickVideoUrlOption(topDoc), 1200);
  // Retry step 3 in case dropdown animation hasn't finished
  setTimeout(() => stepClickVideoUrlOption(topDoc), 1900);

  // Polling fallback every 700ms for 15s
  let polls = 0;
  const poll = setInterval(() => {
    polls++;
    if (fillAndSave(topDoc, videoUrl) || polls >= 22) clearInterval(poll);
  }, 700);
}
