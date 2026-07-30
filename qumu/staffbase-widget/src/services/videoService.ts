declare const process: { env: Record<string, string> };

import {
  DEFAULT_INSTALLATION_ID,
  DEFAULT_THUMBNAIL_COLOR,
  QUMU_KULUS_BASE_URL,
  QUMU_TOKEN_BASE_URL,
  QUMU_POST_BASE_URL,
  STAFFBASE_BASE_URL,
} from '../constants';

let _staffbaseBase  = STAFFBASE_BASE_URL;
let _installationId = DEFAULT_INSTALLATION_ID;
let _pluginId = DEFAULT_INSTALLATION_ID;

export function setStaffbaseBaseUrl(url: string): void {
  if (url) _staffbaseBase = url.replace(/\/$/, '');
}

export function setInstallationId(id: string): void {
  if (id) _installationId = id;
}

export function setPluginId(id: string): void {
  if (id && id !== _pluginId) { _pluginId = id; _cachedToken = null; }
}

export function getQumuPostUrl(postId: string): string {
  return `${QUMU_POST_BASE_URL}/${postId}`;
}

function basicAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const u = process.env.QUMU_USERNAME || '';
  const p = process.env.QUMU_PASSWORD || '';
  return { Authorization: 'Basic ' + btoa(u + ':' + p), ...extra };
}

// ─── Token ────────────────────────────────────────────────────────────────────

let _cachedToken: string | null = null;

async function fetchQumuToken(): Promise<string> {
  if (!_pluginId) throw new Error('QUMU plugin ID is not configured');
  if (_cachedToken) return _cachedToken;
  const res = await fetch(`${QUMU_TOKEN_BASE_URL}/${_pluginId}`, {
    headers: basicAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('fetchQumuToken HTTP ' + res.status);
  const json = await res.json();
  const jwt = json?.jwt;
  if (!jwt || typeof jwt !== 'string') throw new Error('fetchQumuToken: missing or invalid JWT in response');
  _cachedToken = jwt;
  return _cachedToken;
}

async function apiHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await fetchQumuToken();
  return { ...basicAuthHeaders(), Authorization_jwt: token, ...extra };
}

export async function getQumuApiHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  return apiHeaders(extra);
}

// Clears the cached token and retries once on 401 Unauthorized.
async function apiFetch(url: string): Promise<Response> {
  let res = await fetch(url, { headers: await apiHeaders(), credentials: 'include' });
  if (res.status === 401) {
    _cachedToken = null;
    res = await fetch(url, { headers: await apiHeaders(), credentials: 'include' });
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
    thumbnailColor: DEFAULT_THUMBNAIL_COLOR,
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

  const res = await apiFetch(`${QUMU_KULUS_BASE_URL}?${query}`);
  if (!res.ok) throw new Error('fetchVideos HTTP ' + res.status);
  const data = await res.json();
  return {
    items: (Array.isArray(data.kulus) ? data.kulus : []).map(safeMapKulu).filter((v: VideoItem | null): v is VideoItem => v !== null),
    total: data.total ?? 0,
  };
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

  const url = `${QUMU_KULUS_BASE_URL}?${query}`;
  const res = await apiFetch(url);
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
  const url = `${QUMU_KULUS_BASE_URL}/masterdata/kulutypes?titles=${encodeURIComponent(titles.join(','))}`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('fetchMasterData HTTP ' + res.status);
  const data = await res.json();
  return Array.isArray(data?.metadata) ? data.metadata : [];
}
