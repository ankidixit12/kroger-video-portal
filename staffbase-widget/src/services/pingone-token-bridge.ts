// ── PingOne Token Bridge ─────────────────────────────────────────────────────
//
// Shared token storage and cross-widget communication.
//
// The auth plugin calls storeSharedToken() after a successful PingOne login.
// Every other widget on the same page calls requestSharedToken() to get the
// current access token without doing its own auth dance.
//
// Transport layer:
//   - sessionStorage  — fast synchronous read; cleared when the tab closes
//   - BroadcastChannel — push notification so widgets that loaded before the
//     auth plugin can still receive the token once it is ready

const CHANNEL_NAME = 'kroger-pingone-auth';
const TOKEN_KEY    = 'kroger_pingone_token';
const EXPIRY_KEY   = 'kroger_pingone_expiry';

// ─── Auth-plugin side ────────────────────────────────────────────────────────

export function storeSharedToken(token: string, expiresIn: number): void {
  const expiresAt = Date.now() + expiresIn * 1_000;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRY_KEY, String(expiresAt));
  _broadcast({ type: 'TOKEN_READY', token, expiresAt });
}

export function clearSharedToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
}

// Registers a listener so the auth plugin can re-broadcast the token on demand.
// Returns an unsubscribe function — call it on plugin unmount.
export function listenForTokenRequests(
  onRequest: () => void
): () => void {
  let ch: BroadcastChannel | null = null;
  try {
    ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (e) => {
      if (e.data?.type === 'TOKEN_REQUEST') onRequest();
    };
  } catch {
    // BroadcastChannel unavailable (very old browser) — silent no-op
  }
  return () => { try { ch?.close(); } catch {} };
}

// ─── Consumer-widget side ────────────────────────────────────────────────────

// 30-second headroom: don't return a token that expires in under 30 s
const EXPIRY_HEADROOM_MS = 30_000;

function _getStored(): string | null {
  const token  = sessionStorage.getItem(TOKEN_KEY);
  const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) || 0);
  if (token && expiry - Date.now() > EXPIRY_HEADROOM_MS) return token;
  return null;
}

// Returns the shared token from the auth plugin.
// If the auth plugin hasn't finished yet, waits up to 15 s for it to broadcast.
export function requestSharedToken(timeoutMs = 15_000): Promise<string> {
  const cached = _getStored();
  if (cached) return Promise.resolve(cached);

  return new Promise<string>((resolve, reject) => {
    let ch: BroadcastChannel | null = null;

    const timer = setTimeout(() => {
      try { ch?.close(); } catch {}
      reject(new Error('auth_plugin_timeout'));
    }, timeoutMs);

    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (e) => {
        if (e.data?.type === 'TOKEN_READY') {
          clearTimeout(timer);
          try { ch?.close(); } catch {}
          resolve(e.data.token as string);
        }
      };
    } catch {
      clearTimeout(timer);
      reject(new Error('BroadcastChannel_unavailable'));
      return;
    }

    // Ask the auth plugin to re-broadcast whatever token it already holds
    _broadcast({ type: 'TOKEN_REQUEST' });
  });
}

// ─── Internal helper ─────────────────────────────────────────────────────────

function _broadcast(msg: object): void {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage(msg);
    ch.close();
  } catch {}
}
