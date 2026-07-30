const { EventEmitter } = require('events');

function createResponse(done) {
  return {
    headers: {},
    payload: undefined,
    statusCode: undefined,
    endValue: undefined,
    setHeader: jest.fn(function setHeader(key, value) {
      this.headers[key] = value;
    }),
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(payload) {
      this.payload = payload;
      done(this);
      return this;
    }),
    end: jest.fn(function end(value) {
      this.endValue = value;
      done(this);
      return this;
    }),
  };
}

function invokeHandler(handler, req) {
  return new Promise((resolve) => {
    const res = createResponse(resolve);
    handler(req, res);
  });
}

function createProxyResponse(statusCode, body) {
  const proxyRes = new EventEmitter();
  proxyRes.statusCode = statusCode;
  proxyRes.setEncoding = jest.fn();
  process.nextTick(() => {
    if (body !== undefined) proxyRes.emit('data', body);
    proxyRes.emit('end');
  });
  return proxyRes;
}

test('exports helper utilities that normalize metadata and video fields', () => {
  const cloud = require('../qumu_cloud');
  const { getMeta, mapQumuVideo, toDuration } = cloud._test;

  expect(getMeta(null, 'Division')).toBe('');
  expect(getMeta([{ title: 'Division', value: [] }], 'Division')).toBe('');
  expect(getMeta([{ title: 'Division', value: ['Dallas'] }], 'Division')).toBe('Dallas');
  expect(getMeta([{ title: 'Division', value: [{ name: 'Dallas' }] }], 'Division')).toBe('Dallas');
  expect(getMeta([{ title: 'Division', value: [{ nope: true }] }], 'Division')).toBe('');
  expect(getMeta([{ title: 'Description', value: { name: 'Clip name' } }], 'Description')).toBe('Clip name');
  expect(getMeta([{ title: 'Description', value: { value: 'A clip' } }], 'Description')).toBe('A clip');
  expect(getMeta([{ title: 'Description', value: {} }], 'Description')).toBe('');
  expect(getMeta([{ title: 'Category', value: 'Ops' }], 'Category')).toBe('Ops');
  expect(toDuration(65000)).toBe('01:05');
  expect(toDuration('bad-input')).toBe('00:00');

  expect(mapQumuVideo({
    guid: 'video-1',
    title: 'Store Update',
    metadata: [
      { title: 'Division', value: [{ value: 'Dallas' }] },
      { title: 'Category', value: 'Ops' },
      { title: 'Description', value: [{ name: 'Important' }] },
    ],
    publisher: { name: 'Admin' },
    duration: 90000,
    published: '2024-01-01',
    withdrawOn: '2024-12-31',
    player: 'https://player.example/video-1',
  })).toEqual({
    id: 'video-1',
    title: 'Store Update',
    description: 'Important',
    series: 'Ops',
    author: 'Admin',
    duration: '01:30',
    category: 'Ops',
    publishedAt: '2024-01-01',
    expiryDate: '2024-12-31',
    thumbnailColor: '#004990',
    videoUrl: 'https://player.example/video-1',
  });

  expect(mapQumuVideo({
    guid: 'video-2',
    title: 'Fallback Clip',
    metadata: [
      { title: 'Division', value: [{ value: 'Unknown' }] },
    ],
    publisher: null,
    duration: 0,
    created: '2024-03-01',
    expiryDate: '2024-08-01',
    player: '',
  })).toMatchObject({
    series: 'Corporate',
    category: 'Corporate',
    description: '',
    author: '',
    duration: '00:00',
    publishedAt: '2024-03-01',
    expiryDate: '2024-08-01',
    thumbnailColor: '#004990',
  });

  expect(mapQumuVideo({
    guid: 'video-3',
    title: 'Empty Fallbacks',
    metadata: [],
    duration: 0,
  })).toMatchObject({
    publishedAt: '',
    expiryDate: '',
  });
});

test('uses custom division colors when the constants module provides them', () => {
  jest.resetModules();
  jest.doMock('../portal/config/constants', () => ({
    DEFAULT_THUMBNAIL_COLOR: '#004990',
    DIVISION_COLORS: { Dallas: '#ff00ff' },
    getCorsHeaders: jest.fn(),
    getQumuConfig: jest.fn(),
    hasQumuConfig: jest.fn(),
  }));

  jest.isolateModules(() => {
    const cloud = require('../qumu_cloud');
    expect(cloud._test.mapQumuVideo({
      guid: 'video-custom',
      title: 'Custom Color',
      metadata: [{ title: 'Division', value: [{ value: 'Dallas' }] }],
      duration: 1000,
    }).thumbnailColor).toBe('#ff00ff');
  });

  jest.dontMock('../portal/config/constants');
  jest.resetModules();
});

test('can create a handler with default dependencies', () => {
  expect(typeof require('../qumu_cloud').createHandler()).toBe('function');
});

test('responds to preflight requests without calling Qumu', async () => {
  const https = { get: jest.fn() };
  const handler = require('../qumu_cloud').createHandler({
    https,
    getCorsHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://one.test' }),
    getQumuConfig: () => ({ username: 'u', password: 'p', serviceUrl: 'https://svc.test' }),
    hasQumuConfig: () => true,
  });

  const res = await invokeHandler(handler, {
    method: 'OPTIONS',
    headers: { origin: 'https://one.test' },
    query: {},
  });

  expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://one.test');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(https.get).not.toHaveBeenCalled();
});

test('rejects requests when Qumu config is missing', async () => {
  const handler = require('../qumu_cloud').createHandler({
    https: { get: jest.fn() },
    getCorsHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://one.test' }),
    getQumuConfig: () => ({ username: '', password: '', serviceUrl: '' }),
    hasQumuConfig: () => false,
  });

  const res = await invokeHandler(handler, {
    method: 'GET',
    headers: { origin: 'https://one.test' },
    query: {},
  });

  expect(res.statusCode).toBe(500);
  expect(res.payload).toEqual({ error: 'QUMU environment variables are not configured' });
});

test('maps, filters, and limits successful Qumu responses', async () => {
  const https = {
    get: jest.fn((url, options, callback) => {
      expect(url).toBe('https://svc.test/kulus?offset=0&limit=1');
      expect(options).toEqual({
        headers: {
          Authorization: 'Basic ' + Buffer.from('user:pass').toString('base64'),
          'User-Agent': 'Kroger-Video-Portal',
        },
      });

      callback(createProxyResponse(200, JSON.stringify({
        kulus: [
          {
            guid: 'video-1',
            title: 'Ops Clip',
            metadata: [
              { title: 'Division', value: [{ value: 'Dallas' }] },
              { title: 'Category', value: 'Ops' },
              { title: 'Description', value: { value: 'First' } },
            ],
            publisher: { name: 'Admin' },
            duration: 120000,
            published: '2024-01-01',
            player: 'https://player/1',
          },
          {
            guid: 'video-2',
            title: 'HR Clip',
            metadata: [
              { title: 'Division', value: [{ value: 'Unknown' }] },
              { title: 'Category', value: 'HR' },
            ],
            publisher: { name: 'Admin' },
            duration: 30000,
            created: '2024-02-01',
            player: 'https://player/2',
          },
        ],
      })));

      return new EventEmitter();
    }),
  };
  const handler = require('../qumu_cloud').createHandler({
    https,
    getCorsHeaders: () => ({
      'Access-Control-Allow-Origin': 'https://one.test',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }),
    getQumuConfig: () => ({ username: 'user', password: 'pass', serviceUrl: 'https://svc.test' }),
    hasQumuConfig: () => true,
  });

  const res = await invokeHandler(handler, {
    method: 'GET',
    headers: { origin: 'https://one.test' },
    query: { category: 'Ops', _limit: '1' },
  });

  expect(res.headers).toEqual({
    'Access-Control-Allow-Origin': 'https://one.test',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  expect(res.statusCode).toBe(200);
  expect(res.payload).toHaveLength(1);
  expect(res.payload[0]).toMatchObject({
    id: 'video-1',
    category: 'Ops',
    thumbnailColor: '#004990',
  });
});

test('caps outbound limit at 100 and returns service errors', async () => {
  const https = {
    get: jest.fn((url, _options, callback) => {
      expect(url).toBe('https://svc.test/kulus?offset=0&limit=100');
      callback(createProxyResponse(503, '{}'));
      return new EventEmitter();
    }),
  };
  const handler = require('../qumu_cloud').createHandler({
    https,
    getCorsHeaders: () => ({}),
    getQumuConfig: () => ({ username: 'user', password: 'pass', serviceUrl: 'https://svc.test' }),
    hasQumuConfig: () => true,
  });

  const res = await invokeHandler(handler, {
    method: 'GET',
    headers: { origin: '' },
    query: { _limit: '999' },
  });

  expect(res.statusCode).toBe(503);
  expect(res.payload).toEqual({ error: 'QUMU service error' });
});

test('falls back to status 502 when the proxy error response has no status code', async () => {
  const handler = require('../qumu_cloud').createHandler({
    https: {
      get: jest.fn((_url, _options, callback) => {
        callback(createProxyResponse(undefined, '{}'));
        return new EventEmitter();
      }),
    },
    getCorsHeaders: () => ({}),
    getQumuConfig: () => ({ username: 'user', password: 'pass', serviceUrl: 'https://svc.test' }),
    hasQumuConfig: () => true,
  });

  const res = await invokeHandler(handler, {
    method: 'GET',
    headers: { origin: '' },
    query: {},
  });

  expect(res.statusCode).toBe(502);
  expect(res.payload).toEqual({ error: 'QUMU service error' });
});

test('returns invalid response and network error failures', async () => {
  const invalidJsonHandler = require('../qumu_cloud').createHandler({
    https: {
      get: jest.fn((_url, _options, callback) => {
        callback(createProxyResponse(200, 'not-json'));
        return new EventEmitter();
      }),
    },
    getCorsHeaders: () => ({}),
    getQumuConfig: () => ({ username: 'user', password: 'pass', serviceUrl: 'https://svc.test' }),
    hasQumuConfig: () => true,
  });

  const invalidJsonRes = await invokeHandler(invalidJsonHandler, {
    method: 'GET',
    headers: { origin: '' },
    query: {},
  });

  expect(invalidJsonRes.statusCode).toBe(502);
  expect(invalidJsonRes.payload).toEqual({ error: 'Invalid QUMU response' });

  const networkHandler = require('../qumu_cloud').createHandler({
    https: {
      get: jest.fn(() => {
        const req = new EventEmitter();
        process.nextTick(() => req.emit('error', new Error('offline')));
        return req;
      }),
    },
    getCorsHeaders: () => ({}),
    getQumuConfig: () => ({ username: 'user', password: 'pass', serviceUrl: 'https://svc.test' }),
    hasQumuConfig: () => true,
  });

  const networkRes = await invokeHandler(networkHandler, {
    method: 'GET',
    headers: { origin: '' },
    query: {},
  });

  expect(networkRes.statusCode).toBe(502);
  expect(networkRes.payload).toEqual({ error: 'Bad Gateway: QUMU service unavailable' });
});

test('returns an empty list when the proxy payload has no kulus array', async () => {
  const handler = require('../qumu_cloud').createHandler({
    https: {
      get: jest.fn((_url, _options, callback) => {
        callback(createProxyResponse(200, JSON.stringify({ items: [] })));
        return new EventEmitter();
      }),
    },
    getCorsHeaders: () => ({}),
    getQumuConfig: () => ({ username: 'user', password: 'pass', serviceUrl: 'https://svc.test' }),
    hasQumuConfig: () => true,
  });

  const res = await invokeHandler(handler, {
    method: 'GET',
    headers: { origin: '' },
    query: { _limit: '0' },
  });

  expect(res.statusCode).toBe(200);
  expect(res.payload).toEqual([]);
});