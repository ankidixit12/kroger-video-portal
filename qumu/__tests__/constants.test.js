const originalEnv = process.env;

function loadConstants(env = {}) {
  jest.resetModules();
  process.env = { ...originalEnv, ...env };
  return require('../portal/config/constants');
}

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
  jest.resetModules();
});

test('parses valid env configuration and emits matching cors headers', () => {
  const constants = loadConstants({
    CORS_ORIGIN: 'https://one.test, https://two.test',
    DEFAULT_THUMBNAIL_COLOR: '#112233',
    DIVISION_COLORS: '{"Dallas":"#abcdef"," ":"#123456","Louisville":""}',
    LOCAL_INSTALLATION_ID: 'install-123',
    PORT: '4567',
    QUMU_USERNAME: 'user',
    QUMU_PASSWORD: 'pass',
    QUMU_SERVICE_URL: 'https://qumu.example',
  });

  expect(constants.DEFAULT_THUMBNAIL_COLOR).toBe('#112233');
  expect(constants.DIVISION_COLORS).toEqual({ Dallas: '#abcdef' });
  expect(constants.LOCAL_INSTALLATION_ID).toBe('install-123');
  expect(constants.PORT).toBe(4567);
  expect(constants.getCorsOrigin('https://two.test')).toBe('https://two.test');
  expect(constants.getCorsOrigin('')).toBe('https://one.test');
  expect(constants.getCorsHeaders('https://two.test', { allowCredentials: true, includeMethods: true })).toEqual({
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Origin': 'https://two.test',
    Vary: 'Origin',
  });
  expect(constants.getQumuConfig()).toEqual({
    username: 'user',
    password: 'pass',
    serviceUrl: 'https://qumu.example',
  });
  expect(constants.hasQumuConfig()).toBe(true);
});

test('falls back safely for invalid or missing env values', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const constants = loadConstants({
    CORS_ORIGIN: 'https://one.test',
    DIVISION_COLORS: 'not-json',
    QUMU_USERNAME: '',
    QUMU_PASSWORD: '',
    QUMU_SERVICE_URL: '',
  });

  expect(constants.DIVISION_COLORS).toEqual({});
  expect(warn).toHaveBeenCalledTimes(1);
  expect(constants.getCorsOrigin('https://blocked.test')).toBe('');
  expect(constants.getCorsHeaders('https://blocked.test', { allowCredentials: true, includeMethods: true })).toEqual({
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  expect(constants.hasQumuConfig()).toBe(false);
});

test('ignores non-object division color payloads', () => {
  const constants = loadConstants({ DIVISION_COLORS: '[]' });

  expect(constants.DIVISION_COLORS).toEqual({});
});

test('returns empty cors state when no origins are configured', () => {
  const constants = loadConstants({ CORS_ORIGIN: '' });

  expect(constants.getCorsOrigin('https://any.test')).toBe('');
  expect(constants.getCorsHeaders('https://any.test')).toEqual({});
});

test('returns empty division colors when the env value is blank', () => {
  const constants = loadConstants({ DIVISION_COLORS: '   ' });

  expect(constants.DIVISION_COLORS).toEqual({});
});

test('returns only origin headers when optional cors flags are disabled', () => {
  const constants = loadConstants({ CORS_ORIGIN: 'https://one.test' });

  expect(constants.getCorsHeaders('https://one.test', { allowCredentials: false, includeMethods: false })).toEqual({
    'Access-Control-Allow-Origin': 'https://one.test',
    Vary: 'Origin',
  });
});