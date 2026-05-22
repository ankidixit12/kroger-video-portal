import React, { useState, useRef, useEffect } from 'react';
import { DIVISIONS, DIVISION_VIDEOS } from './videoData';

// Module-level shared state — lets VideoUrlWidget react to division changes
// without needing formContext from rjsf.
let _div = '';
const _subs: Array<(d: string) => void> = [];
const _subscribe = (fn: (d: string) => void) => {
  _subs.push(fn);
  return () => { const i = _subs.indexOf(fn); if (i >= 0) _subs.splice(i, 1); };
};
const _setDiv = (d: string) => { _div = d; _subs.forEach(fn => fn(d)); };

// ── Division dropdown ──────────────────────────────────────────────────────
export function DivisionWidget({ value, onChange }: any) {
  if ((value || '') !== _div) _setDiv(value || '');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    _setDiv(e.target.value);
    onChange(e.target.value);
  };

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fff', cursor: 'pointer', boxSizing: 'border-box' as any }}
    >
      <option value="">-- Select a Division --</option>
      {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
    </select>
  );
}

// ── Searchable video dropdown + URL display ────────────────────────────────
export function VideoUrlWidget({ value, onChange }: any) {
  const [division, setDivision] = useState(_div);
  const [search, setSearch]     = useState('');
  const [open, setOpen]         = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Subscribe to division changes from the DivisionWidget
  useEffect(() => {
    return _subscribe(d => {
      setDivision(d);
      setSearch('');
      onChange('');
    });
  }, []);

  const videos   = DIVISION_VIDEOS[division] || [];
  const selected = videos.find(v => v.url === value && value) || null;
  const filtered = videos.filter(v => v.title.toLowerCase().includes(search.toLowerCase()));

  // Show title in input when closed, show search text when open
  const inputValue = open ? search : (selected?.title || '');

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!division) {
    return (
      <p style={{ color: '#9ca3af', fontSize: 13, margin: 0, fontStyle: 'italic' as any }}>
        Select a division first
      </p>
    );
  }

  const borderRadius = open ? '6px 6px 0 0' : '6px';

  return (
    <div>
      {/* Searchable dropdown */}
      <div ref={dropRef} style={{ position: 'relative' as any }}>
        <span style={{ position: 'absolute' as any, left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' as any, display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </span>
        <input
          type="text"
          value={inputValue}
          onChange={e => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
          onFocus={() => { setOpen(true); setSearch(''); }}
          placeholder={`Search ${division} videos…`}
          style={{ width: '100%', padding: '8px 32px 8px 32px', border: '1.5px solid #d1d5db', borderRadius, fontSize: 14, boxSizing: 'border-box' as any, outline: 'none', background: '#fff' }}
        />
        {/* Clear button */}
        {(value || search) && (
          <button
            onMouseDown={e => { e.preventDefault(); onChange(''); setSearch(''); setOpen(false); }}
            style={{ position: 'absolute' as any, right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, display: 'flex', alignItems: 'center' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}

        {/* Dropdown list */}
        {open && (
          <div style={{ position: 'absolute' as any, top: '100%', left: 0, right: 0, border: '1.5px solid #d1d5db', borderTop: 'none', borderRadius: '0 0 6px 6px', background: '#fff', maxHeight: 200, overflowY: 'auto' as any, zIndex: 9999, boxShadow: '0 6px 16px rgba(0,0,0,.1)' }}>
            {filtered.length === 0
              ? <div style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 13, fontStyle: 'italic' as any }}>No videos match</div>
              : filtered.map(v => (
                  <div
                    key={v.title}
                    onMouseDown={() => { onChange(v.url); setSearch(''); setOpen(false); }}
                    style={{ padding: '10px 14px', fontSize: 13, color: '#111827', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: value === v.url ? '#eff6ff' : '#fff', fontWeight: value === v.url ? 600 : 400 }}
                  >
                    {v.title}
                  </div>
                ))
            }
          </div>
        )}
      </div>

      {/* Read-only URL box — appears after a video is selected */}
      {value && (
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
            Video URL
          </label>
          <input
            type="text"
            value={value}
            readOnly
            style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e5e7eb', borderRadius: 6, fontSize: 12, color: '#6b7280', background: '#f9fafb', cursor: 'default', boxSizing: 'border-box' as any }}
          />
        </div>
      )}
    </div>
  );
}
