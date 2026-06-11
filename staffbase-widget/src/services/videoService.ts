const QUMU_API = 'https://staffbase-qumu-service-gfh7bccrescea0fe.eastus-01.azurewebsites.net/staffbase-qumu/kulus';

const DIVISION_COLORS: Record<string, string> = {
  Dallas: '#004990', 'Fred Meyer': '#1a6b3a', Atlanta: '#EF3E42',
  "Roundy's": '#5B2C8D', Ruler: '#d46b00', "Smith's": '#0057a8',
  Michigan: '#2e7d32', Columbus: '#37474f', GO: '#004990',
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
  page?: number;
}

function msToDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec < 10 ? '0' + sec : sec}`;
}

function getMeta(metadata: any[], title: string): string | null {
  const field = (metadata || []).find((m: any) => m.title === title);
  if (!field || field.value == null) return null;
  if (Array.isArray(field.value)) return field.value.length ? field.value[0] : null;
  if (typeof field.value === 'object') return null;
  return String(field.value);
}

function mapKuluToVideoItem(k: any): VideoItem {
  const division = getMeta(k.metadata, 'Division') || '';
  const category = getMeta(k.metadata, 'Category') || 'Corporate';
  const description = getMeta(k.metadata, 'Description') || '';
  const metaAuthor = getMeta(k.metadata, 'Author');
  const author = metaAuthor || (k.publisher && k.publisher.name) || '';

  return {
    id: k.guid,
    title: k.title || '',
    description,
    author,
    duration: k.duration ? msToDuration(k.duration) : '0:00',
    category,
    division: division || undefined,
    publishedAt: k.published || k.created || '',
    thumbnailColor: DIVISION_COLORS[division] || DIVISION_COLORS[author] || '#004990',
    thumbnailUrl: k.thumbnail && k.thumbnail.url ? k.thumbnail.url : undefined,
    videoUrl: k.player || '',
  };
}

export async function fetchVideos(params?: FetchParams): Promise<VideoItem[]> {
  const query = new URLSearchParams();
  query.set('page', String((params && params.page) || 1));
  query.set('perPage', String((params && params.limit) || 20));
  query.set('sort', '-updatedAt');

  const url = `${QUMU_API}?${query.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    const items: VideoItem[] = (data.kulus || []).map(mapKuluToVideoItem);

    if (params && params.category && params.category !== 'all') {
      return items.filter(v => v.category === params.category);
    }
    return items;
  } catch (err) {
    clearTimeout(timer);
    console.warn('[VideoService] API unavailable', err);
    return [];
  }
}
