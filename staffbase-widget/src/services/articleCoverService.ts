/**
 * On video selection:
 *   1. Calls Staffbase's iframely endpoint with the hardcoded YouTube URL.
 *   2. Fetches the resolved thumbnail URL (hqdefault.jpg) — visible in Network tab.
 *
 * No auto-clicking or DOM manipulation.
 */

function topFetch(input: string, init?: RequestInit): Promise<Response> {
  try { return (window.top as Window).fetch(input, init); }
  catch { return fetch(input, init); }
}

function getTopOrigin(): string {
  try { return (window.top as Window).location.origin; } catch { return ''; }
}

const HARDCODED_YOUTUBE_URL = 'https://www.youtube.com/watch?v=62XccJOh9Lg&list=RD62XccJOh9Lg&start_radio=1';

export async function injectArticleCoverImage(_videoUrl: string, _fallbackThumbnailUrl: string): Promise<void> {
  const origin = getTopOrigin();
  if (!origin) return;

  try {
    // Step 1: call iframely with the YouTube URL
    const encoded = encodeURIComponent(HARDCODED_YOUTUBE_URL);
    const iframelyUrl = `${origin}/api/iframely?url=${encoded}&nowrap=on&callback=`;
    console.info('[KrogerVideoWidget] Calling iframely:', iframelyUrl);

    const res = await topFetch(iframelyUrl, { credentials: 'include' });
    if (!res.ok) { console.warn('[KrogerVideoWidget] iframely returned', res.status); return; }

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); }
    catch {
      const stripped = text.replace(/^\s*\w+\s*\(/, '').replace(/\)\s*;?\s*$/, '');
      data = JSON.parse(stripped);
    }

    const thumb: string | null =
      data?.links?.thumbnail?.[0]?.href ||
      data?.links?.icon?.[0]?.href      ||
      data?.meta?.thumbnail_url         ||
      data?.thumbnail_url               ||
      null;

    console.info('[KrogerVideoWidget] iframely thumbnail:', thumb);

    // Step 2: fetch the thumbnail URL so it appears in the Network tab
    if (thumb) {
      await fetch(thumb);
      console.info('[KrogerVideoWidget] Thumbnail fetched:', thumb);
    }
  } catch (e) {
    console.warn('[KrogerVideoWidget] Error:', e);
  }
}
