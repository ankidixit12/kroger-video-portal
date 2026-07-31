const https = require('https');
const { STOCKQUOTE_URL, ALLOWED_ORIGINS } = require('./constants');

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

module.exports = async function (context, req) {
  const origin = (req.headers && req.headers['origin']) || '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const cors = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization_jwt',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: cors, body: '' };
    return;
  }

  const jwt = req.headers['authorization_jwt'];
  if (!jwt) {
    context.res = { status: 401, headers: cors, body: JSON.stringify({ error: 'Missing Authorization_jwt header' }) };
    return;
  }

  try {
    const { status, body } = await httpsGet(STOCKQUOTE_URL, {
      Authorization: 'Bearer ' + jwt,
      Accept: 'application/json',
    });

    if (status >= 400) {
      context.res = { status, headers: cors, body: JSON.stringify({ error: 'Stock quote service error' }) };
      return;
    }

    context.res = { status: 200, headers: cors, body };
  } catch {
    context.res = { status: 502, headers: cors, body: JSON.stringify({ error: 'Bad Gateway: stock quote service unavailable' }) };
  }
};
