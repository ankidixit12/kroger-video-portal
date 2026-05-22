import React, { useState, useRef, useEffect } from 'react';

const DIVISIONS = ['Dallas', 'Fred Mayor', 'Atlanta', 'Roundys', 'Ruler', 'Smiths'];

const VIDEO_URL = 'https://www.youtube.com/watch?v=DiEDpGyoNXw';

const DIVISION_VIDEOS: Record<string, string[]> = {
  Dallas: [
    'Dallas Region Safety Training 2024',
    'New Employee Onboarding - Dallas',
    'Customer Service Excellence',
    'Compliance & Ethics Overview',
    'Store Operations Best Practices',
    'Loss Prevention Guidelines',
  ],
  'Fred Mayor': [
    'Fred Mayor Division Kickoff 2024',
    'Fresh Department Standards',
    'Digital Checkout Training',
    'Pharmacy Operations Guide',
    'Team Leadership Essentials',
    'Seasonal Stocking Procedures',
  ],
  Atlanta: [
    'Atlanta Market Overview 2024',
    'Southern Region Compliance',
    'Community Engagement Training',
    'Produce Quality Standards',
    'Customer Experience Workshop',
    'Health & Wellness Initiative',
  ],
  Roundys: [
    'Roundys Brand Standards 2024',
    'Midwest Region Update',
    'Deli & Bakery Excellence',
    'Supply Chain Overview',
    'Associate Development Program',
    'Food Safety Certification',
  ],
  Ruler: [
    'Ruler Foods Operations Guide',
    'Value Format Training 2024',
    'Inventory Management 101',
    'Team Communication Skills',
    'Store Layout Optimization',
    'Customer Loyalty Programs',
  ],
  Smiths: [
    "Smith's Division Highlights 2024",
    'Mountain Region Training',
    'Floral Department Guide',
    'Fuel Center Operations',
    'Community Partnership Program',
    'Digital Coupon Training',
  ],
};

interface ConfigData {
  division?: string;
  videotitle?: string;
  videourl?: string;
}

interface VideoConfigFieldProps {
  formData: ConfigData;
  onChange: (data: ConfigData) => void;
}

const S: Record<string, React.CSSProperties> = {
  root:        { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '4px 0' },
  fieldWrap:   { marginBottom: 20 },
  label:       { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  required:    { color: '#ef4444', marginLeft: 2 },
  select:      { width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#111827', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' as any },
  selectEmpty: { width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#9ca3af', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' as any },
  searchWrap:  { position: 'relative' as any },
  searchIcon:  { position: 'absolute' as any, left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' as any, display: 'flex' },
  searchInput: { width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#111827', background: '#fff', boxSizing: 'border-box' as any, outline: 'none' },
  dropdown:    { position: 'absolute' as any, top: '100%', left: 0, right: 0, border: '1.5px solid #d1d5db', borderTop: 'none', borderRadius: '0 0 8px 8px', background: '#fff', maxHeight: 210, overflowY: 'auto' as any, zIndex: 1000, boxShadow: '0 6px 16px rgba(0,0,0,0.1)' },
  dropItem:    { padding: '10px 14px', fontSize: 13, color: '#111827', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' },
  dropItemSel: { padding: '10px 14px', fontSize: 13, color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: '#eff6ff' },
  dropEmpty:   { padding: '12px 14px', fontSize: 13, color: '#9ca3af', fontStyle: 'italic' as any },
  urlInput:    { width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#6b7280', background: '#f9fafb', cursor: 'default', boxSizing: 'border-box' as any },
  urlHint:     { fontSize: 11, color: '#9ca3af', marginTop: 5 },
};

export default function VideoConfigField({ formData, onChange }: VideoConfigFieldProps) {
  const data = formData || {};
  const division   = data.division   || '';
  const videotitle = data.videotitle || '';
  const videourl   = data.videourl   || '';

  const [searchQuery, setSearchQuery]   = useState(videotitle);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const videos = division ? (DIVISION_VIDEOS[division] || []) : [];
  const filtered = videos.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

  // Sync search input when external videotitle changes
  useEffect(() => { setSearchQuery(videotitle); }, [videotitle]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        // If search doesn't match a real selection, reset
        if (searchQuery && searchQuery !== videotitle) {
          setSearchQuery(videotitle);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchQuery, videotitle]);

  const handleDivisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ division: e.target.value, videotitle: '', videourl: '' });
    setSearchQuery('');
    setDropdownOpen(false);
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setDropdownOpen(true);
    // Clear selection if user is typing a new search
    if (videotitle) {
      onChange({ ...data, videotitle: '', videourl: '' });
    }
  };

  const handleVideoSelect = (title: string) => {
    onChange({ ...data, videotitle: title, videourl: VIDEO_URL });
    setSearchQuery(title);
    setDropdownOpen(false);
  };

  const inputBorderRadius = dropdownOpen && filtered.length > 0 ? '8px 8px 0 0' : '8px';

  return (
    <div style={S.root}>

      {/* Division Dropdown */}
      <div style={S.fieldWrap}>
        <label style={S.label}>
          Division <span style={S.required}>*</span>
        </label>
        <select
          value={division}
          onChange={handleDivisionChange}
          style={division ? S.select : S.selectEmpty}
        >
          <option value="">-- Select a Division --</option>
          {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Searchable Video Dropdown — only shown after a division is selected */}
      {division && (
        <div style={S.fieldWrap}>
          <label style={S.label}>
            Video <span style={S.required}>*</span>
          </label>
          <div ref={dropdownRef} style={S.searchWrap}>
            <span style={S.searchIcon}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              onFocus={() => setDropdownOpen(true)}
              placeholder={`Search ${division} videos…`}
              style={{ ...S.searchInput, borderRadius: inputBorderRadius }}
            />

            {dropdownOpen && (
              <div style={S.dropdown}>
                {filtered.length === 0 ? (
                  <div style={S.dropEmpty}>No videos match your search</div>
                ) : (
                  filtered.map(title => (
                    <div
                      key={title}
                      onMouseDown={() => handleVideoSelect(title)}
                      style={videotitle === title ? S.dropItemSel : S.dropItem}
                    >
                      {title}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video URL — readonly, shown after a video is selected */}
      {videourl && (
        <div style={S.fieldWrap}>
          <label style={S.label}>Video URL</label>
          <input
            type="text"
            value={videourl}
            readOnly
            style={S.urlInput}
          />
          <p style={S.urlHint}>Auto-populated from selected video</p>
        </div>
      )}

    </div>
  );
}
