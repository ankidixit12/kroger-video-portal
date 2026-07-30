const https = require('https');
const {
  DEFAULT_THUMBNAIL_COLOR,
  DIVISION_COLORS,
  getCorsHeaders,
  getQumuConfig,
  hasQumuConfig,
} = require('./portal/config/constants');

function getMeta(metadata, title) {
  const arr = Array.isArray(metadata) ? metadata : [];
  const field = arr.find((m) => m && m.title === title);
  if (!field || field.value == null) return '';
  if (Array.isArray(field.value)) {
    if (!field.value.length) return '';
    const first = field.value[0];
    if (first && typeof first === 'object') return String(first.value || first.name || '');
    return String(first || '');
  }
  if (typeof field.value === 'object') return String(field.value.value || field.value.name || '');
  return String(field.value);
}

function toDuration(ms) {
  const total = Math.floor((Number(ms) || 0) / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
}

function mapQumuVideo(k) {
  const division = getMeta(k.metadata, 'Division');
  const category = getMeta(k.metadata, 'Category') || 'Corporate';
  const description = getMeta(k.metadata, 'Description') || '';
  return {
    id: String(k.guid || ''),
    title: String(k.title || ''),
    description,
    series: category,
    author: String((k.publisher && k.publisher.name) || ''),
    duration: toDuration(k.duration),
    category,
    publishedAt: String(k.published || k.created || ''),
    expiryDate: String(k.withdrawOn || k.expiryDate || ''),
    thumbnailColor: DIVISION_COLORS[division] || DEFAULT_THUMBNAIL_COLOR,
    videoUrl: String(k.player || ''),
  };
}

function createHandler(deps = {}) {
  const httpsModule = deps.https || https;
  const getCorsHeadersFn = deps.getCorsHeaders || getCorsHeaders;
  const getQumuConfigFn = deps.getQumuConfig || getQumuConfig;
  const hasQumuConfigFn = deps.hasQumuConfig || hasQumuConfig;

  return function handler(req, res) {
    const corsHeaders = getCorsHeadersFn(req.headers.origin, { includeMethods: true });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (!hasQumuConfigFn()) {
      res.status(500).json({ error: 'QUMU environment variables are not configured' });
      return;
    }

    const { category } = req.query;
    const rawLimit = parseInt(req.query._limit || '0', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 100;

    const query = new URLSearchParams();
    query.set('offset', '0');
    query.set('limit', String(limit));

    const { username, password, serviceUrl } = getQumuConfigFn();
    const qumuUrl = `${serviceUrl}/kulus?${query}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    httpsModule.get(qumuUrl, {
      headers: {
        Authorization: authHeader,
        'User-Agent': 'Kroger-Video-Portal',
      },
    }, (proxyRes) => {
      let body = '';
      proxyRes.setEncoding('utf8');
      proxyRes.on('data', (chunk) => { body += chunk; });
      proxyRes.on('end', () => {
        if ((proxyRes.statusCode || 500) >= 400) {
          res.status(proxyRes.statusCode || 502).json({ error: 'QUMU service error' });
          return;
        }
        try {
          const parsed = JSON.parse(body);
          let videos = Array.isArray(parsed.kulus) ? parsed.kulus.map(mapQumuVideo) : [];
          if (category) videos = videos.filter((v) => v.category === category);
          if (rawLimit > 0) videos = videos.slice(0, rawLimit);
          res.status(200).json(videos);
        } catch (_err) {
          res.status(502).json({ error: 'Invalid QUMU response' });
        }
      });
    }).on('error', () => {
      res.status(502).json({ error: 'Bad Gateway: QUMU service unavailable' });
    });
  };
}

const handler = createHandler();

module.exports = handler;
module.exports.createHandler = createHandler;
module.exports._test = {
  getMeta,
  mapQumuVideo,
  toDuration,
};
