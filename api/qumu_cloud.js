const https = require('https');

const QUMU_USERNAME = process.env.QUMU_USERNAME || 'qumu';
const QUMU_PASSWORD = process.env.QUMU_PASSWORD || 'qumu@123456';
const QUMU_SERVICE_URL = 'https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu';

const DIVISION_COLORS = {
  Dallas: '#004990', 'Fred Meyer': '#1a6b3a', Atlanta: '#EF3E42',
  "Roundy's": '#5B2C8D', Ruler: '#d46b00', "Smith's": '#0057a8',
  Michigan: '#2e7d32', Columbus: '#37474f',
};

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
    thumbnailColor: DIVISION_COLORS[division] || '#004990',
    videoUrl: String(k.player || ''),
  };
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { category } = req.query;
  const rawLimit = parseInt(req.query._limit || '0', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 100;

  const query = new URLSearchParams();
  query.set('offset', '0');
  query.set('limit', String(limit));

  const qumuUrl = `${QUMU_SERVICE_URL}/kulus?${query}`;
  const authHeader = 'Basic ' + Buffer.from(`${QUMU_USERNAME}:${QUMU_PASSWORD}`).toString('base64');

  https.get(qumuUrl, {
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
