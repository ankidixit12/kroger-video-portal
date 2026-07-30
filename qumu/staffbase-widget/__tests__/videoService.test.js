function okJson(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function okText(status, text) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

function loadVideoService(env = {}) {
  jest.resetModules();
  process.env = {
    ...process.env,
    QUMU_SERVICE_ROOT: 'https://svc.example/',
    QUMU_USERNAME: 'user',
    QUMU_PASSWORD: 'pass',
    ...env,
  };
  return require('../src/services/videoService');
}

beforeEach(() => {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
});

test('fetchVideos returns mapped items and total', async () => {
  const svc = loadVideoService();

  global.fetch
    .mockResolvedValueOnce(okJson(200, { jwt: 'jwt-1' }))
    .mockResolvedValueOnce(okJson(200, {
      kulus: [
        {
          guid: 'v1',
          title: 'Video 1',
          metadata: [
            { title: 'Division', value: [{ value: 'Dallas' }] },
            { title: 'Category', value: 'Ops' },
            { title: 'Description', value: { value: 'desc' } },
          ],
          publisher: { name: 'Alice' },
          duration: 65000,
          published: '2025-01-01',
          withdrawOn: '2025-12-31',
          thumbnail: { cdnUrl: 'https://img.example/1' },
          player: 'https://player.example/1',
          state: 'PUBLISHED',
        },
        null,
      ],
      total: 2,
    }));

  const result = await svc.fetchVideos({ offset: 5, limit: 10, search: 'ops' });

  expect(result.total).toBe(2);
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({
    id: 'v1',
    title: 'Video 1',
    category: 'Ops',
    duration: '01:05',
    author: 'Alice',
    division: 'Dallas',
    thumbnailUrl: 'https://img.example/1',
    videoUrl: 'https://player.example/1',
  });
  expect(global.fetch.mock.calls[1][0]).toContain('offset=5');
  expect(global.fetch.mock.calls[1][0]).toContain('limit=10');
  expect(global.fetch.mock.calls[1][0]).toContain('search=title%2CCONTAINS%2Cops');
});

test('retries once on 401 and refreshes token', async () => {
  const svc = loadVideoService();

  global.fetch
    .mockResolvedValueOnce(okJson(200, { jwt: 'jwt-1' }))
    .mockResolvedValueOnce(okJson(401, {}))
    .mockResolvedValueOnce(okJson(200, { jwt: 'jwt-2' }))
    .mockResolvedValueOnce(okJson(200, { kulus: [], total: 0 }));

  const result = await svc.fetchVideos();

  expect(result.items).toEqual([]);
  expect(global.fetch).toHaveBeenCalledTimes(4);
});

test('fetchVideosByFilter handles 404 and invalid JSON branches', async () => {
  const svc = loadVideoService();

  global.fetch
    .mockResolvedValueOnce(okJson(200, { jwt: 'jwt-1' }))
    .mockResolvedValueOnce(okJson(404, {}));
  const notFound = await svc.fetchVideosByFilter({ rules: [] });
  expect(notFound).toEqual({ items: [], total: 0 });

  svc.setPluginId('plugin-invalid-json');
  global.fetch
    .mockResolvedValueOnce(okJson(200, { jwt: 'jwt-2' }))
    .mockResolvedValueOnce(okText(200, 'not-json'));
  await expect(svc.fetchVideosByFilter({ rules: [{ fieldGuid: 'f', fieldTitle: 't', optionGuid: 'o', optionValue: 'v' }] }))
    .rejects
    .toThrow('fetchVideosByFilter: invalid JSON response');
});

test('fetchMasterData returns metadata and getQumuPostUrl builds URL', async () => {
  const svc = loadVideoService();

  global.fetch
    .mockResolvedValueOnce(okJson(200, { jwt: 'jwt-1' }))
    .mockResolvedValueOnce(okJson(200, { metadata: [{ guid: 'g1', title: 'Division', options: [] }] }));

  const metadata = await svc.fetchMasterData(['Division']);

  expect(metadata).toEqual([{ guid: 'g1', title: 'Division', options: [] }]);
  expect(svc.getQumuPostUrl('abc')).toBe('https://svc.example/kulus/api/post/abc');
});

test('token cache is reused and reset by setPluginId', async () => {
  const svc = loadVideoService();

  global.fetch
    .mockResolvedValueOnce(okJson(200, { jwt: 'jwt-1' }))
    .mockResolvedValueOnce(okJson(200, { kulus: [], total: 0 }))
    .mockResolvedValueOnce(okJson(200, { kulus: [], total: 0 }))
    .mockResolvedValueOnce(okJson(200, { jwt: 'jwt-2' }))
    .mockResolvedValueOnce(okJson(200, { kulus: [], total: 0 }));

  await svc.fetchVideos();
  await svc.fetchVideos();
  svc.setPluginId('plugin-2');
  await svc.fetchVideos();

  const tokenCalls = global.fetch.mock.calls.filter((c) => String(c[0]).includes('/api/token/'));
  expect(tokenCalls).toHaveLength(2);
});

test('getQumuApiHeaders returns jwt and accepts extra headers', async () => {
  const svc = loadVideoService();

  global.fetch.mockResolvedValueOnce(okJson(200, { jwt: 'jwt-h' }));

  const headers = await svc.getQumuApiHeaders({ 'X-Test': '1' });
  expect(headers.Authorization_jwt).toBe('jwt-h');
  expect(headers.Authorization).toMatch(/^Basic /);
  expect(headers['X-Test']).toBe('1');
});