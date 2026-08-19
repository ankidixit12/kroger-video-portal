import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authenticateInteractive, getAccessToken } from './services/pingone-auth-plugin';
import {
  clearSharedToken,
  listenForTokenRequests,
  storeSharedToken,
} from './services/pingone-token-bridge';

type AuthStatus = 'loading' | 'ready' | 'needs-login' | 'error';

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: '14px',
    color: '#101828',
  },
  box: {
    maxWidth: '480px',
    margin: '16px auto',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textAlign: 'center' as const,
  },
  heading: {
    margin: '0 0 8px',
    fontSize: '16px',
    fontWeight: 700,
    color: '#084999',
  },
  sub: {
    margin: '0 0 16px',
    color: '#6B7280',
    fontSize: '13px',
  },
  btn: {
    padding: '8px 20px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
    background: '#074085',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  frameContainer: {
    marginTop: '16px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #E5E7EB',
  },
  errorText: {
    color: '#dc2626',
    fontSize: '13px',
    marginTop: '8px',
  },
};

export const PingOneAuthPlugin: React.FC = () => {
  const [status, setStatus]         = useState<AuthStatus>('loading');
  const [showFrame, setShowFrame]   = useState(false);
  const [loginError, setLoginError] = useState('');
  const frameContainerRef           = useRef<HTMLDivElement>(null);
  const unmountedRef                = useRef(false);

  // Attempt silent auth; surface 'needs-login' if the session is expired.
  const runSilentAuth = useCallback(async () => {
    if (unmountedRef.current) return;
    setStatus('loading');
    setLoginError('');
    try {
      const token = await getAccessToken();
      if (unmountedRef.current) return;
      storeSharedToken(token, 3_600);
      setStatus('ready');
    } catch (err) {
      if (unmountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'login_required') {
        setStatus('needs-login');
      } else {
        setStatus('error');
      }
    }
  }, []);

  // Inject the PingOne login iframe into the plugin container element.
  const runInteractiveAuth = useCallback(async () => {
    if (!frameContainerRef.current) return;
    setShowFrame(true);
    setLoginError('');
    try {
      const token = await authenticateInteractive(frameContainerRef.current);
      if (unmountedRef.current) return;
      storeSharedToken(token, 3_600);
      setShowFrame(false);
      setStatus('ready');
    } catch (err) {
      if (unmountedRef.current) return;
      setShowFrame(false);
      setLoginError('Sign-in failed. Please try again.');
      setStatus('needs-login');
    }
  }, []);

  useEffect(() => {
    runSilentAuth();
  }, [runSilentAuth]);

  // Respond to TOKEN_REQUEST messages from other widgets on the page.
  // When a widget calls requestSharedToken() it may send a request if the token
  // is not yet in sessionStorage; we re-broadcast whatever we already have.
  useEffect(() => {
    if (status !== 'ready') return;
    const unsub = listenForTokenRequests(() => {
      // Re-read from sessionStorage so we always broadcast the freshest token.
      const token = sessionStorage.getItem('kroger_pingone_token');
      if (token) storeSharedToken(token, 3_600);
    });
    return unsub;
  }, [status]);

  // Clean up shared token on unmount so a stale token can't be re-used after
  // the plugin is removed from the page.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      clearSharedToken();
    };
  }, []);

  // Plugin is completely invisible once authenticated.
  if (status === 'ready' || status === 'loading') return null;

  if (status === 'error') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.box}>
          <p style={styles.heading}>Kroger Sign-In</p>
          <p style={styles.sub}>
            Authentication encountered an unexpected error.
          </p>
          <button style={styles.btn} onClick={runSilentAuth}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // status === 'needs-login'
  return (
    <div style={styles.wrapper}>
      <div style={styles.box}>
        <p style={styles.heading}>Kroger Sign-In</p>
        {!showFrame && (
          <>
            <p style={styles.sub}>
              Sign in with your Kroger account to continue.
            </p>
            <button style={styles.btn} onClick={runInteractiveAuth}>
              Sign In
            </button>
            {loginError && <p style={styles.errorText}>{loginError}</p>}
          </>
        )}
        {showFrame && (
          <div style={styles.frameContainer} ref={frameContainerRef} />
        )}
      </div>
    </div>
  );
};
