import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import EditorWrapper from './EditorWrapper';

const page: React.CSSProperties = {
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  background: '#f0f4f8',
  minHeight: '100vh',
};

const header: React.CSSProperties = {
  background: '#003087',
  color: '#fff',
  padding: '0 32px',
  height: 64,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
};

const badge: React.CSSProperties = {
  background: '#E31837',
  color: '#fff',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as any,
  padding: '4px 10px',
  borderRadius: 4,
};

const divider: React.CSSProperties = {
  width: 1,
  height: 28,
  background: 'rgba(255,255,255,0.3)',
};

const main: React.CSSProperties = {
  maxWidth: 700,
  margin: '32px auto',
  padding: '0 24px',
};

function Demo() {
  const [division,      setDivision]      = useState('');
  const [videotitle,    setVideotitle]    = useState('');
  const [videourl,      setVideourl]      = useState('');
  const [videoduration, setVideoduration] = useState('');
  const [videoexpiry,   setVideoexpiry]   = useState('');
  const [videothumb,    setVideothumb]    = useState('');

  return (
    <div style={page}>
      <header style={header}>
        <span style={badge}>Kroger</span>
        <div style={divider} />
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', margin: 0 }}>
          Division Video Portal
        </h1>
      </header>

      <main style={main}>
        <EditorWrapper
          division={division}
          videotitle={videotitle}
          videourl={videourl}
          videoduration={videoduration}
          videoexpiry={videoexpiry}
          videothumb={videothumb}
          onSelect={(d, t, u, dur, exp, th) => {
            setDivision(d);
            setVideotitle(t);
            setVideourl(u);
            setVideoduration(dur);
            setVideoexpiry(exp);
            setVideothumb(th);
          }}
        />
      </main>
    </div>
  );
}

const container = document.getElementById('root');
if (container) createRoot(container).render(<Demo />);
