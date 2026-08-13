// PingOne authentication module for the Staffbase Qumu video widget.
//
// Provides silent, PKCE-based PingOne authentication for Kong API calls.
// The ONLY functions widget code should call are getAccessToken() and
// fetchFromKong(). Everything else is an internal building block.
//
// Security notes:
//  - Public SPA client — NO client_secret. PKCE protects the code exchange.
//  - Tokens live in sessionStorage (cleared when the tab closes).
//  - Silent (prompt=none) re-auth uses a same-frame redirect (window.location),
//    not a nested iframe to PingOne — see redirectAuth()/consumeRedirectResult().
//    Interactive login still uses a popup so the widget UI isn't disrupted.

// ─── Config ─────────────────────────────────────────────────────────────────
// Replace the REPLACE_WITH_* placeholders with real values before deploying.

const PING_CONFIG = {
  envId: '6c0241eb-6d4c-4b98-bdfb-5ab44b0d7112',
  clientId: '2fd84c5a-722e-44b8-a864-f736bc648eb3',
  redirectUri: 'https://happy-island-0506c550f.7.azurestaticapps.net/callback.html',
  scope: 'openid profile email offline_access',
  // PingOne region domain. This environment lives in Asia-Pacific (Singapore),
  // so the auth domain is pingone.sg — NOT pingone.com. Using the wrong region
  // domain causes a NOT_FOUND error at /authorize.
  //   NA  -> auth.pingone.com   | EU  -> auth.pingone.eu
  //   APAC-> auth.pingone.sg    | CA  -> auth.pingone.ca
  authDomain: 'auth.pingone.com',
  kongBaseUrl: 'REPLACE_WITH_KONG_GATEWAY_BASE_URL',
};

const PING_BASE = `https://${PING_CONFIG.authDomain}/${PING_CONFIG.envId}/as`;

// sessionStorage keys
const TOKEN_KEY = 'pingone_access_token';
const REFRESH_KEY = 'pingone_refresh_token';
const EXPIRY_KEY = 'pingone_token_expiry';
const PKCE_VERIFIER_KEY = 'pkce_verifier';
const OAUTH_STATE_KEY = 'oauth_state';
// Same-frame redirect flow bookkeeping (see redirectAuth()/consumeRedirectResult()).
const REDIRECT_RETURN_KEY = 'pingone_redirect_return_url';
const REDIRECT_RESULT_KEY = 'pingone_redirect_result';

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

// ─── 4. Popup / redirect auth (PKCE authorization code) ────────────────────────

function buildAuthUrl(prompt: 'none' | 'login', codeChallenge: string, state: string): string {
  return (
    `${PING_BASE}/authorize` +
    `?client_id=${encodeURIComponent(PING_CONFIG.clientId)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(PING_CONFIG.scope)}` +
    `&redirect_uri=${encodeURIComponent(PING_CONFIG.redirectUri)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&state=${encodeURIComponent(state)}` +
    `&prompt=${encodeURIComponent(prompt)}`
  );
}

// Silent, same-frame redirect attempt. Navigates the widget's own frame to
// PingOne (single hop — not a nested iframe), relying on PingOne's own
// session cookie already set in the browser (e.g. from the Staffbase login).
// This never "returns" in the normal sense: the page unloads. The result is
// picked back up by consumeRedirectResult() after PingOne redirects back to
// callback.html and callback.html navigates back here.
async function redirectAuth(): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateCodeVerifier();

  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  sessionStorage.setItem(REDIRECT_RETURN_KEY, window.location.href);

  window.location.assign(buildAuthUrl('none', codeChallenge, state));
}

// Checks whether we just navigated back from a redirectAuth() attempt.
// Returns the access token on success, an error code string on failure
// (e.g. 'login_required'), or null if there's no pending redirect result.
async function consumeRedirectResult(): Promise<{ token: string } | { error: string } | null> {
  const raw = sessionStorage.getItem(REDIRECT_RESULT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(REDIRECT_RESULT_KEY);
  sessionStorage.removeItem(REDIRECT_RETURN_KEY);

  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  let data: { code?: string; state?: string; error?: string };
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: 'invalid_response' };
  }

  if (!expectedState || data.state !== expectedState) return { error: 'invalid_state' };
  if (data.error) return { error: data.error };
  if (!data.code) return { error: 'invalid_response' };

  try {
    const token = await exchangeCodeForTokens(data.code);
    return { token };
  } catch {
    return { error: 'token_exchange_failed' };
  }
}

async function popupAuth(prompt: 'none' | 'login'): Promise<string> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateCodeVerifier();

  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const authUrl = buildAuthUrl(prompt, codeChallenge, state);

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

export async function getAccessToken(): Promise<string> {
  // Step 0: did we just land back here from a silent redirectAuth() attempt?
  const redirectResult = await consumeRedirectResult();
  if (redirectResult && 'token' in redirectResult) return redirectResult.token;

  // Step 1: valid stored token
  const stored = getStoredToken();
  if (stored) return stored;

  // Step 2: silent refresh with the refresh token
  const refreshed = await silentRefresh();
  if (refreshed) return refreshed;

  // Step 3a: the redirect attempt already ran once and came back with an
  // error (e.g. no PingOne session) — go straight to interactive login
  // instead of looping back into another silent redirect.
  if (redirectResult && 'error' in redirectResult) {
    const code = await popupAuth('login');
    return await exchangeCodeForTokens(code);
  }

  // Step 3b: kick off the silent, same-frame redirect (prompt=none). This
  // navigates the widget's own frame away — execution stops here for this
  // page load. getAccessToken() picks the result back up (Step 0) the next
  // time the widget mounts after PingOne redirects back.
  await redirectAuth();
  return new Promise<string>(() => { /* navigation in flight; page is unloading */ });
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
