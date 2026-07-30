function loadConstants(env = {}) {
  jest.resetModules();
  process.env = { ...process.env, ...env };
  return require('../src/constants');
}

afterEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
});

test('builds URL constants from env and trims trailing slashes', () => {
  const c = loadConstants({
    QUMU_SERVICE_ROOT: 'https://svc.example/',
    STAFFBASE_BASE_URL: 'https://staffbase.example/',
  });

  expect(c.STAFFBASE_BASE_URL).toBe('https://staffbase.example');
  expect(c.QUMU_KULUS_BASE_URL).toBe('https://svc.example/kulus');
  expect(c.QUMU_TOKEN_BASE_URL).toBe('https://svc.example/api/token');
  expect(c.QUMU_POST_BASE_URL).toBe('https://svc.example/kulus/api/post');
});

test('respects explicit qumu env overrides', () => {
  const c = loadConstants({
    QUMU_SERVICE_ROOT: 'https://svc.example/',
    QUMU_KULUS_BASE_URL: 'https://custom.example/kulus/',
    QUMU_TOKEN_BASE_URL: 'https://custom.example/token/',
    QUMU_POST_BASE_URL: 'https://custom.example/post/',
  });

  expect(c.QUMU_KULUS_BASE_URL).toBe('https://custom.example/kulus');
  expect(c.QUMU_TOKEN_BASE_URL).toBe('https://custom.example/token');
  expect(c.QUMU_POST_BASE_URL).toBe('https://custom.example/post');
  expect(c.DEFAULT_THUMBNAIL_COLOR).toBe('#004990');
  expect(c.PAGE_SIZE).toBe(32);
});

test('exports expected widget config schema basics', () => {
  const { configurationSchema, uiSchema } = require('../src/configuration-schema');

  expect(configurationSchema).toBeTruthy();
  expect(configurationSchema.type).toBe('object');
  expect(uiSchema).toBeTruthy();
  expect(typeof uiSchema).toBe('object');
});