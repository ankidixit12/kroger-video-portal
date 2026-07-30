const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const {
  DEFAULT_THUMBNAIL_COLOR,
  DIVISION_COLORS,
  getCorsHeaders,
  LOCAL_INSTALLATION_ID,
  PORT,
  getQumuConfig,
  hasQumuConfig,
} = require('./config/constants');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
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
    thumbnailColor: DIVISION_COLORS[division] || DEFAULT_THUMBNAIL_COLOR,
    videoUrl: String(k.player || ''),
  };
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/api/qumu_cloud') {
    const corsHeaders = getCorsHeaders(req.headers.origin);
    if (!hasQumuConfig()) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: 'QUMU environment variables are not configured' }));
      return;
    }

    const qs = new URLSearchParams(req.url.split('?')[1] || '');
    const category = qs.get('category') || '';
    const limit = parseInt(qs.get('_limit') || '0', 10);

    const query = new URLSearchParams();
    query.set('offset', '0');
    query.set('limit', String(limit > 0 ? Math.min(limit, 100) : 100));
    const { username, password, serviceUrl } = getQumuConfig();
    const qumuUrl = `${serviceUrl}/kulus?${query}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    const proxyReq = https.get(qumuUrl, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'Kroger-Video-Portal',
      },
    }, (proxyRes) => {
      let body = '';
      proxyRes.setEncoding('utf8');
      proxyRes.on('data', (chunk) => { body += chunk; });
      proxyRes.on('end', () => {
        if ((proxyRes.statusCode || 500) >= 400) {
          res.writeHead(proxyRes.statusCode || 502, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({ error: 'QUMU service error' }));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          let videos = Array.isArray(parsed.kulus) ? parsed.kulus.map(mapQumuVideo) : [];
          if (category) videos = videos.filter((v) => v.category === category);
          if (limit > 0) videos = videos.slice(0, limit);
          res.writeHead(200, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify(videos));
        } catch (_err) {
          res.writeHead(502, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({ error: 'Invalid QUMU response' }));
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error('QUMU cloud proxy error:', err);
      res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ error: 'Bad Gateway: QUMU service unavailable' }));
    });
    return;
  }

  if (url === `/api/installations/${LOCAL_INSTALLATION_ID}/service/token`) {
    const token = process.env.LOCAL_SERVICE_TOKEN || 'local-dev-service-token';
    const corsHeaders = getCorsHeaders(req.headers.origin, { allowCredentials: true });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      ...corsHeaders,
    });
    res.end(JSON.stringify({
      token,
      tokenType: 'Bearer',
      expiresIn: 3600,
      installationId: LOCAL_INSTALLATION_ID,
    }));
    return;
  }

  // Proxy /api/kulus requests to QUMU service
  if (url.startsWith('/api/kulus')) {
    const corsHeaders = getCorsHeaders(req.headers.origin);
    if (!hasQumuConfig()) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ error: 'QUMU environment variables are not configured' }));
      return;
    }

    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathAfterPrefix = parsedUrl.pathname.replace(/^\/api\/kulus/, '');
    const { username, password, serviceUrl } = getQumuConfig();
    const qumuUrl = `${serviceUrl}/kulus${pathAfterPrefix}${parsedUrl.search || ''}`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    
    const proxyReq = https.get(qumuUrl, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'Kroger-Video-Portal',
      },
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        ...corsHeaders,
      });
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('QUMU proxy error:', err);
      res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ error: 'Bad Gateway: QUMU service unavailable' }));
    });
    return;
  }

  let filePath = url === '/' ? '/index.html' : url;
  const fullPath = path.join(__dirname, 'public', filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Kroger Video Portal running at http://localhost:${PORT}`);
});
