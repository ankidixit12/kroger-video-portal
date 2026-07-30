const CORS_ALLOWED_ORIGINS = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const CORS_METHODS = 'GET, OPTIONS';
const DEFAULT_THUMBNAIL_COLOR = process.env.DEFAULT_THUMBNAIL_COLOR || '#004990';
const PORT = Number(process.env.PORT || 3000);
const LOCAL_INSTALLATION_ID = process.env.LOCAL_INSTALLATION_ID || '6a0cc22372fe006d424385a2';

function parseDivisionColors() {
  const raw = String(process.env.DIVISION_COLORS || '').trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce((acc, [division, color]) => {
      const key = String(division || '').trim();
      const value = String(color || '').trim();
      if (key && value) acc[key] = value;
      return acc;
    }, {});
  } catch (_err) {
    console.warn('Invalid DIVISION_COLORS value; expected JSON object, e.g. {"Dallas":"#004990"}.');
    return {};
  }
}

const DIVISION_COLORS = parseDivisionColors();

function getCorsOrigin(requestOrigin = '') {
  if (!CORS_ALLOWED_ORIGINS.length) return '';
  if (!requestOrigin) return CORS_ALLOWED_ORIGINS[0];
  return CORS_ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : '';
}

function getCorsHeaders(requestOrigin, options = {}) {
  const { allowCredentials = false, includeMethods = false } = options;
  const allowOrigin = getCorsOrigin(requestOrigin);
  const headers = {};

  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    headers.Vary = 'Origin';
  }

  if (includeMethods) {
    headers['Access-Control-Allow-Methods'] = CORS_METHODS;
  }

  if (allowCredentials && allowOrigin) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

function getQumuConfig() {
  return {
    username: process.env.QUMU_USERNAME || '',
    password: process.env.QUMU_PASSWORD || '',
    serviceUrl: process.env.QUMU_SERVICE_URL || '',
  };
}

function hasQumuConfig() {
  const { username, password, serviceUrl } = getQumuConfig();
  return Boolean(username && password && serviceUrl);
}

module.exports = {
  CORS_METHODS,
  DEFAULT_THUMBNAIL_COLOR,
  DIVISION_COLORS,
  LOCAL_INSTALLATION_ID,
  PORT,
  getCorsHeaders,
  getCorsOrigin,
  getQumuConfig,
  hasQumuConfig,
};