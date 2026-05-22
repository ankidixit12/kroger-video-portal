import React, { useState, useMemo } from 'react';
import { DIVISIONS, DIVISION_VIDEOS, VideoEntry } from './videoData';

const PAGE_SIZE = 6;
const TODAY = new Date().toISOString().slice(0, 10);

function thumbUrl(url: string): string {
  try {
    const id = new URL(url).searchParams.get('v');
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
  } catch { return ''; }
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

interface Props {
  initialDivision?: string;
  initialVideoUrl?: string;
  onSelect: (division: string, title: string, url: string) => void;
}

const S: Record<string, React.CSSProperties> = {
  root:       { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background: '#fff', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 520, color: '#111827' },
  pageTitle:  { fontSize: 20, fontWeight: 700, color: '#111827', padding: '18px 20px 0' },
  toolbar:    { display: 'flex', gap: 10, padding: '14px 20px', alignItems: 'center', flexWrap: 'wrap' as any },
  selectWrap: { position: 'relative' as any },
  select:     { appearance: 'none' as any, padding: '8px 32px 8px 14px', border: '1.5px solid #1a3c8f', borderRadius: 20, fontSize: 13, color: '#1a3c8f', fontWeight: 600, background: '#fff', cursor: 'pointer', minWidth: 180 },
  searchWrap: { position: 'relative' as any, flex: 1 },
  searchIcon: { position: 'absolute' as any, right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' as any, display: 'flex', alignItems: 'center' },
  searchInput:{ width: '100%', padding: '8px 36px 8px 14px', border: '1.5px solid #1a3c8f', borderRadius: 20, fontSize: 13, background: '#fff', color: '#111827', boxSizing: 'border-box' as any },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '0 20px', flex: 1, overflowY: 'auto' as any },
  card:       { border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: '#fff', position: 'relative' as any, transition: 'border-color 0.15s' },
  cardSel:    { border: '2px solid #1a3c8f', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: '#fff', position: 'relative' as any },
  radioRing:  { position: 'absolute' as any, top: 8, left: 8, width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.15)', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  radioFill:  { position: 'absolute' as any, top: 8, left: 8, width: 20, height: 20, borderRadius: '50%', background: '#1a3c8f', border: '2px solid #1a3c8f', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  radioDot:   { width: 8, height: 8, borderRadius: '50%', background: '#fff' },
  thumb:      { width: '100%', aspectRatio: '16/9', objectFit: 'cover' as any, display: 'block', background: '#1a3c8f' },
  thumbFail:  { width: '100%', aspectRatio: '16/9', background: 'linear-gradient(135deg,#1a3c8f,#3b5fc0)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardBody:   { padding: '10px 12px' },
  cardMeta:   { display: 'flex', flexDirection: 'column' as any, gap: 0 },
  cardTitle:  { fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2, lineHeight: 1.3 },
  cardSeries: { fontSize: 11, color: '#6b7280', marginBottom: 8 },
  metaRow:    { display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 },
  metaLabel:  { color: '#9ca3af' },
  metaVal:    { fontWeight: 600, color: '#374151' },
  metaExp:    { fontWeight: 600, color: '#dc2626' },
  emptyBox:   { gridColumn: '1/-1', padding: '48px 20px', textAlign: 'center' as any, color: '#9ca3af', fontSize: 13 },
  pagination: { display: 'flex', alignItems: 'center', gap: 4, padding: '12px 20px' },
  pgBtn:      { width: 30, height: 30, border: 'none', borderRadius: '50%', background: 'none', fontSize: 13, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pgActive:   { width: 30, height: 30, border: 'none', borderRadius: '50%', background: '#1a3c8f', fontSize: 13, color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  footer:     { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 20px 16px', borderTop: '1px solid #f3f4f6' },
  btnCancel:  { padding: '8px 22px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', border: '1.5px solid #1a3c8f', color: '#1a3c8f' },
  btnAdd:     { padding: '8px 22px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#1a3c8f', border: '1.5px solid #1a3c8f', color: '#fff' },
  btnAddDis:  { padding: '8px 22px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'default', background: '#9ca3af', border: '1.5px solid #9ca3af', color: '#fff' },
  successBar: { margin: '0 20px 12px', padding: '10px 14px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, fontSize: 12, color: '#166534' },
  changeBtn:  { marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#166534', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none' },
};

type CardItem = VideoEntry & { _division: string; _key: string };

export default function VideoPickerEditor({ initialDivision, initialVideoUrl, onSelect }: Props) {
  const [division, setDivision]   = useState(initialDivision || '');
  const [search,   setSearch]     = useState('');
  const [page,     setPage]       = useState(1);
  const [selKey,   setSelKey]     = useState<string | null>(null);
  const [selVideo, setSelVideo]   = useState<CardItem | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [thumbErr,  setThumbErr]  = useState<Record<string,boolean>>({});

  // When no division is chosen, aggregate videos across all divisions.
  const allVideos: CardItem[] = useMemo(() => {
    if (division) {
      return (DIVISION_VIDEOS[division] || []).map(v => ({
        ...v, _division: division, _key: `${division}::${v.id}`,
      }));
    }
    return ([] as CardItem[]).concat(
      ...DIVISIONS.map(d =>
        (DIVISION_VIDEOS[d] || []).map(v => ({
          ...v, _division: d, _key: `${d}::${v.id}`,
        }))
      )
    );
  }, [division]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? allVideos.filter(v =>
          v.title.toLowerCase().includes(q) ||
          v.series.toLowerCase().includes(q) ||
          v.author.toLowerCase().includes(q) ||
          v._division.toLowerCase().includes(q))
      : allVideos;
  }, [allVideos, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function chooseDivision(div: string) {
    setDivision(div);
    setSearch('');
    setPage(1);
    setSelKey(null);
    setSelVideo(null);
    setConfirmed(false);
  }

  function selectCard(v: CardItem) {
    setSelKey(v._key);
    setSelVideo(v);
    setConfirmed(false);
  }

  function handleAdd() {
    if (!selVideo) return;
    onSelect(selVideo._division, selVideo.title, selVideo.url);
    setConfirmed(true);
  }

  function handleChange() {
    setConfirmed(false);
    setSelKey(null);
    setSelVideo(null);
  }

  // Stop all events bubbling up to the Staffbase editor overlay,
  // which would otherwise intercept clicks and keypresses.
  function stopAll(e: React.SyntheticEvent) { e.stopPropagation(); }

  return (
    <div
      style={S.root}
      onClick={stopAll}
      onMouseDown={stopAll}
      onMouseUp={stopAll}
      onKeyDown={stopAll}
      onKeyUp={stopAll}
      onKeyPress={stopAll}
    >
      <div style={S.pageTitle}>Select a Video</div>

      <div style={S.toolbar}>
        <div style={S.selectWrap}>
          <select
            style={S.select}
            value={division}
            onClick={stopAll}
            onMouseDown={stopAll}
            onChange={e => { e.stopPropagation(); chooseDivision(e.target.value); }}
          >
            <option value="">All Divisions/Locations</option>
            {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={S.searchWrap}>
          <input
            type="text"
            placeholder="search"
            value={search}
            style={S.searchInput}
            onClick={stopAll}
            onMouseDown={stopAll}
            onFocus={stopAll}
            onKeyDown={stopAll}
            onKeyUp={stopAll}
            onKeyPress={stopAll}
            onChange={e => { e.stopPropagation(); setSearch(e.target.value); setPage(1); }}
          />
          <span style={S.searchIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
        </div>
      </div>

      {confirmed && selVideo && (
        <div style={S.successBar}>
          <strong style={{ display: 'block', marginBottom: 2 }}>{selVideo.title}</strong>
          Video added to widget.
          <button style={S.changeBtn} onClick={handleChange}>Change</button>
        </div>
      )}

      <div style={S.grid}>
        {filtered.length === 0 ? (
          <div style={S.emptyBox}>
            <strong style={{ display: 'block', color: '#6b7280', marginBottom: 4 }}>No results found</strong>
            Try a different search term.
          </div>
        ) : pageItems.map(v => {
          const selected = v._key === selKey;
          const expired  = v.expiryDate && v.expiryDate < TODAY;
          const thumb    = thumbUrl(v.url);
          const imgFail  = thumbErr[v._key];
          return (
            <div
              key={v._key}
              style={selected ? S.cardSel : S.card}
              onClick={() => selectCard(v)}
            >
              <div style={selected ? S.radioFill : S.radioRing}>
                {selected && <div style={S.radioDot} />}
              </div>

              {thumb && !imgFail ? (
                <img
                  src={thumb}
                  alt=""
                  style={S.thumb}
                  onError={() => setThumbErr(e => ({ ...e, [v._key]: true }))}
                />
              ) : (
                <div style={S.thumbFail}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
                    <path d="M10 8l6 4-6 4V8z" fill="rgba(255,255,255,0.5)"/>
                  </svg>
                </div>
              )}

              <div style={S.cardBody}>
                <div style={S.cardTitle}>{v.title}</div>
                <div style={S.cardSeries}>{v.series}</div>
                <div style={S.cardMeta as any}>
                  {([
                    ...(!division ? [['Division', v._division, false] as [string, string, boolean]] : []),
                    ['Duration',  v.duration,                    false],
                    ['Author',    v.author,                      false],
                    ['Published', fmtDate(v.publishDate),        false],
                    ['Expires',   fmtDate(v.expiryDate), !!expired],
                  ] as [string, string, boolean][]).map(([label, val, exp]) => (
                    <div key={label} style={S.metaRow}>
                      <span style={S.metaLabel}>{label}</span>
                      <span style={exp ? S.metaExp : S.metaVal}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={S.pagination}>
          <button
            style={{ ...S.pgBtn, color: page === 1 ? '#d1d5db' : '#374151' }}
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >&#8249;</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              style={n === page ? S.pgActive : S.pgBtn}
              onClick={() => setPage(n)}
            >{n}</button>
          ))}
          <button
            style={{ ...S.pgBtn, color: page === totalPages ? '#d1d5db' : '#374151' }}
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >&#8250;</button>
        </div>
      )}

      <div style={S.footer}>
        <button style={S.btnCancel} onClick={handleChange}>Cancel</button>
        <button
          style={selVideo && !confirmed ? S.btnAdd : S.btnAddDis}
          disabled={!selVideo || confirmed}
          onClick={handleAdd}
        >{confirmed ? 'Added ✓' : 'Add Video'}</button>
      </div>
    </div>
  );
}
