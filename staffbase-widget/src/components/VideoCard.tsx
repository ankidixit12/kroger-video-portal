import React, { useState } from 'react';
import { VideoItem } from '../services/videoService';

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

interface VideoCardProps {
  video: VideoItem;
}

const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const [playing, setPlaying] = useState(false);
  const ytId = extractYouTubeId(video.videoUrl);

  const handlePlay = () => {
    if (ytId) {
      setPlaying(true);
    } else {
      window.open(video.videoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', paddingBottom: '56.25%', background: video.thumbnailColor }}>
        {playing && ytId ? (
          <iframe
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title={video.title}
          />
        ) : (
          <>
            <button
              onClick={handlePlay}
              aria-label={`Play ${video.title}`}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.92)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#003087">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>

            <span
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                background: 'rgba(0,0,0,0.72)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 4,
                letterSpacing: '0.02em',
              }}
            >
              {video.duration}
            </span>
          </>
        )}
      </div>

      {/* Info */}
      <div
        style={{
          padding: '12px 14px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: '#111827',
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box' as React.CSSProperties['display'],
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
          }}
        >
          {video.title}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 20,
              background: CATEGORY_BG[video.category] ?? '#f3f4f6',
              color: CATEGORY_FG[video.category] ?? '#374151',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {video.category}
          </span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{formatDate(video.publishedAt)}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
