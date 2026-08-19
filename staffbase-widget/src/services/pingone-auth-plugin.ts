// PingOne authentication — PKCE authorization-code flow for the auth plugin.
//
// Used exclusively by PingOneAuthPlugin / pingone-auth-index.tsx.
// The existing widget auth (pingone-auth.ts) is untouched.
//
// Silent path  : hidden iframe with prompt=none (no user-visible window).
// Interactive  : visible iframe injected into a caller-supplied container element.
//
// Security notes:
//   - Public SPA client — NO client_secret. PKCE protects the code exchange.
//   - Tokens live in sessionStorage (cleared when the tab closes).

// ─── Config ──────────────────────────────────────────────────────────────────

declare const process: { env: Record<string, string> };

const PING_CONFIG = {
  envId:       '6c0241eb-6d4c-4b98-bdfb-5ab44b0d7112',
  clientId:    '2fd84c5a-722e-44b8-a864-f736bc648eb3',
  redirectUri: process.env.PINGONE_PLUGIN_REDIRECT_URI ||
               'https://happy-island-0506c550f.7.azurestaticapps.net/pingone-callback.html',
  scope:       'openid profile email offline_access',
  authDomain:  'auth.pingone.com',
  kongBaseUrl: 'REPLACE_WITH_KONG_GATEWAY_BASE_URL',
};

const PING_BASE = `https://${PING_CONFIG.authDomain}/${PING_CONFIG.envId}/as`;

// sessionStorage keys — prefixed with 'plugin_' to avoid colliding with the
// widget's own keys from pingone-auth.ts.
const TOKEN_KEY         = 'plugin_pingone_access_token';
const REFRESH_KEY       = 'plugin_pingone_refresh_token';
const EXPIRY_KEY        = 'plugin_pingone_token_expiry';
const PKCE_VERIFIER_KEY = 'plugin_pkce_verifier';
const OAUTH_STATE_KEY   = 'plugin_oauth_state';

// ─── 1. PKCE utilities ───────────────────────────────────────────────────────

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
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

// ─── 2. Token storage (sessionStorage) ──────────────────────────────────────

function storeTokens(accessToken: string, refreshToken: string | null, expiresIn: number): void {
  sessionStorage.setItem(TOKEN_KEY,  accessToken);
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresIn * 1_000));
}

function getStoredToken(): string | null {
  const token  = sessionStorage.getItem(TOKEN_KEY);
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

// ─── 3. Silent refresh (refresh_token grant) ─────────────────────────────────

async function silentRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${PING_BASE}/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     PING_CONFIG.clientId,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.access_token) return null;
    storeTokens(data.access_token, data.refresh_token || refreshToken, Number(data.expires_in) || 3_600);
    return data.access_token as string;
  } catch {
    return null;
  }
}

// ─── 4. Iframe auth ──────────────────────────────────────────────────────────
//
// prompt=login : visible iframe injected into `container` (owned by PingOneAuthPlugin).
// On Staffbase with SSO the silent iframe (prompt=none) is not needed — the
// interactive iframe completes immediately because a PingOne session already exists.

function buildAuthUrl(challenge: string, state: string, prompt?: string): string {
  let url =
    `${PING_BASE}/authorize` +
    `?client_id=${encodeURIComponent(PING_CONFIG.clientId)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(PING_CONFIG.scope)}` +
    `&redirect_uri=${encodeURIComponent(PING_CONFIG.redirectUri)}` +
    `&code_challenge=${encodeURIComponent(challenge)}` +
    `&code_challenge_method=S256` +
    `&state=${encodeURIComponent(state)}`;
  if (prompt) url += `&prompt=${encodeURIComponent(prompt)}`;
  return url;
}

async function iframeAuth(
  prompt: 'none' | 'login',
  container: HTMLElement = document.body
): Promise<string> {
  const codeVerifier  = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state         = generateCodeVerifier();

  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(OAUTH_STATE_KEY,   state);

  const authUrl        = buildAuthUrl(codeChallenge, state, prompt);
  const redirectOrigin = new URL(PING_CONFIG.redirectUri).origin;

  const iframe = document.createElement('iframe');
  if (prompt === 'none') {
    iframe.style.cssText =
      'position:fixed;width:1px;height:1px;top:-200px;left:-200px;' +
      'border:none;opacity:0;pointer-events:none;';
  } else {
    iframe.style.cssText =
      'width:100%;height:480px;border:none;border-radius:8px;display:block;';
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', handler);
      clearTimeout(timer);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const handler = (event: MessageEvent) => {
      if (event.origin !== redirectOrigin) return;
      const data = (event.data || {}) as Record<string, string>;
      if (data.state !== state) return;
      if (settled)              return;
      settled = true;
      cleanup();
      if (data.error)     reject(new Error(data.error));
      else if (data.code) resolve(data.code);
      else                reject(new Error('invalid_response'));
    };

    const timeoutMs = prompt === 'none' ? 5_000 : 120_000;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('timeout'));
    }, timeoutMs);

    window.addEventListener('message', handler);
    container.appendChild(iframe);
    iframe.src = authUrl;
  });
}

// ─── 5. Token exchange (authorization_code grant) ────────────────────────────

async function exchangeCodeForTokens(code: string): Promise<string> {
  const res = await fetch(`${PING_BASE}/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  PING_CONFIG.redirectUri,
      client_id:     PING_CONFIG.clientId,
      code_verifier: sessionStorage.getItem(PKCE_VERIFIER_KEY) || '',
    }).toString(),
  });
  if (!res.ok) throw new Error('token_exchange_failed');
  const data = await res.json();
  if (!data?.access_token) throw new Error('token_exchange_failed');
  storeTokens(data.access_token, data.refresh_token || null, Number(data.expires_in) || 3_600);
  return data.access_token as string;
}

// ─── 6. Public API ───────────────────────────────────────────────────────────

// Tries stored token → silent refresh → throws 'login_required' so the plugin
// can show the interactive login iframe.
export async function getAccessToken(): Promise<string> {
  const stored = getStoredToken();
  if (stored) return stored;

  const refreshed = await silentRefresh();
  if (refreshed) return refreshed;

  // No active session — let the plugin show the interactive login iframe.
  throw new Error('login_required');
}

// Injects a visible PingOne login iframe into `container`.
// Called by PingOneAuthPlugin after getAccessToken() throws 'login_required'.
export async function authenticateInteractive(container: HTMLElement): Promise<string> {
  const code = await iframeAuth('login', container);
  return exchangeCodeForTokens(code);
}

// ─── 7. Kong API call wrapper ─────────────────────────────────────────────────

export async function fetchFromKong(path: string, options: RequestInit = {}): Promise<any> {
  const call = (token: string): Promise<Response> =>
    fetch(`${PING_CONFIG.kongBaseUrl}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });

  let token = await getAccessToken();
  let res   = await call(token);

  if (res.status === 401) {
    clearTokens();
    token = await getAccessToken();
    res   = await call(token);
  }

  return res.json();
}
