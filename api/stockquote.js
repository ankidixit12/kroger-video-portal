const https = require('https');

const STOCKQUOTE_URL  = 'https://stockquote-dfhmhnf4bbg0cwck.eastus2-01.azurewebsites.net/mycart-stockquote/getDelayedQuotes';
const QUMU_TOKEN_URL  = 'https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu/api/token';
const PLUGIN_ID       = process.env.QUMU_PLUGIN_ID || '6a3bd7361da609538cb79dac';

let _cachedToken = null;

function basicAuth() {
  const u = process.env.QUMU_USERNAME || 'qumu';
  const p = process.env.QUMU_PASSWORD || 'qumu@123456';
  return 'Basic ' + Buffer.from(u + ':' + p).toString('base64');
}

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

async function getJwt() {
  if (_cachedToken) return _cachedToken;
  const { status, body } = await httpsGet(`${QUMU_TOKEN_URL}/${PLUGIN_ID}`, {
    Authorization: basicAuth(),
  });
  if (status >= 400) throw new Error('Token endpoint returned ' + status);
  const json = JSON.parse(body);
  if (!json.jwt) throw new Error('No JWT in token response');
  _cachedToken = json.jwt;
  return _cachedToken;
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  getJwt()
    .then((jwt) => httpsGet(STOCKQUOTE_URL, {
      Authorization: 'Bearer ' + jwt,
      Accept: 'application/json',
    }))
    .then(({ status, body }) => {
      if (status >= 400) {
        // Token may have expired — clear cache and retry once
        _cachedToken = null;
        return getJwt().then((jwt) => httpsGet(STOCKQUOTE_URL, {
          Authorization: 'Bearer ' + jwt,
          Accept: 'application/json',
        }));
      }
      return { status, body };
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
