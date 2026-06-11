import { DIVISION_VIDEOS } from '../videoData';
import type { VideoEntry } from '../videoData';

// webpack DefinePlugin replaces process.env.API_BASE_URL at build time
declare const process: { env: Record<string, string | undefined> };
const BASE_URL: string = process.env.API_BASE_URL || 'http://localhost:3000';

const DIVISION_COLORS: Record<string, string> = {
  Dallas: '#004990', 'Fred Meyer': '#1a6b3a', Atlanta: '#EF3E42',
  "Roundy's": '#5B2C8D', Ruler: '#d46b00', "Smith's": '#0057a8',
  Michigan: '#2e7d32', Columbus: '#37474f',
};

const DIVISION_REGION: Record<string, string> = {
  Dallas: 'South',
  'Fred Meyer': 'Pacific Northwest',
  Atlanta: 'Southeast',
  "Roundy's": 'Midwest',
  Ruler: 'Midwest',
  "Smith's": 'Mountain West',
  Michigan: 'Midwest',
  Columbus: 'Midwest',
};

const SERIES_CATEGORY: Record<string, string> = {
  'Operations Training Series': 'Training',   'Customer Experience Series': 'Training',
  'Compliance & Safety Series': 'Training',   'Fresh Department Series': 'Training',
  'Technology Training Series': 'Training',   'A Fresh Welcome Orientation': 'Training',
  'Leadership Development Series': 'HR & Benefits',
  'Brand & Culture Series': 'Corporate',      'Regional Leadership Series': 'Corporate',
  'Community Impact Series': 'Corporate',
};

export interface VideoItem {
  id: string | number;
  title: string;
  description: string;
  series?: string;
  author?: string;
  duration: string;
  category: string;
  division?: string;
  region?: string;
  publishedAt: string;
  expiryDate?: string;
  thumbnailColor: string;
  thumbnailUrl?: string;
  videoUrl: string;
}

export interface FetchParams {
  category?: string;
  limit?: number;
}

function buildFallback(category?: string): VideoItem[] {
  let uid = 1;
  const all: VideoItem[] = [];
  Object.keys(DIVISION_VIDEOS).forEach(function(div) {
    DIVISION_VIDEOS[div].forEach(function(v: VideoEntry) {
      all.push({
        id: String(uid++),
        title: v.title,
        description: v.series + ' — ' + v.author,
        series: v.series,
        author: v.author,
        duration: v.duration,
        category: SERIES_CATEGORY[v.series] || 'Corporate',
        division: div,
        region: DIVISION_REGION[div] || 'Other',
        publishedAt: v.publishDate,
        expiryDate: v.expiryDate,
        thumbnailColor: DIVISION_COLORS[div] || '#004990',
        videoUrl: v.url,
      });
    });
  });
  return category && category !== 'all'
    ? all.filter(function(v) { return v.category === category; })
    : all;
}

export async function fetchVideos(params?: FetchParams): Promise<VideoItem[]> {
  const query = new URLSearchParams();
  if (params && params.category && params.category !== 'all') query.set('category', params.category);
  if (params && params.limit) query.set('_limit', String(params.limit));

  const qs  = query.toString();
  const url = BASE_URL + '/api/qumu_cloud' + (qs ? '?' + qs : '');

  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, 30000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : (data as any).data || [];
  } catch (err) {
    clearTimeout(timer);
    console.warn('[Demo] API unavailable — showing fallback data');
    return buildFallback(params && params.category);
  }
}
