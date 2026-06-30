import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import VideoPickerEditor from './VideoPickerEditor';

interface Props {
  division:      string;
  videotitle:    string;
  videourl:      string;
  videoduration: string;
  videoexpiry:   string;
  videothumb:    string;
  onSelect: (division: string, title: string, url: string, duration: string, expiryDate: string, thumbnailUrl: string) => void;
}

function stop(e: React.SyntheticEvent) { e.stopPropagation(); }

function pad2(n: number): string { return n < 10 ? '0' + n : String(n); }

function fmtDate(d: string): string {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return pad2(dt.getMonth() + 1) + '/' + pad2(dt.getDate()) + '/' + dt.getFullYear();
  } catch {
    return d;
  }
}

function isExpiringSoon(d: string): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now();
}

const S: Record<string, React.CSSProperties> = {
  wrap:       { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },

  /* Empty state */
  emptyBox:   { padding: '16px 20px', display: 'flex', flexDirection: 'row' as any, alignItems: 'center', gap: 16, border: '1.5px dashed #d1d5db', borderRadius: 8, background: '#fff' },
  emptyIcon:  { flexShrink: 0, width: 'min(128px, 30%)', height: 80, background: 'linear-gradient(135deg, #C9CACB 0%, #747474 100%)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  emptyText:  { flex: 1 },
  emptyTitle: { fontFamily: 'Inter, sans-serif', fontSize: 16, fontStyle: 'normal', fontWeight: 600, lineHeight: '24px', letterSpacing: '-0.312px', color: '#364153', margin: 0 },
  emptyDesc:  { fontFamily: 'Inter, sans-serif', fontSize: 14, fontStyle: 'normal', fontWeight: 400, lineHeight: '20px', letterSpacing: '-0.15px', color: '#6A7282', margin: '2px 0 0' },
  selectBtn:  { flexShrink: 0, padding: '9px 20px', background: '#074085', color: '#fff', border: 'none', borderRadius: 5, fontSize: 14, fontWeight: 600, cursor: 'pointer' },

  /* Selected state — card */
  selectedBody: { padding: '16px' },
  card:         { borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.1)' },
  thumbWrap:    { position: 'relative' as any, width: '100%', paddingBottom: '56.25%', background: '#1a3c8f' },
  thumbImg:     { position: 'absolute' as any, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as any, display: 'block' },
  actionBtns:   { position: 'absolute' as any, top: 8, right: 8, display: 'flex', flexDirection: 'column' as any, gap: 6, zIndex: 2 },
  iconBtn:      { width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.95)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#374151', boxShadow: '0 1px 6px rgba(0,0,0,0.18)' },
  durBadge:     { position: 'absolute' as any, bottom: 8, right: 8, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '3px 8px', borderRadius: 4 },
  cardInfo:     { padding: '10px 12px 12px' },
  videoTitle:   { fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px', lineHeight: 1.3 },
  expiryText:   { fontSize: 13, fontWeight: 600, margin: 0 },

  /* Modal */
  backdrop:   { position: 'fixed' as any, inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal:      { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 1100, height: '96vh', display: 'flex', flexDirection: 'column' as any, overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.35)' },
  modalHdr:   { display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 },
  modalTtl:   { fontSize: 15, fontWeight: 700, color: '#111827', flex: 1 },
  closeBtn:   { width: 28, height: 28, border: 'none', background: 'transparent', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: '#6b7280', borderRadius: 6 },
  modalBody:  { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' as any },
};

export default function EditorWrapper({ division: _division, videotitle, videourl, videoduration: _videoduration, videoexpiry, videothumb, onSelect }: Props) {
  const [open, setOpen]       = useState(false);
  const [hovered, setHovered] = useState(false);
  const [cardWidth, setCardWidth] = useState<number | null>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const dragRef  = useRef<{ startX: number; startW: number } | null>(null);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { startX: e.clientX, startW: rect.width };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const newW = Math.max(220, dragRef.current.startW + (ev.clientX - dragRef.current.startX));
      setCardWidth(newW);
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove, { capture: true });
      document.removeEventListener('mouseup',   onUp,   { capture: true });
    }
    document.addEventListener('mousemove', onMove, { capture: true });
    document.addEventListener('mouseup',   onUp,   { capture: true });
  }, []);

  function handleSelect(d: string, t: string, u: string, dur: string, exp: string, th: string) {
    onSelect(d, t, u, dur, exp, th);
    setOpen(false);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect('', '', '', '', '', '');
  }

  const thumb = videothumb || `https://picsum.photos/seed/kroger${encodeURIComponent(videotitle || 'default')}/640/360`;
  const expiring = isExpiringSoon(videoexpiry);

  return (
    <div
      ref={wrapRef}
      style={{ ...S.wrap, ...(cardWidth ? { width: cardWidth } : {}), position: 'relative' }}
      onClick={stop} onMouseDown={stop} onMouseUp={stop} onKeyDown={stop}
    >

      {videourl ? (
        <>
        <div style={S.selectedBody}>
          <div
            style={{ ...S.card, border: hovered ? '2px solid #1a3c8f' : '2px solid transparent', transition: 'border-color 0.15s', boxShadow: hovered ? '0 4px 16px rgba(26,60,143,0.2)' : '0 1px 6px rgba(0,0,0,0.1)' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div style={S.thumbWrap}>
              <img src={thumb} alt="" style={S.thumbImg} />
              {hovered && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.18)', zIndex: 1 }}>
                  <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#003087"><path d="M8 5v14l11-7z"/></svg>
                  </span>
                </div>
              )}
              <div style={S.actionBtns}>
                <button style={S.iconBtn} title="Change video" onClick={e => { stop(e); if (!open) setOpen(true); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                </button>
                <button style={S.iconBtn} title="Remove video" onClick={handleDelete}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
            <div style={S.cardInfo}>
              <p style={S.videoTitle}>{videotitle || 'Selected Video'}</p>
              {videoexpiry && (
                expiring ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #FEE685', borderRadius: 4, paddingTop: 0, paddingBottom: 0, paddingLeft: 1, paddingRight: 3, background: '#FFFBEB', marginTop: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d97706', flexShrink: 0 }} />
                    <span style={{ color: '#d97706', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const }}>Expiring soon</span>
                    <span style={{ color: '#d97706', fontSize: 11, fontWeight: 600 }}>{fmtDate(videoexpiry)}</span>
                  </span>
                ) : (
                  <p style={{ ...S.expiryText, color: '#9ca3af' }}>
                    Expires: {fmtDate(videoexpiry)}
                  </p>
                )
              )}
            </div>
          </div>
        </div>

        {/* Resize handle */}
        <div
          title="Drag to resize"
          onMouseDown={onResizeStart}
          style={{
            position: 'absolute', bottom: 4, right: 4,
            width: 18, height: 18, cursor: 'se-resize', zIndex: 20,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M9 1L1 9M9 5L5 9M9 9H9" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        </>
      ) : (
        <div style={S.emptyBox}>
          <div style={S.emptyIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,4 20,12 6,20"/>
            </svg>
          </div>
          <div style={S.emptyText}>
            <p style={S.emptyTitle}>No video selected</p>
            <p style={S.emptyDesc}>Click the button to choose a training video.</p>
          </div>
          <button style={S.selectBtn} onClick={e => { stop(e); if (!open) setOpen(true); }}>
            Select Video
          </button>
        </div>
      )}

      {open && createPortal(
        <div style={S.backdrop} onClick={e => { stop(e); setOpen(false); }} onMouseDown={stop} onKeyDown={stop}>
          <div style={S.modal} onClick={stop} onMouseDown={stop} onKeyDown={stop}>
            <div style={S.modalHdr}>
              <span style={S.modalTtl}>Select a Video</span>
              <button style={S.closeBtn} onClick={e => { stop(e); setOpen(false); }}>×</button>
            </div>
            <div style={S.modalBody}>
              <VideoPickerEditor
                initialVideoUrl={videourl}
                onSelect={handleSelect}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </div>,
        (() => { try { return (window.top as Window).document.body; } catch { return document.body; } })()
      )}
    </div>
  );
}
