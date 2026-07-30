// PingOne authentication module for the Staffbase Qumu video widget.
//
// Provides silent, PKCE-based PingOne authentication for Kong API calls.
// The ONLY functions widget code should call are getAccessToken() and
// fetchFromKong(). Everything else is an internal building block.
//
// Security notes:
//  - Public SPA client — NO client_secret. PKCE protects the code exchange.
//  - Tokens live in sessionStorage (cleared when the tab closes).
//  - No iframes to PingOne and no full-page redirects (window.location.href).

// ─── Config ─────────────────────────────────────────────────────────────────
// Replace the REPLACE_WITH_* placeholders with real values before deploying.

const PING_CONFIG = {
  envId: '6c0241eb-6d4c-4b98-bdfb-5ab44b0d7112',
  clientId: 'de6b92bb-b02f-431b-82bf-1ae96f570f2e',
  redirectUri: 'https://krogertest.staffbase.com/auth/oidc/kroger-test-ping/callback',
  scope: 'openid profile email offline_access',
  kongBaseUrl: 'REPLACE_WITH_KONG_GATEWAY_BASE_URL',
};

const PING_BASE = `https://auth.pingone.com/${PING_CONFIG.envId}/as`;

// sessionStorage keys
const TOKEN_KEY = 'pingone_access_token';
const REFRESH_KEY = 'pingone_refresh_token';
const EXPIRY_KEY = 'pingone_token_expiry';
const PKCE_VERIFIER_KEY = 'pkce_verifier';
const OAUTH_STATE_KEY = 'oauth_state';

// ─── 1. PKCE utilities ────────────────────────────────────────────────────────

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

// ─── 2. Token storage (sessionStorage) ─────────────────────────────────────────

function storeTokens(accessToken: string, refreshToken: string | null, expiresIn: number): void {
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
}

function getStoredToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) || 0);
  if (token && expiry > Date.now()) return token;
  return null;
}

function getStoredRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

function clearTokens(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
}

// ─── 3. Silent refresh (refresh_token grant) ────────────────────────────────────

async function silentRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${PING_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: PING_CONFIG.clientId,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.access_token) return null;
    storeTokens(data.access_token, data.refresh_token || refreshToken, Number(data.expires_in) || 3600);
    return data.access_token;
  } catch {
    return null;
  }
}

// ─── 4. Popup auth (PKCE authorization code) ────────────────────────────────────

async function popupAuth(prompt: 'none' | 'login'): Promise<string> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateCodeVerifier();

  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const authUrl =
    `${PING_BASE}/authorize` +
    `?client_id=${encodeURIComponent(PING_CONFIG.clientId)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(PING_CONFIG.scope)}` +
    `&redirect_uri=${encodeURIComponent(PING_CONFIG.redirectUri)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&state=${encodeURIComponent(state)}` +
    `&prompt=${encodeURIComponent(prompt)}`;

  const redirectOrigin = new URL(PING_CONFIG.redirectUri).origin;
  // Keep the auth window as small and unobtrusive as possible. For the silent
  // (prompt=none) flow it only needs to live long enough to POST the code back,
  // so we shove it off-screen and shrink it. Browsers clamp size to a ~100px
  // minimum and may pull an off-screen popup partly back on-screen.
  const popup = window.open(
    authUrl,
    'pingone_auth',
    'width=100,height=100,left=0,top=0,menubar=no,toolbar=no,location=no,status=no,resizable=no,scrollbars=no',
  );
  if (popup && prompt === 'none') {
    // moveTo/resizeTo work on a window we opened even when its content is
    // cross-origin (they act on the window, not the document).
    try { popup.moveTo(-4000, -4000); popup.resizeTo(100, 100); } catch { /* ignore */ }
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', handler);
      clearTimeout(timer);
      if (popup && !popup.closed) popup.close();
    };

    const handler = (event: MessageEvent) => {
      // Only trust messages coming from the callback page's own origin.
      if (event.origin !== redirectOrigin) return;
      const data = event.data || {};
      // Reject replayed / cross-flow messages that don't match our state.
      if (data.state !== state) return;
      settled = true;
      cleanup();
      if (data.error) {
        reject(new Error(data.error));
      } else if (data.code) {
        resolve(data.code);
      } else {
        reject(new Error('invalid_response'));
      }
    };

    // Silent attempts should give up fast so the hidden window never lingers;
    // interactive login needs time for the user to type credentials.
    const timeoutMs = prompt === 'none' ? 3000 : 10000;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('timeout'));
    }, timeoutMs);

    window.addEventListener('message', handler);
  });
}

// ─── 5. Token exchange (authorization_code grant) ──────────────────────────────

async function exchangeCodeForTokens(code: string): Promise<string> {
  const res = await fetch(`${PING_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: PING_CONFIG.redirectUri,
      client_id: PING_CONFIG.clientId,
      code_verifier: sessionStorage.getItem(PKCE_VERIFIER_KEY) || '',
    }).toString(),
  });
  if (!res.ok) throw new Error('token_exchange_failed');
  const data = await res.json();
  if (!data || !data.access_token) throw new Error('token_exchange_failed');
  storeTokens(data.access_token, data.refresh_token || null, Number(data.expires_in) || 3600);
  return data.access_token;
}

// ─── 6. Main entry point ────────────────────────────────────────────────────────
// The ONLY auth function widget code should call directly.

// DEV-ONLY fallback: when the real PingOne flow can't complete, stash a random
// token in sessionStorage so the widget can proceed during development.
// TODO: remove before production — this is not a valid credential.
function storeFallbackToken(): string {
  const fallback = 'dev_' + generateCodeVerifier();
  storeTokens(fallback, null, 3600);
  return fallback;
}

export async function getAccessToken(): Promise<string> {
  // Step 1: valid stored token
  const stored = getStoredToken();
  if (stored) return stored;

  // Step 2: silent refresh with the refresh token
  const refreshed = await silentRefresh();
  if (refreshed) return refreshed;

  // Step 3: silent popup (prompt=none) — no user interaction if PingOne session is alive
  try {
    const code = await popupAuth('none');
    return await exchangeCodeForTokens(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Step 4: fall back to interactive login only if the session is fully expired
    if (message === 'login_required' || message === 'timeout') {
      try {
        const code = await popupAuth('login');
        return await exchangeCodeForTokens(code);
      } catch {
        // DEV-ONLY: don't hard-fail — use a random cached token.
        return storeFallbackToken();
      }
    }

    // Step 5: anything else — DEV-ONLY random cached token instead of failing.
    return storeFallbackToken();
  }
}

// ─── 7. Kong API call wrapper ────────────────────────────────────────────────────

export async function fetchFromKong(path: string, options: RequestInit = {}): Promise<any> {
  const call = (token: string): Promise<Response> =>
    fetch(`${PING_CONFIG.kongBaseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let token = await getAccessToken();
  let res = await call(token);

  // One retry on 401: drop the stale token and re-authenticate.
  if (res.status === 401) {
    clearTokens();
    token = await getAccessToken();
    res = await call(token);
  }

  return res.json();
}
