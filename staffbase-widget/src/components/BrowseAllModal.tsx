import React, { useState, useEffect, useRef } from 'react';
import { VideoItem, fetchVideos } from '../services/videoService';

function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const CATEGORY_BG: Record<string, string> = {
  Corporate:       '#dbeafe',
  'HR & Benefits': '#ede9fe',
  Training:        '#dcfce7',
};
const CATEGORY_FG: Record<string, string> = {
  Corporate:       '#1d4ed8',
  'HR & Benefits': '#6d28d9',
  Training:        '#15803d',
};

interface BrowseAllModalProps {
  onClose: () => void;
}

const BrowseAllModal: React.FC<BrowseAllModalProps> = ({ onClose }) => {
  const [videos, setVideos]           = useState<VideoItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const searchRef                     = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchVideos()
      .then(data => { setVideos(data); setLoading(false); })
      .catch(() => {
        setError('Could not load videos — run npm run mock-api');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading) searchRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = videos.filter(v => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      v.title.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q)
    );
  });

  const handleRowClick = (video: VideoItem) => {
    const ytId = extractYouTubeId(video.videoUrl);
    if (ytId) {
      setActiveVideo(prev => (prev?.id === video.id ? null : video));
    } else {
      window.open(video.videoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <style>{`@keyframes kvh-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9998,
        }}
      />

      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(720px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 64px)',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 9999,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
              All Videos
            </h2>
            {!loading && !error && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                {videos.length} video{videos.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 8,
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Inline player */}
        {activeVideo && extractYouTubeId(activeVideo.videoUrl) && (
          <div
            style={{
              padding: '14px 24px',
              background: '#f8fafc',
              borderBottom: '1px solid #e5e7eb',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                paddingBottom: '56.25%',
                background: '#000',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <iframe
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                src={`https://www.youtube-nocookie.com/embed/${extractYouTubeId(activeVideo.videoUrl)}?autoplay=1`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={activeVideo.title}
              />
            </div>
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>
                {activeVideo.title}
              </p>
              <button
                onClick={() => setActiveVideo(null)}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#374151',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>
        )}

        {/* Search bar */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f9fafb',
              borderRadius: 8,
              border: '1.5px solid #d1d5db',
              padding: '0 12px',
              gap: 8,
            }}
          >
            <svg
              width="15"
              height="15"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              viewBox="0 0 24 24"
              style={{ flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>

            {/* Wrapper div ensures the input is fully visible against host-page overrides */}
            <div style={{ flex: 1 }}>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by title, category, or description…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 14,
                  color: '#111827',
                  padding: '10px 0',
                  WebkitTextFillColor: '#111827',
                  caretColor: '#003087',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  display: 'flex',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
              <div
                style={{
                  display: 'inline-block',
                  width: 30,
                  height: 30,
                  border: '3px solid #e5e7eb',
                  borderTopColor: '#003087',
                  borderRadius: '50%',
                  animation: 'kvh-spin 0.75s linear infinite',
                }}
              />
              <p style={{ margin: '12px 0 0', fontSize: 14 }}>Loading videos…</p>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <svg
                width="40"
                height="40"
                fill="none"
                stroke="#dc2626"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                style={{ margin: '0 auto 12px', display: 'block' }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', margin: '0 0 4px' }}>
                Error loading videos
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{error}</p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#6b7280', margin: '0 0 4px' }}>
                No videos match &ldquo;{search}&rdquo;
              </p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Try a different keyword.</p>
            </div>
          )}

          {!loading &&
            !error &&
            filtered.map(video => (
              <button
                key={video.id}
                onClick={() => handleRowClick(video)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 24px',
                  width: '100%',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  background: activeVideo?.id === video.id ? '#eff6ff' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Mini thumbnail */}
                <div
                  style={{
                    width: 64,
                    height: 40,
                    borderRadius: 6,
                    background: video.thumbnailColor,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>

                {/* Row info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: '0 0 4px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#111827',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {video.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: 20,
                        background: CATEGORY_BG[video.category] ?? '#f3f4f6',
                        color: CATEGORY_FG[video.category] ?? '#374151',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {video.category}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{video.duration}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatDate(video.publishedAt)}</span>
                  </div>
                </div>
              </button>
            ))}
        </div>
      </div>
    </>
  );
};

export default BrowseAllModal;
