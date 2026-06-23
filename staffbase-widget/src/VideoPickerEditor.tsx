import React, { useState, useEffect, useMemo } from 'react';
import { fetchVideos, VideoItem } from './services/videoService';

const PAGE_SIZE = 32;

function getExpiryDate(v: VideoItem): string {
  return (v.withdrawOn || v.expiryDate || '').trim();
}

function isExpired(d: string): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function fmtDate(d: string): string {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
  } catch {
    return d;
  }
}

function isExpiringSoon(d: string): boolean {
  if (!d) return false;
  return (new Date(d).getTime() - Date.now()) / 86400000 < 90;
}

function thumbUrl(v: VideoItem): string {
  if (v.thumbnailUrl) return v.thumbnailUrl;
  return `https://picsum.photos/seed/kroger${v.id}/640/360`;
}

interface Props {
  initialVideoUrl?: string;
  onSelect: (division: string, title: string, url: string, duration: string, expiryDate: string, thumbnailUrl: string) => void;
  onCancel?: () => void;
}

function stop(e: React.SyntheticEvent) { e.stopPropagation(); }

const S: Record<string, React.CSSProperties> = {
  root:       { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background: '#fff', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: '#111827' },
  toolbar:    { display: 'flex', gap: 10, padding: '10px 18px', alignItems: 'center', flexWrap: 'wrap' as any, borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  select:     { appearance: 'none' as any, display: 'inline-block', width: 'calc(25% - 7px)', flexShrink: 0, padding: '7px 32px 7px 12px', border: '1.5px solid #1a3c8f', borderRadius: 8, fontSize: 13, color: '#1a3c8f', fontWeight: 600, background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='%231a3c8f' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E\") no-repeat right 10px center", cursor: 'pointer', boxSizing: 'border-box' as any },
  searchWrap: { position: 'relative' as any, flex: 1 },
  searchInput:{ width: '100%', padding: '7px 14px', border: '1.5px solid #1a3c8f', borderRadius: 8, fontSize: 13, background: '#fff', color: '#111827', boxSizing: 'border-box' as any },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gridAutoRows: '260px', gap: 12, padding: '12px 14px', flex: 1, overflowY: 'auto' as any, minHeight: 0 },
  card:       { border: '1.5px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: '#fff', display: 'flex', flexDirection: 'column' as any, transition: 'border-color 0.15s', overflow: 'hidden', height: '100%' },
  cardSel:    { border: '2px solid #1a3c8f', borderRadius: 8, cursor: 'pointer', background: '#fff', display: 'flex', flexDirection: 'column' as any, overflow: 'hidden', height: '100%' },
  thumbWrap:  { position: 'relative' as any, height: 130, overflow: 'hidden', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 },
  radioRing:  { position: 'absolute' as any, top: 8, left: 8, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: '2px solid #d1d5db', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  radioFill:  { position: 'absolute' as any, top: 8, left: 8, width: 20, height: 20, borderRadius: '50%', background: '#003087', border: '2px solid #003087', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  radioDot:   { width: 7, height: 7, borderRadius: '50%', background: '#fff' },
  playBtn:    { position: 'absolute' as any, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', pointerEvents: 'none' as any },
  playCircle: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' },
  durBadge:   { position: 'absolute' as any, bottom: 6, right: 6, background: 'rgba(0,0,0,0.72)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' as any },
  cardInfo:   { padding: '10px 12px 12px', display: 'flex', flexDirection: 'column' as any, gap: 5, flex: 1, overflow: 'hidden' },
  cardTitle:  { fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.4, display: '-webkit-box' as any, WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden', marginBottom: 2 },
  cardDesc:   { fontSize: 11, color: '#6b7280', lineHeight: 1.4, display: '-webkit-box' as any, WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden', marginBottom: 4 },
  cardSeries: { fontSize: 11, color: '#6b7280', lineHeight: 1.3, marginBottom: 4, whiteSpace: 'nowrap' as any, overflow: 'hidden', textOverflow: 'ellipsis' },
  metaRow:    { display: 'flex', justifyContent: 'space-between', fontSize: 11, lineHeight: 1.4 },
  metaLabel:  { color: '#9ca3af' },
  metaVal:    { fontWeight: 600, color: '#374151' },
  metaExp:    { fontWeight: 600, color: '#dc2626' },
  pagination: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  pgBtn:      { width: 28, height: 28, border: '1.5px solid #d1d5db', borderRadius: '50%', background: '#fff', fontSize: 12, color: '#374151', cursor: 'pointer', padding: 0 },
  pgActive:   { width: 28, height: 28, border: '1.5px solid #003087', borderRadius: '50%', background: '#003087', fontSize: 12, color: '#fff', fontWeight: 700, cursor: 'pointer', padding: 0 },
  footer:     { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 18px 14px', borderTop: '1px solid #e5e7eb', flexShrink: 0 },
  btnCancel:  { padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', border: '1.5px solid #1a3c8f', color: '#1a3c8f', whiteSpace: 'nowrap' as any },
  btnAdd:     { padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#1a3c8f', border: '1.5px solid #1a3c8f', color: '#fff', whiteSpace: 'nowrap' as any },
  btnAddDis:  { padding: '8px 20px', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'default', background: '#074085', border: '1.5px solid #074085', color: '#fff', opacity: 0.5, whiteSpace: 'nowrap' as any },
  centeredState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyBox:   { padding: '48px 20px', textAlign: 'center' as any, color: '#9ca3af', fontSize: 13, display: 'flex', flexDirection: 'column' as any, alignItems: 'center', gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 16777200, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  errorBox:   { padding: '48px 24px', textAlign: 'center' as any, display: 'flex', flexDirection: 'column' as any, alignItems: 'center', gap: 0 },
  errIcon:    { width: 80, height: 80, borderRadius: 16777200, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color: '#ef4444' },
  errTitle:   { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 10 },
  errDesc:    { fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 },
  btnRetry:   { display: 'inline-block', width: 'auto', padding: '10px 32px', borderRadius: 24, border: 'none', background: '#003087', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' as any },
};

export default function VideoPickerEditor({ onSelect, onCancel }: Props) {
  const [videos,   setVideos]   = useState<VideoItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [apiError, setApiError] = useState(false);
  const [filter,   setFilter]   = useState('');   // 'div:Dallas' | 'loc:Midwest' | ''
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [selVideo, setSelVideo]   = useState<VideoItem | null>(null);
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);

  function load() {
    setLoading(true);
    setApiError(false);
    fetchVideos()
      .then(data => { setVideos(data); setLoading(false); })
      .catch(() => { setApiError(true); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [type, val] = filter ? filter.split(':') : ['', ''];
    return videos.filter(v => {
      if (type === 'div' && v.division !== val) return false;
      if (type === 'loc' && v.region   !== val) return false;
      if (q) {
        return (v.title  || '').toLowerCase().includes(q) ||
               (v.series || '').toLowerCase().includes(q) ||
               (v.author || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [videos, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Derive the available Division / Location options from the API response
  // instead of relying on a hardcoded list.
  const divisionOptions = useMemo(
    () => Array.from(new Set(videos.map(v => v.division).filter(Boolean) as string[])).sort(),
    [videos],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(videos.map(v => v.region).filter(Boolean) as string[])).sort(),
    [videos],
  );

  function handleFilterChange(val: string) {
    setFilter(val);
    setSearch('');
    setPage(1);
    setSelVideo(null);
  }

  function handleAdd() {
    if (!selVideo) return;
    onSelect(selVideo.division || '', selVideo.title, selVideo.videoUrl, selVideo.duration || '', getExpiryDate(selVideo), selVideo.thumbnailUrl || '');
  }

  return (
    <div style={S.root} onClick={stop} onMouseDown={stop} onKeyDown={stop} onKeyUp={stop}>

      <div style={S.toolbar}>
        {/* Combined Division / Location filter */}
        <select
          style={S.select}
          value={filter}
          onChange={e => { stop(e); handleFilterChange(e.target.value); }}
          onClick={stop}
          onMouseDown={stop}
        >
          <option value="">All Division and Location</option>
          {divisionOptions.length > 0 && (
            <optgroup label="── Divisions ──">
              {divisionOptions.map(d => <option key={d} value={'div:' + d}>{d}</option>)}
            </optgroup>
          )}
          {locationOptions.length > 0 && (
            <optgroup label="── Locations ──">
              {locationOptions.map(l => <option key={l} value={'loc:' + l}>{l}</option>)}
            </optgroup>
          )}
        </select>

        {/* Search */}
        <div style={S.searchWrap}>
          <input
            type="text"
            placeholder="Search videos…"
            value={search}
            style={S.searchInput}
            onChange={e => { stop(e); setSearch(e.target.value); setPage(1); }}
            onClick={stop}
            onMouseDown={stop}
            onFocus={stop}
            onKeyDown={stop}
            onKeyUp={stop}
          />
        </div>
      </div>

      {loading && (
        <div style={S.centeredState}>
          <div style={S.emptyBox}>Loading videos…</div>
        </div>
      )}

      {!loading && apiError && (
        <div style={S.centeredState}>
          <div style={S.errorBox}>
            <div style={S.errIcon}>
              <svg width="48" height="48" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="13"/>
                <circle cx="12" cy="16.5" r="0.75" fill="#ef4444" stroke="none"/>
              </svg>
            </div>
            <div style={S.errTitle}>Something went wrong</div>
            <div style={S.errDesc}>We're unable to load videos at this time.<br/>Please try again.</div>
            <button style={S.btnRetry} onClick={e => { stop(e); load(); }}>Try Again</button>
          </div>
        </div>
      )}

      {!loading && !apiError && videos.length === 0 && (
        <div style={S.centeredState}>
          <div style={S.emptyBox}>
            <div style={S.emptyIconWrap}>
              <svg width="48" height="48" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
              </svg>
            </div>
            <strong style={{ display: 'block', color: '#374151', fontSize: 15 }}>No videos available</strong>
            <span style={{ fontSize: 13 }}>There are no videos in the library.</span>
          </div>
        </div>
      )}

      <div style={{ ...S.grid, display: !loading && !apiError && videos.length > 0 ? 'grid' : 'none' }}>

        {!loading && !apiError && videos.length > 0 && filtered.length === 0 && (
          <div style={S.emptyBox}>
            <strong style={{ display: 'block', color: '#6b7280', marginBottom: 4 }}>No results found</strong>
            Try a different division, location, or search term.
          </div>
        )}

        {!loading && !apiError && pageItems.map(v => {
          const selected = selVideo?.id === v.id;
          const hovered  = hoveredId === v.id;
          const expiryDate = getExpiryDate(v);
          const expired  = isExpired(expiryDate);
          const expiring = isExpiringSoon(expiryDate);
          const thumb    = thumbUrl(v);

          const cardStyle: React.CSSProperties = selected
            ? { ...S.cardSel, boxShadow: hovered ? '0 4px 16px rgba(26,60,143,0.25)' : 'none' }
            : { ...S.card,    borderColor: hovered ? '#1a3c8f' : '#e5e7eb', boxShadow: hovered ? '0 4px 16px rgba(26,60,143,0.15)' : 'none' };

          return (
            <div
              key={v.id}
              style={cardStyle}
              onClick={() => setSelVideo(v)}
              onMouseEnter={() => setHoveredId(v.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div style={{ ...S.thumbWrap, backgroundImage: `url(${thumb})` }}>
                <div style={selected ? S.radioFill : S.radioRing}>
                  {selected && <div style={S.radioDot} />}
                </div>
                {hovered && (
                  <div style={S.playBtn}>
                    <span style={S.playCircle}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#003087"><path d="M8 5v14l11-7z"/></svg>
                    </span>
                  </div>
                )}
                <span style={S.durBadge}>{v.duration}</span>
              </div>
              <div style={S.cardInfo}>
                <div style={S.cardTitle}>{v.title}</div>
                {v.description && <div style={S.cardDesc}>{v.description}</div>}
                <div style={S.cardSeries}>{v.division ? v.division + (v.region ? ' · ' + v.region : '') : v.series || v.category}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    ['Author',    v.author || '—',                          false],
                    ['Published', fmtDate(v.publishedAt),                   false],
                    ['Expires',   fmtDate(expiryDate), !!(expired || expiring)],
                  ].map(([label, val, red]) => (
                    <div key={label as string} style={S.metaRow}>
                      <span style={S.metaLabel}>{label}</span>
                      <span style={red ? S.metaExp : S.metaVal}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={S.footer}>
        <div style={{ ...S.pagination, marginRight: 'auto' }}>
          <button style={S.pgBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>&#8249;</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button key={n} style={n === page ? S.pgActive : S.pgBtn} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button style={S.pgBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>&#8250;</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={S.btnCancel} onClick={e => { stop(e); onCancel?.(); }}>Cancel</button>
          <button
            style={selVideo ? S.btnAdd : S.btnAddDis}
            disabled={!selVideo}
            onClick={e => { stop(e); handleAdd(); }}
          >Add Video</button>
        </div>
      </div>
    </div>
  );
}
