const https = require('https');

const STOCKQUOTE_URL = process.env.STOCKQUOTE_URL;

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    https.get(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    ).on('error', reject);
  });
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization_jwt');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const jwt = req.headers['authorization_jwt'];
  if (!jwt) {
    res.status(401).json({ error: 'Missing Authorization_jwt header' });
    return;
  }

  httpsGet(STOCKQUOTE_URL, {
    Authorization: 'Bearer ' + jwt,
    Accept: 'application/json',
  })
    .then(({ status, body }) => {
      if (status >= 400) {
        res.status(status).json({ error: 'Stock quote service error' });
        return;
      }
      res.status(200).json(JSON.parse(body));
    })
    .catch(() => {
      res.status(502).json({ error: 'Bad Gateway: stock quote service unavailable' });
    });
};
