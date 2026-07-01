import React, { useState, useEffect, useRef } from 'react';
import {
  fetchVideos,
  fetchVideosByFilter,
  fetchMasterData,
  VideoItem,
  MetadataType,
  PlaylistRule,
  FetchResult,
} from './services/videoService';
import searchIcon from '../../public/assets/searchicon.svg';

const PAGE_SIZE = 10;
const CARD_HEIGHT = '290px';

function getExpiryDate(v: VideoItem): string {
  return (v.withdrawOn || v.expiryDate || '').trim();
}

function isExpired(d: string): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function pad2(n: number): string { return n < 10 ? '0' + n : String(n); }

function fmtDate(d: string): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return pad2(dt.getMonth() + 1) + '/' + pad2(dt.getDate()) + '/' + dt.getFullYear();
  } catch { return d; }
}

function isExpiringSoon(d: string): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now();
}

function thumbUrl(v: VideoItem): string {
  if (v.thumbnailUrl) return v.thumbnailUrl;
  return `https://picsum.photos/seed/kroger${v.id}/640/360`;
}

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const result: (number | '...')[] = [1];
  if (current > 3) result.push('...');
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  for (let i = lo; i <= hi; i++) result.push(i);
  if (current < total - 2) result.push('...');
  result.push(total);
  return result;
}

interface Props {
  initialVideoUrl?: string;
  onSelect: (division: string, title: string, url: string, duration: string, expiryDate: string, thumbnailUrl: string) => void;
  onCancel?: () => void;
}

function stop(e: React.SyntheticEvent) { e.stopPropagation(); }

const S: Record<string, React.CSSProperties> = {
  root:        { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background: '#fff', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: '#111827' },
  toolbar:     { display: 'flex', gap: 10, padding: '10px 18px', alignItems: 'center', flexWrap: 'wrap' as any, borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  select:      { appearance: 'none' as any, display: 'inline-block', width: 'calc((100% - 64px) / 4)', flexShrink: 0, padding: '7px 28px 7px 12px', border: '2px solid #074085', borderRadius: 10, fontSize: 13, color: '#1a3c8f', fontWeight: 600, background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='%231a3c8f' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E\") no-repeat right 10px center", cursor: 'pointer', boxSizing: 'border-box' as any, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as any },
  searchWrap:  { position: 'relative' as any, flex: 1 },
  searchIcon:  { position: 'absolute' as any, left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' as any, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  searchInput: { width: '100%', padding: '7px 14px 7px 36px', border: '2px solid #074085', borderRadius: 10, fontSize: 13, background: '#fff', color: '#111827', boxSizing: 'border-box' as any },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gridAutoRows: CARD_HEIGHT, gap: 12, padding: '12px 14px', flex: 1, overflowY: 'auto' as any, minHeight: 0 },
  card:        { border: '1.5px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: '#fff', display: 'flex', flexDirection: 'column' as any, transition: 'border-color 0.15s', overflow: 'hidden', height: CARD_HEIGHT },
  cardSel:     { border: '2px solid #1a3c8f', borderRadius: 8, cursor: 'pointer', background: '#fff', display: 'flex', flexDirection: 'column' as any, overflow: 'hidden', height: '100%' },
  thumbWrap:   { position: 'relative' as any, height: 160, overflow: 'hidden', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 },
  radioRing:   { position: 'absolute' as any, top: 8, left: 8, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: '2px solid #d1d5db', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  radioFill:   { position: 'absolute' as any, top: 8, left: 8, width: 20, height: 20, borderRadius: '50%', background: '#003087', border: '2px solid #003087', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  radioDot:    { width: 7, height: 7, borderRadius: '50%', background: '#fff' },
  playBtn:     { position: 'absolute' as any, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', pointerEvents: 'none' as any },
  playCircle:  { width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' },
  durBadge:    { position: 'absolute' as any, bottom: 6, right: 6, background: 'rgba(0,0,0,0.72)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' as any },
  wdBadge:     { position: 'absolute' as any, top: 6, right: 6, background: 'rgba(185,28,28,0.9)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em', pointerEvents: 'none' as any },
  cardInfo:    { padding: '12px', display: 'flex', flexDirection: 'column' as any, gap: 5, flex: 1, overflow: 'hidden' },
  cardTitle:   { fontSize: 12, fontWeight: 700, color: '#1E2939', lineHeight: '16px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginBottom: 2, fontFamily: 'Inter, sans-serif' },
  cardDesc:    { fontSize: 12, fontWeight: 400, color: '#4A5565', lineHeight: 1.4, display: '-webkit-box' as any, WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden', marginBottom: 4, fontFamily: 'Inter, sans-serif' },
  cardMeta:    { fontSize: 11, color: '#6b7280', lineHeight: 1.3, marginBottom: 4, whiteSpace: 'nowrap' as any, overflow: 'hidden', textOverflow: 'ellipsis' },
  metaRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 16, lineHeight: '16px' },
  metaLabel:   { color: '#6A7282', fontFamily: 'Inter, sans-serif', fontSize: 12, fontStyle: 'normal', fontWeight: 400, lineHeight: '16px' },
  metaVal:     { color: '#1E2939', fontFamily: 'Inter, sans-serif', fontSize: 12, fontStyle: 'normal', fontWeight: 500, lineHeight: '16px' },
  metaExp:     { color: '#1E2939', fontFamily: 'Inter, sans-serif', fontSize: 12, fontStyle: 'normal', fontWeight: 500, lineHeight: '16px' },
  pagination:  { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  pgBtn:       { width: 28, height: 28, border: 'none', borderRadius: '50%', background: '#fff', fontSize: 12, color: '#374151', cursor: 'pointer', padding: 0 },
  pgActive:    { width: 28, height: 28, border: '1.5px solid #003087', borderRadius: '50%', background: '#003087', fontSize: 12, color: '#fff', fontWeight: 700, cursor: 'pointer', padding: 0 },
  pgEllipsis:  { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9ca3af' },
  footer:      { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 18px 14px', borderTop: '1px solid #e5e7eb', flexShrink: 0 },
  btnCancel:   { padding: '8.5px 15.922px 7.5px 15px', borderRadius: 5, fontSize: 14, fontWeight: 500, cursor: 'pointer', background: '#fff', border: '1.5px solid #1a3c8f', color: '#1a3c8f', whiteSpace: 'nowrap' as any },
  btnAdd:      { padding: '8.5px 15.922px 7.5px 15px', borderRadius: 5, fontSize: 14, fontWeight: 500, cursor: 'pointer', background: '#074085', border: '1.5px solid #074085', color: '#fff', whiteSpace: 'nowrap' as any },
  btnAddDis:   { padding: '8.5px 15.922px 7.5px 15px', borderRadius: 5, fontSize: 14, fontWeight: 500, cursor: 'default', background: '#074085', border: '1.5px solid #074085', color: '#fff', opacity: 0.5, whiteSpace: 'nowrap' as any },
  centeredState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyBox:    { padding: '48px 20px', textAlign: 'center' as any, color: '#9ca3af', fontSize: 13, display: 'flex', flexDirection: 'column' as any, alignItems: 'center', gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 16777200, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  errorBox:    { padding: '48px 24px', textAlign: 'center' as any, display: 'flex', flexDirection: 'column' as any, alignItems: 'center', gap: 0 },
  errIcon:     { width: 80, height: 80, borderRadius: 16777200, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color: '#ef4444' },
  errTitle:    { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 10 },
  errDesc:     { fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 },
  btnRetry:    { display: 'inline-block', width: 'auto', padding: '10px 32px', borderRadius: 24, border: 'none', background: '#074085', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' as any },
  loadOverlay: { position: 'absolute' as any, inset: 0, background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontSize: 13, color: '#6b7280' },
};

export default function VideoPickerEditor({ onSelect, onCancel }: Props) {
  const [videos,    setVideos]    = useState<VideoItem[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [apiError,  setApiError]  = useState(false);
  const [offset,    setOffset]    = useState(0);

  // Search state
  const [inputValue, setInputValue] = useState('');
  const [search,     setSearch]     = useState('');

  // Master data for filter dropdowns
  const [metaTypes,  setMetaTypes]  = useState<MetadataType[]>([]);
  const metaRef = useRef<MetadataType[]>([]);

  // Filter selections (option guids — '' means no filter)
  const [divOptGuid, setDivOptGuid] = useState('');

  const [selVideo,   setSelVideo]   = useState<VideoItem | null>(null);
  const [hoveredId,  setHoveredId]  = useState<string | number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadId = useRef(0);

  // Keep ref in sync so the load effect can read latest meta without it being a dep
  useEffect(() => { metaRef.current = metaTypes; }, [metaTypes]);

  // Fetch master data (Division) once on mount
  useEffect(() => {
    fetchMasterData(['Division'])
      .then(types => setMetaTypes(types))
      .catch(() => {/* non-critical — dropdown stays empty */});
  }, []);

  // Main load effect — fires on offset / search / filter / retry changes
  useEffect(() => {
    const id = ++loadId.current;
    setLoading(true);
    setApiError(false);

    const divMeta = metaRef.current.find(m => m.title === 'Division');

    const rules: PlaylistRule[] = [];
    if (divOptGuid && divMeta) {
      const parts    = divOptGuid.split('|');
      const optGuid  = parts[0] || '';
      const optValue = parts[1] || '';
      if (optGuid) rules.push({ fieldGuid: divMeta.guid, fieldTitle: 'Division', optionGuid: optGuid, optionValue: optValue });
    }

    const promise: Promise<FetchResult> = rules.length > 0
      ? fetchVideosByFilter({ offset, limit: PAGE_SIZE, rules }).catch(err => {
          // Filter POST requires a session cookie not available on localhost.
          // Fall back to unfiltered list so local dev stays usable.
          console.warn('[KrogerWidget] Division filter unavailable (likely no session cookie on localhost):', String(err));
          return fetchVideos({ offset, limit: PAGE_SIZE });
        })
      : fetchVideos({ offset, limit: PAGE_SIZE, search: search || undefined });

    promise
      .then(result => {
        if (id !== loadId.current) return;
        setVideos(result.items);
        setTotal(result.total);
        setLoading(false);
      })
      .catch(() => {
        if (id !== loadId.current) return;
        setApiError(true);
        setLoading(false);
      });
  }, [offset, search, divOptGuid, retryCount]);

  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const divisionMeta = metaTypes.find(m => m.title === 'Division');

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSearch(val: string) {
    setInputValue(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearch(val);
      setOffset(0);
      setSelVideo(null);
      if (val) { setDivOptGuid(''); } // search clears filter
    }, 300);
  }

  function handleDivisionChange(optGuid: string) {
    setDivOptGuid(optGuid);
    setOffset(0);
    setSelVideo(null);
    if (optGuid) { setSearch(''); setInputValue(''); } // filter clears search
  }

  function goToPage(page: number) {
    setOffset((page - 1) * PAGE_SIZE);
    setSelVideo(null);
  }

  function handleAdd() {
    if (!selVideo) return;
    onSelect(
      selVideo.division || '',
      selVideo.title,
      selVideo.videoUrl,
      selVideo.duration || '',
      getExpiryDate(selVideo),
      selVideo.thumbnailUrl || '',
    );
  }

  const hasVideos = !loading && !apiError && videos.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={S.root} onClick={stop} onMouseDown={stop} onKeyDown={stop} onKeyUp={stop}>

      {/* ── Toolbar ── */}
      <div style={S.toolbar}>

        {/* Division dropdown */}
        <select
          style={S.select}
          value={divOptGuid}
          onChange={e => { stop(e); handleDivisionChange(e.target.value); }}
          onClick={stop}
          onMouseDown={stop}
        >
          <option value="">All Divisions/Locations</option>
          {(divisionMeta?.options || [])
            .filter(opt => opt.value !== 'All Divisions/Locations')
            .map(opt => (
              <option key={opt.guid} value={`${opt.guid}|${opt.value}`}>{opt.value}</option>
            ))}
        </select>

        {/* Search */}
        <div style={S.searchWrap}>
          <span style={S.searchIcon} aria-hidden="true">
            <img src={searchIcon} alt="" width={16} height={16} />
          </span>
          <input
            type="text"
            placeholder="Search by title…"
            value={inputValue}
            style={S.searchInput}
            onChange={e => { stop(e); handleSearch(e.target.value); }}
            onClick={stop}
            onMouseDown={stop}
            onFocus={stop}
            onKeyDown={stop}
            onKeyUp={stop}
          />
        </div>
      </div>

      {/* ── Loading (initial) ── */}
      {loading && videos.length === 0 && (
        <div style={S.centeredState}>
          <div style={S.emptyBox}>Loading videos…</div>
        </div>
      )}

      {/* ── Error state ── */}
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
            <button style={S.btnRetry} onClick={e => { stop(e); setRetryCount(c => c + 1); }}>Try Again</button>
          </div>
        </div>
      )}

      {/* ── Empty library ── */}
      {!loading && !apiError && videos.length === 0 && (
        <div style={S.centeredState}>
          <div style={S.emptyBox}>
            <div style={S.emptyIconWrap}>
              <svg width="48" height="48" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
              </svg>
            </div>
            <strong style={{ display: 'block', color: '#374151', fontSize: 15 }}>No videos available</strong>
            <span style={{ fontSize: 13 }}>Try a different search or filter.</span>
          </div>
        </div>
      )}

      {/* ── Video grid ── */}
      {(hasVideos || (loading && videos.length > 0)) && (
        <div style={{ ...S.grid, position: 'relative' as any }}>
          {/* Loading overlay while paginating (keeps previous cards visible) */}
          {loading && (
            <div style={S.loadOverlay}>Loading…</div>
          )}

          {videos.map(v => {
            const selected   = selVideo?.id === v.id;
            const hovered    = hoveredId === v.id;
            const expiryDate = getExpiryDate(v);
            const expired    = isExpired(expiryDate);
            const expiring   = isExpiringSoon(expiryDate);
            const thumb      = thumbUrl(v);
            const withdrawn  = v.state === 'WITHDRAWN';

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
                  {withdrawn && <span style={S.wdBadge}>WITHDRAWN</span>}
                  <span style={S.durBadge}>{v.duration}</span>
                </div>

                <div style={S.cardInfo}>
                  <div style={S.cardTitle}>{v.title}</div>
                  {v.description && <div style={S.cardDesc}>{v.description}</div>}
                  <div style={S.cardMeta}>
                    {[v.division, v.category].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {([
                      ['Author',    v.author || '—'],
                      ['Published', fmtDate(v.publishedAt)],
                    ] as [string, string][]).map(([label, val]) => (
                      <div key={label} style={S.metaRow}>
                        <span style={S.metaLabel}>{label}</span>
                        <span style={S.metaVal}>{val}</span>
                      </div>
                    ))}
                    <div style={S.metaRow}>
                      <span style={S.metaLabel}>Expires</span>
                      {expired ? (
                        <span style={S.metaExp}>{fmtDate(expiryDate)}</span>
                      ) : expiring ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #FEE685', borderRadius: 4, paddingTop: 0, paddingBottom: 0, paddingLeft: '4px', paddingRight: 0, background: '#FFFBEB' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FE9A00', flexShrink: 0 }} />
                          <span style={{ color: '#BB4D00', fontSize: '12px', fontWeight: 500, marginRight:"10px", whiteSpace: 'nowrap' as const }}>Expiring soon</span>
                          <span style={{ color: '#E17100', fontSize: '12px', fontWeight: 500 }}>{fmtDate(expiryDate)}</span>
                        </span>
                      ) : (
                        <span style={S.metaVal}>{fmtDate(expiryDate)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer / pagination ── */}
      <div style={S.footer}>
        <div style={{ ...S.pagination, marginRight: 'auto' }}>
          {/* Prev */}
          <button
            style={S.pgBtn}
            disabled={currentPage === 1}
            onClick={() => goToPage(currentPage - 1)}
          >&#8249;</button>

          {/* Page number buttons with ellipsis */}
          {getPageRange(currentPage, totalPages).map((p, i) =>
            p === '...'
              ? <span key={'e' + i} style={S.pgEllipsis}>…</span>
              : <button
                  key={p}
                  style={p === currentPage ? S.pgActive : S.pgBtn}
                  onClick={() => goToPage(p as number)}
                >{p}</button>
          )}

          {/* Next */}
          <button
            style={S.pgBtn}
            disabled={currentPage === totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >&#8250;</button>

          <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>
            {total} video{total !== 1 ? 's' : ''}
          </span>
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
