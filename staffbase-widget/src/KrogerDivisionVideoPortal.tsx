import React, { useState, useEffect, useCallback } from 'react';
import { VideoItem, fetchVideos } from './services/videoService';

const ITEMS_PER_PAGE = 32;

function pad2(n: number): string { return n < 10 ? '0' + n : String(n); }

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) + '/' + d.getFullYear();
  } catch { return iso; }
}

function extractYtId(url: string): string | null {
  const m = (url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlight(text: string, q: string): string {
  if (!q) return escHtml(text);
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escHtml(text).replace(new RegExp(`(${esc})`, 'gi'), '<mark style="background:#fef08a;border-radius:2px;padding:0 1px">$1</mark>');
}

/* ── Video Card ── */
interface VideoCardProps {
  video: VideoItem;
  query: string;
  selected: boolean;
  onSelect: (id: string | number) => void;
}

function VideoCard({ video, query, selected, onSelect }: VideoCardProps) {
  const [playing, setPlaying] = useState(false);
  const ytId    = extractYtId(video.videoUrl);
  const thumbUrl = video.thumbnailUrl || `https://picsum.photos/seed/kroger${video.id}/640/360`;

  return (
    <div
      onClick={() => onSelect(video.id)}
      style={{
        background: '#fff',
        borderRadius: 10,
        overflow: 'hidden',
        border: selected ? '2px solid #003087' : '2px solid transparent',
        boxShadow: selected
          ? '0 0 0 3px rgba(0,48,135,0.15), 0 4px 16px rgba(0,48,135,0.12)'
          : '0 1px 6px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        position: 'relative',
        paddingBottom: '52%',
        overflow: 'hidden',
        backgroundImage: `url(${thumbUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Radio button */}
        <div
          onClick={e => { e.stopPropagation(); onSelect(video.id); }}
          style={{
            position: 'absolute', top: 10, left: 10, zIndex: 10,
            width: 22, height: 22, borderRadius: '50%',
            background: selected ? '#003087' : 'rgba(255,255,255,0.92)',
            border: `2px solid ${selected ? '#003087' : '#d1d5db'}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          {selected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'block' }} />}
        </div>

        {/* Play / iframe */}
        {playing && ytId ? (
          <iframe
            style={{ position: 'absolute', inset: 0 as any, width: '100%', height: '100%', border: 'none' }}
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`}
            allow="autoplay;encrypted-media;picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            onClick={e => { e.stopPropagation(); if (ytId) setPlaying(true); else window.open(video.videoUrl, '_blank', 'noopener,noreferrer'); }}
            style={{ position: 'absolute', inset: 0 as any, width: '100%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label={`Play ${video.title}`}
          >
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 12px rgba(0,0,0,0.28)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#003087"><path d="M8 5v14l11-7z"/></svg>
            </span>
          </button>
        )}

        {/* Duration badge */}
        <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.72)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 4, pointerEvents: 'none' }}>
          {video.duration}
        </span>
      </div>

      {/* Card info */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <p
          style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', lineHeight: 1.4, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: highlight(video.title, query) }}
        />
        <p style={{ fontSize: 11.5, color: '#6b7280', margin: 0, lineHeight: 1.3 }}>
          {video.series || video.category || ''}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
          {[
            { label: 'Duration',  value: video.duration || '—' },
            { label: 'Author',    value: video.author || '—' },
            { label: 'Published', value: formatDate(video.publishedAt) },
            { label: 'Expires',   value: formatDate(video.expiryDate) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11.5 }}>
              <span style={{ color: '#6b7280', minWidth: 64, flexShrink: 0 }}>{label}</span>
              <span style={{ color: '#111827', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ── */
interface PaginationProps {
  total: number;
  current: number;
  onChange: (p: number) => void;
}

function Pagination({ total, current, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
  const disabled   = totalPages <= 1;

  const btnStyle = (active: boolean, dis: boolean): React.CSSProperties => ({
    minWidth: 32, height: 32, borderRadius: 6,
    border: '1.5px solid',
    borderColor: active ? '#003087' : '#d1d5db',
    background: active ? '#003087' : '#fff',
    color: active ? '#fff' : '#374151',
    fontSize: 13, fontWeight: 600,
    cursor: dis ? 'not-allowed' : 'pointer',
    opacity: dis ? 0.4 : 1,
    padding: '0 8px',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button style={btnStyle(false, disabled || current === 1)} disabled={disabled || current === 1} onClick={() => onChange(current - 1)}>&#8249;</button>
      {Array.from({ length: disabled ? 1 : totalPages }, (_, i) => i + 1).map(p => (
        <button key={p} style={btnStyle(p === current, disabled)} disabled={disabled} onClick={() => onChange(p)}>{p}</button>
      ))}
      <button style={btnStyle(false, disabled || current === totalPages)} disabled={disabled || current === totalPages} onClick={() => onChange(current + 1)}>&#8250;</button>
    </div>
  );
}

/* ── Main component ── */
interface Props { widgettitle: string; }

const KrogerDivisionVideoPortal: React.FC<Props> = ({ widgettitle }) => {
  const [allVideos,  setAllVideos]  = useState<VideoItem[]>([]);
  const [filtered,   setFiltered]   = useState<VideoItem[]>([]);
  const [category,   setCategory]   = useState('');
  const [query,      setQuery]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [apiError,   setApiError]   = useState(false);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [page,       setPage]       = useState(1);

  /* Load from API */
  useEffect(() => {
    setLoading(true); setQuery(''); setApiError(false); setPage(1);
    fetchVideos({ category: category || undefined })
      .then(data => {
        setAllVideos(data);
        setFiltered(data);
        setLoading(false);
        if (data.length === 0) setApiError(true);
      })
      .catch(() => { setAllVideos([]); setFiltered([]); setApiError(true); setLoading(false); });
  }, [category]);

  /* Filter on search */
  const onSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value.trim().toLowerCase();
    setQuery(q);
    setPage(1);
    setFiltered(q
      ? allVideos.filter(v =>
          (v.title   || '').toLowerCase().includes(q) ||
          (v.series  || '').toLowerCase().includes(q) ||
          (v.author  || '').toLowerCase().includes(q) ||
          (v.category|| '').toLowerCase().includes(q))
      : allVideos
    );
  }, [allVideos]);

  const pageVideos = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSelect = (id: string | number) => setSelectedId(id);
  const handleCancel = () => setSelectedId(null);
  const selectedVideo = allVideos.find(v => v.id === selectedId);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f0f4f8', minHeight: 200, paddingBottom: 72, position: 'relative' }}>
      <style>{`@keyframes kvp-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: '#003087', color: '#fff', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ background: '#E31837', color: '#fff', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 4 }}>Kroger</span>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.3)' }} />
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', margin: 0 }}>{widgettitle || 'Division Video Portal'}</h1>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '32px auto', padding: '0 24px' }}>

        {/* Controls */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Category:</label>
            <select value={category} onChange={e => { setCategory(e.target.value); }}
              style={{ appearance: 'none', background: '#f9fafb', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '9px 36px 9px 14px', fontSize: '0.9rem', color: '#111827', cursor: 'pointer', minWidth: 200 }}>
              <option value="">All Categories</option>
              <option value="Corporate">Corporate</option>
              <option value="HR &amp; Benefits">HR &amp; Benefits</option>
              <option value="Training">Training</option>
            </select>
          </div>
          <input type="text" placeholder="Search videos…" onChange={onSearch}
            style={{ border: '1.5px solid #d1d5db', borderRadius: 8, padding: '9px 14px', fontSize: '0.9rem', color: '#111827', background: '#f9fafb', width: 260 }} />
        </div>

        {/* Section bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', margin: 0 }}>
            {category ? `${category} — Videos` : 'All Videos'}
          </h2>
          {!loading && filtered.length > 0 && (
            <span style={{ background: '#eff6ff', color: '#003087', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
              {filtered.length} video{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#003087', borderRadius: '50%', animation: 'kvp-spin 0.75s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#6b7280', margin: 0 }}>Loading videos…</p>
          </div>
        )}

        {/* API error */}
        {!loading && apiError && (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <svg width="52" height="52" fill="none" stroke="#d1d5db" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16, display: 'block', margin: '0 auto 16px' }}>
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M10 8l6 4-6 4V8z"/>
            </svg>
            <p style={{ fontSize: '1rem', fontWeight: 500, color: '#6b7280', margin: '0 0 4px' }}>No video selected</p>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>The video library is currently unavailable.</span>
          </div>
        )}

        {/* No search results */}
        {!loading && !apiError && filtered.length === 0 && query && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
            No videos match your search.
          </div>
        )}

        {/* 4-column grid */}
        {!loading && !apiError && pageVideos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {pageVideos.map(v => (
              <VideoCard key={v.id} video={v} query={query} selected={selectedId === v.id} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e5e7eb', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', zIndex: 100 }}>
        {/* Pagination */}
        {!loading && !apiError && (
          <div style={{ marginRight: 'auto' }}>
            <Pagination total={filtered.length} current={page} onChange={setPage} />
          </div>
        )}

        <button
          onClick={handleCancel}
          style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          disabled={!selectedId}
          onClick={() => {}}
          style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: selectedId ? '#003087' : '#9ca3af', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', opacity: selectedId ? 1 : 0.65 }}
        >
          Add Video
        </button>
      </div>
    </div>
  );
};

export default KrogerDivisionVideoPortal;
