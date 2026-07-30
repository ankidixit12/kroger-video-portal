import React, { useState } from 'react';

function toEmbed(url: string): string {
  try {
    const u = new URL(url);
    const ytId = u.searchParams.get('v');
    if (ytId) return `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`;
    // Disable autoplay for Qumu and other non-YouTube players
    u.searchParams.set('autoplay', 'false');
    return u.toString();
  } catch { return url; }
}

interface Props {
  division: string;
  videotitle: string;
  videourl: string;
}

const S: Record<string, React.CSSProperties> = {
  wrap:        { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: '#f0f4f8', padding: 24, minHeight: 200 },
  card:        { background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.08)', overflow: 'hidden' },
  header:      { padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 },
  ytIcon:      { flexShrink: 0 },
  meta:        { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  badge:       { display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, marginBottom: 2, width: 'fit-content' },
  title:       { fontSize: 15, fontWeight: 600, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  embedWrap:   { position: 'relative', paddingBottom: '56.25%', height: 0, background: '#000' },
  iframe:      { position: 'absolute', inset: 0 as any, width: '100%', height: '100%', border: 'none' },
};

export default function KrogerVideoWidget({ division, videotitle, videourl }: Props) {
  const [iframeError, setIframeError] = useState(false);

  if (!videourl) return null;

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.header}>
          <svg style={S.ytIcon} width="28" height="20" viewBox="0 0 28 20" fill="none">
            <rect width="28" height="20" rx="4" fill="#FF0000"/>
            <path d="M11.5 6l7 4-7 4V6z" fill="#fff"/>
          </svg>
          <div style={S.meta}>
            {division && <span style={S.badge}>{division}</span>}
            <h2 style={S.title}>{videotitle || 'Training Video'}</h2>
          </div>
        </div>
        <div style={S.embedWrap}>
          {iframeError ? (
            <div style={{ position: 'absolute', inset: 0 as any, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#9ca3af', fontSize: 13 }}>
              Video unavailable
            </div>
          ) : (
            <iframe
              style={S.iframe}
              src={toEmbed(videourl)}
              title={videotitle || 'Training Video'}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onError={() => setIframeError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
