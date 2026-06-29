declare const process: { env: Record<string, string> };

// On localhost requests go through the webpack proxy to avoid CORS.
// In production the direct Azure URL is used (Staffbase origin is allowed by the QUMU service).
const _isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

let _staffbaseBase  = 'https://krogertest.staffbase.com';
let _installationId = '6a3bd7361da609538cb79dac';
let _pluginId       = _isLocalhost ? '6a0cc22372fe006d424385a2' : '';

const QUMU_BASE = _isLocalhost
  ? '/api/kulus'
  : 'https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu/kulus';

const QUMU_TOKEN_BASE = 'https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu/api/token';

export function setStaffbaseBaseUrl(url: string): void {
  if (url) _staffbaseBase = url.replace(/\/$/, '');
}

export function setInstallationId(id: string): void {
  if (id) _installationId = id;
}

export function setPluginId(id: string): void {
  if (id) { _pluginId = id; _cachedToken = null; }
}

export const AUTH_HEADER: Record<string, string> = {};

function basicAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const u = process.env.QUMU_USERNAME || '';
  const p = process.env.QUMU_PASSWORD || '';
  return { Authorization: 'Basic ' + btoa(u + ':' + p), ...extra };
}

// ─── Token ────────────────────────────────────────────────────────────────────

let _cachedToken: string | null = null;

async function fetchQumuToken(): Promise<string> {
  if (_cachedToken) return _cachedToken;
  const res = await fetch(`${QUMU_TOKEN_BASE}/${_pluginId}`, {
    headers: basicAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('fetchQumuToken HTTP ' + res.status);
  const json = await res.json();
  _cachedToken = json.jwt as string;
  return _cachedToken;
}

async function apiHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await fetchQumuToken();
  return { ...basicAuthHeaders(), Authorization_jwt: token, ...extra };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MetadataOption {
  guid: string;
  value: string;
}

export interface MetadataType {
  guid: string;
  title: string;
  options: MetadataOption[];
}

export interface PlaylistRule {
  fieldGuid:   string;
  fieldTitle:  string;
  optionGuid:  string;
  optionValue: string;
}

export interface FetchResult {
  items: VideoItem[];
  total: number;
}

export interface VideoItem {
  id: string | number;
  title: string;
  description: string;
  author?: string;
  duration: string;
  category: string;
  division?: string;
  publishedAt: string;
  expiryDate?: string;
  withdrawOn?: string;
  thumbnailColor: string;
  thumbnailUrl?: string;
  videoUrl: string;
  state: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIVISION_COLORS: Record<string, string> = {
  Dallas: '#004990', 'Fred Meyer': '#1a6b3a', Atlanta: '#EF3E42',
  "Roundy's": '#5B2C8D', Ruler: '#d46b00', "Smith's": '#0057a8',
  Michigan: '#2e7d32', Columbus: '#37474f', GO: '#004990',
};

function msToDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
}

function getMeta(metadata: any[], title: string): string | null {
  const field = (metadata || []).find((m: any) => m.title === title);
  if (!field || field.value == null) return null;
  if (Array.isArray(field.value)) return field.value.length ? String(field.value[0]) : null;
  if (typeof field.value === 'object') {
    return field.value?.value !== undefined ? String(field.value.value) : null;
  }
  return String(field.value);
}

function safeString(val: any): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (val.value !== undefined) return String(val.value);
    if (val.name  !== undefined) return String(val.name);
    return '';
  }
  return String(val);
}

function mapKuluToVideoItem(k: any): VideoItem {
  const division    = getMeta(k.metadata, 'Division') || '';
  const category    = getMeta(k.metadata, 'Category') || 'Corporate';
  const description = getMeta(k.metadata, 'Description') || '';
  const metaAuthor  = getMeta(k.metadata, 'Author');
  const author      = safeString(metaAuthor || k.publisher?.name || '');

  return {
    id:             k.guid,
    title:          safeString(k.title || ''),
    description:    safeString(description),
    author,
    duration:       k.duration ? msToDuration(k.duration) : '00:00',
    category:       safeString(category),
    division:       division ? safeString(division) : undefined,
    publishedAt:    safeString(k.published || k.created || ''),
    expiryDate:     safeString(k.withdrawOn || k.expiryDate || ''),
    withdrawOn:     k.withdrawOn ? safeString(k.withdrawOn) : undefined,
    thumbnailColor: DIVISION_COLORS[division] || '#004990',
    thumbnailUrl:   k.thumbnail ? (k.thumbnail.cdnUrl || k.thumbnail.url || undefined) : undefined,
    videoUrl:       safeString(k.player || ''),
    state:          safeString(k.state || 'PUBLISHED'),
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function fetchVideos(params?: {
  offset?: number;
  limit?:  number;
  search?: string;
}): Promise<FetchResult> {
  const query = new URLSearchParams();
  query.set('offset', String(params?.offset ?? 0));
  query.set('limit',  String(params?.limit  ?? 10));
  if (params?.search) query.set('search', `title,CONTAINS,${params.search}`);

  const res = await fetch(`${QUMU_BASE}?${query}`, { headers: await apiHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error('fetchVideos HTTP ' + res.status);
  const data = await res.json();
  return { items: (data.kulus || []).map(mapKuluToVideoItem), total: data.total ?? 0 };
}

export async function fetchVideosByFilter(params: {
  offset?:   number;
  limit?:    number;
  rules:     PlaylistRule[];
}): Promise<FetchResult> {
  const query = new URLSearchParams();
  query.set('offset', String(params.offset ?? 0));
  query.set('limit',  String(params.limit  ?? 10));

  // QUMU GET search format: "<fieldGuid>,CONTAINS,<optionGuid>"
  // Multiple rules are joined with semicolons
  const searchParts = params.rules.map(r => `${r.fieldGuid},CONTAINS,${r.optionGuid}`);
  if (searchParts.length > 0) query.set('search', searchParts.join(';'));

  const url = `${QUMU_BASE}?${query}`;
  console.log('[KrogerWidget] fetchVideosByFilter GET', url);

  const res = await fetch(url, { headers: await apiHeaders(), credentials: 'include' });
  const raw = await res.text();
  console.log('[KrogerWidget] filterResponse', res.status, raw.slice(0, 500));
  if (res.status === 404) return { items: [], total: 0 };
  if (!res.ok) throw new Error('fetchVideosByFilter HTTP ' + res.status);
  const data = JSON.parse(raw);
  return { items: (data.kulus || []).map(mapKuluToVideoItem), total: data.total ?? 0 };
}

export async function fetchMasterData(titles: string[]): Promise<MetadataType[]> {
  const url = `${QUMU_BASE}/masterdata/kulutypes?titles=${encodeURIComponent(titles.join(','))}`;
  const res = await fetch(url, { headers: await apiHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error('fetchMasterData HTTP ' + res.status);
  const data = await res.json();
  return data.metadata || [];
}
