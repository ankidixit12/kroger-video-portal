import React from 'react';

interface KrogerVideoHubEditorProps {
  widgettitle: string;
  categoryfilter: string;
  videocount: string;
  onUpdate: (key: string, value: string) => void;
}

const CATEGORIES = [
  { value: '',             label: 'All Categories' },
  { value: 'Corporate',   label: 'Corporate' },
  { value: 'HR & Benefits', label: 'HR & Benefits' },
  { value: 'Training',    label: 'Training' },
];

const label = (text: string) => (
  <label
    style={{
      display: 'block',
      fontSize: 11,
      fontWeight: 700,
      color: '#374151',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 6,
    }}
  >
    {text}
  </label>
);

const inputBase: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: '#111827',
  background: '#fff',
  boxSizing: 'border-box',
  outline: 'none',
};

const KrogerVideoHubEditor: React.FC<KrogerVideoHubEditorProps> = ({
  widgettitle,
  categoryfilter,
  videocount,
  onUpdate,
}) => {
  const count = Number(videocount) || 6;
  const category = categoryfilter || '';
  const catLabel = CATEGORIES.find(c => c.value === category)?.label ?? 'All Categories';

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: 20,
        background: '#f8fafc',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: '#003087',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
            <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2H6v2h12v-2h-2v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Widget Settings</p>
          <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Kroger Video Hub</p>
        </div>
      </div>

      <div style={{ height: 1, background: '#e5e7eb' }} />

      {/* Widget Title */}
      <div>
        {label('Widget Title')}
        <input
          type="text"
          value={widgettitle}
          placeholder="Kroger Video Hub"
          onChange={e => onUpdate('widgettitle', e.target.value)}
          style={inputBase}
        />
      </div>

      {/* Category Filter */}
      <div>
        {label('Category Filter')}
        <select
          value={category}
          onChange={e => onUpdate('categoryfilter', e.target.value)}
          style={{ ...inputBase, appearance: 'none', cursor: 'pointer' }}
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Number of Videos */}
      <div>
        {label(`Number of Videos — ${count}`)}
        <input
          type="range"
          min={1}
          max={12}
          value={count}
          onChange={e => onUpdate('videocount', e.target.value)}
          style={{ width: '100%', accentColor: '#003087' }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#9ca3af',
            marginTop: 2,
          }}
        >
          <span>1</span>
          <span>12</span>
        </div>
      </div>

      {/* Summary pill */}
      <div
        style={{
          background: '#eff6ff',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
          color: '#1d4ed8',
          lineHeight: 1.5,
        }}
      >
        Showing <strong>{count}</strong> video{count !== 1 ? 's' : ''} from{' '}
        <strong>{catLabel}</strong>.
      </div>
    </div>
  );
};

export default KrogerVideoHubEditor;
