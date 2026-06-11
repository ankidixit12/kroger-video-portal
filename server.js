const http = require('http');
const fs = require('fs');
const path = require('path');

const divisionsHandler = require('./api/divisions');
const videosHandler    = require('./api/videos/[division]');
const DB_PATH          = path.join(__dirname, 'mock-api/db.json');

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

const PORT = 3000;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/api/qumu_cloud') {
    const qs       = new URLSearchParams(req.url.split('?')[1] || '');
    const category = qs.get('category');
    const limit    = parseInt(qs.get('_limit') || '0', 10);
    let data       = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')).qumu_cloud;
    if (category) data = data.filter(v => v.category === category);
    if (limit > 0) data = data.slice(0, limit);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
    return;
  }

  if (url === '/api/divisions') {
    const fakeRes = makeFakeRes(res);
    divisionsHandler(req, fakeRes);
    return;
  }

  const videoMatch = url.match(/^\/api\/videos\/([^/]+)$/);
  if (videoMatch) {
    req.query = { division: decodeURIComponent(videoMatch[1]) };
    const fakeRes = makeFakeRes(res);
    videosHandler(req, fakeRes);
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

function makeFakeRes(res) {
  const fakeRes = {
    _headers: {},
    statusCode: 200,
    setHeader(k, v) { this._headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) {
      res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this._headers });
      res.end(JSON.stringify(data));
    },
  };
  return fakeRes;
}

server.listen(PORT, () => {
  console.log(`Kroger Video Portal running at http://localhost:${PORT}`);
});
