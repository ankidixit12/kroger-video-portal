import React, { useState } from 'react';
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

function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

function isExpiringSoon(d: string): boolean {
  if (!d) return false;
  return (new Date(d).getTime() - Date.now()) / 86400000 < 90;
}

const S: Record<string, React.CSSProperties> = {
  wrap:       { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },

  /* Empty state */
  emptyBox:   { padding: '40px 24px', textAlign: 'center' as any, display: 'flex', flexDirection: 'column' as any, alignItems: 'center', gap: 6 },
  emptyIcon:  { color: '#d1d5db', marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: '#374151', margin: 0 },
  emptyDesc:  { fontSize: 13, color: '#9ca3af', margin: 0 },
  selectBtn:  { marginTop: 10, padding: '10px 28px', background: '#1a3c8f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },

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

export default function EditorWrapper({ division: _division, videotitle, videourl, videoduration, videoexpiry, videothumb, onSelect }: Props) {
  const [open, setOpen] = useState(false);

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
    <div style={S.wrap} onClick={stop} onMouseDown={stop} onMouseUp={stop} onKeyDown={stop}>

      {videourl ? (
        <div style={S.selectedBody}>
          <div style={S.card}>
            <div style={S.thumbWrap}>
              <img src={thumb} alt="" style={S.thumbImg} />
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
              {videoduration && <span style={S.durBadge}>{videoduration}</span>}
            </div>
            <div style={S.cardInfo}>
              <p style={S.videoTitle}>{videotitle || 'Selected Video'}</p>
              {videoexpiry && (
                <p style={{ ...S.expiryText, color: expiring ? '#d97706' : '#9ca3af' }}>
                  Expires: {fmtDate(videoexpiry)}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={S.emptyBox}>
          <div style={S.emptyIcon}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M10 8l6 4-6 4V8z"/>
            </svg>
          </div>
          <p style={S.emptyTitle}>No video selected</p>
          <p style={S.emptyDesc}>Pick a video from the library to display in this widget.</p>
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
