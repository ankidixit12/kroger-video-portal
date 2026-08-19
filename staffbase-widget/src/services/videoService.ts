import { getAccessToken } from "./pingone-auth";

function escapeSqlWildcards(s: string): string {
  return s.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

let _staffbaseBase  = 'https://krogertest.staffbase.com';
let _installationId = '6a3bd7361da609538cb79dac';
let _pluginId = '6a62f458a1562171e13f19d1';

declare const process: { env: { QUMU_API_URL: string } };
const QUMU_BASE = process.env.QUMU_API_URL;

const QUMU_TOKEN_BASE = '/api/installations';

export function setStaffbaseBaseUrl(url: string): void {
  if (url) _staffbaseBase = url.replace(/\/$/, '');
}

export function setInstallationId(id: string): void {
  if (id) _installationId = id;
}

export function setPluginId(id: string): void {
  if (id && id !== _pluginId) { _pluginId = id; }
}

export const AUTH_HEADER: Record<string, string> = {};


// ─── Token ────────────────────────────────────────────────────────────────────

export async function fetchQumuToken(): Promise<string> {
  if (!_pluginId) throw new Error('QUMU plugin ID is not configured');
  const res = await fetch(`${QUMU_TOKEN_BASE}/${_pluginId}/service/token`);
  if (!res.ok) throw new Error('fetchQumuToken HTTP ' + res.status);
  const json = await res.json();
  const jwt = json?.jwt;
  if (!jwt || typeof jwt !== 'string') throw new Error('fetchQumuToken: missing or invalid JWT in response');
  return jwt;
}

async function apiHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, ...extra };
}

// Retries once on 401 Unauthorized with a newly fetched token.
async function apiFetch(url: string): Promise<Response> {
  let res = await fetch(url, { headers: await apiHeaders() });
  if (res.status === 401) {
    res = await fetch(url, { headers: await apiHeaders() });
  }
  return res;
}

async function apiPost(url: string, body: unknown): Promise<Response> {
  const headers = { ...(await apiHeaders()), 'Content-Type': 'application/json' };
  let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status === 401) {
    const retryHeaders = { ...(await apiHeaders()), 'Content-Type': 'application/json' };
    res = await fetch(url, { method: 'POST', headers: retryHeaders, body: JSON.stringify(body) });
  }
  return res;
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
  if (Array.isArray(field.value)) {
    if (!field.value.length) return null;
    const first = field.value[0];
    if (first && typeof first === 'object') {
      return first.value !== undefined ? String(first.value) : (first.name !== undefined ? String(first.name) : null);
    }
    return String(first);
  }
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

function safeMapKulu(k: any): VideoItem | null {
  try { return mapKuluToVideoItem(k); } catch { return null; }
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
}): Promise<FetchResult> {
  const query = new URLSearchParams();
  query.set('offset', String(params?.offset ?? 0));
  query.set('limit',  String(params?.limit  ?? 10));

  const res = await apiFetch(`${QUMU_BASE}?${query}`);
  if (!res.ok) throw new Error('fetchVideos HTTP ' + res.status);
  const data = await res.json();
  return {
    items: (Array.isArray(data.kulus) ? data.kulus : []).map(safeMapKulu).filter((v: VideoItem | null): v is VideoItem => v !== null),
    total: data.total ?? 0,
  };
}

export async function fetchVideosByFilter(params: {
  offset?:  number;
  limit?:   number;
  rules?:   PlaylistRule[];
  search?:  string;
}): Promise<FetchResult> {
  const query = new URLSearchParams();
  query.set('offset', String(params.offset ?? 0));
  query.set('limit',  String(params.limit  ?? 10));

  const bodyRules: Array<{ comparator: string; field: { guid?: string; name?: string }; value: string }> = [];

  for (const r of (params.rules ?? [])) {
    bodyRules.push({ comparator: 'CONTAINS', field: { guid: r.fieldGuid }, value: r.optionGuid });
  }

  if (params.search) {
    bodyRules.push({ comparator: 'CONTAINS', field: { name: 'title' }, value: escapeSqlWildcards(params.search) });
  }

  bodyRules.push({ comparator: 'IS', field: { name: 'state' }, value: 'PUBLISHED' });

  const url = `${QUMU_BASE}/search?${query}`;
  const res = await apiPost(url, { playlist: { matchAll: true, rules: bodyRules } });
  if (res.status === 404) return { items: [], total: 0 };
  if (!res.ok) throw new Error('fetchVideosByFilter HTTP ' + res.status);
  const raw = await res.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { throw new Error('fetchVideosByFilter: invalid JSON response'); }
  return {
    items: (Array.isArray(data.kulus) ? data.kulus : []).map(safeMapKulu).filter((v: VideoItem | null): v is VideoItem => v !== null),
    total: data.total ?? 0,
  };
}

export async function fetchMasterData(titles: string[]): Promise<MetadataType[]> {
  const url = `${QUMU_BASE}/masterdata/kulutypes?titles=${encodeURIComponent(titles.join(','))}`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('fetchMasterData HTTP ' + res.status);
  const data = await res.json();
  return Array.isArray(data?.metadata) ? data.metadata : [];
}
