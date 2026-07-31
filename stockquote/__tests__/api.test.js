'use strict';

/**
 * Unit tests for stockquote/api/index.js (Azure Function handler)
 *
 * Mocks:
 *   - 'https'            – replaced with a jest auto-mock; each test configures
 *                          https.get.mockImplementation to simulate responses.
 *   - '../api/constants' – provides stable STOCKQUOTE_URL and ALLOWED_ORIGINS values.
 */

jest.mock('https');
jest.mock('../api/constants', () => ({
  STOCKQUOTE_URL: 'https://stock.example.com/quote',
  ALLOWED_ORIGINS: ['https://krogertest.staffbase.com', 'http://localhost:3000'],
}));

const https = require('https');
const handler = require('../api/index');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Configures https.get to simulate a successful upstream HTTP response.
 * The mock IncomingMessage fires 'data' (with body) then 'end' synchronously
 * inside the callback, so the httpsGet Promise resolves on the next microtask.
 */
function makeSuccessResponse(statusCode, body) {
  const mockRes = {
    statusCode,
    setEncoding: jest.fn(),
    on: jest.fn().mockImplementation((event, cb) => {
      if (event === 'data') cb(body);
      if (event === 'end') cb();
      return mockRes;
    }),
  };
  // Returned request object – only needs .on() for the error handler chain.
  const mockReq = { on: jest.fn().mockReturnThis() };

  https.get.mockImplementation((_opts, callback) => {
    callback(mockRes);
    return mockReq;
  });

  return { mockRes, mockReq };
}

/**
 * Configures https.get to simulate a network-level error (e.g. ECONNREFUSED).
 * The returned request object's .on('error', cb) handler is fired synchronously,
 * which causes the httpsGet Promise to reject immediately.
 */
function makeNetworkError(err) {
  const mockReq = {
    on: jest.fn().mockImplementation((event, cb) => {
      if (event === 'error') cb(err);
      return mockReq;
    }),
  };
  https.get.mockImplementation(() => mockReq);
  return mockReq;
}

/** Creates a fresh Azure Function context object. */
function makeContext() {
  return { res: null };
}

/**
 * Builds a minimal Azure Function request object.
 * When `headers` is omitted the defaults include both authorization_jwt and origin.
 * Pass an explicit headers object to override all headers (no defaults are merged).
 */
function makeRequest({ method = 'GET', headers = null } = {}) {
  return {
    method,
    headers: headers !== null
      ? headers
      : {
          authorization_jwt: 'test-jwt',
          origin: 'https://krogertest.staffbase.com',
        },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Azure Function handler (stockquote/api/index.js)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- OPTIONS preflight ---------------------------------------------------

  test('OPTIONS request returns 204 with an empty body and CORS headers', async () => {
    const context = makeContext();

    await handler(context, makeRequest({ method: 'OPTIONS' }));

    expect(context.res.status).toBe(204);
    expect(context.res.body).toBe('');
    expect(context.res.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(context.res.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
  });

  // --- Authentication guard -----------------------------------------------

  test('GET without authorization_jwt header returns 401 with error message', async () => {
    const context = makeContext();
    const req = makeRequest({ headers: { origin: 'https://krogertest.staffbase.com' } });

    await handler(context, req);

    expect(context.res.status).toBe(401);
    expect(JSON.parse(context.res.body)).toEqual({
      error: 'Missing Authorization_jwt header',
    });
  });

  // --- Upstream success ----------------------------------------------------

  test('GET with jwt and upstream 200 returns 200 with body forwarded as-is', async () => {
    makeSuccessResponse(200, '{"price":59.86}');
    const context = makeContext();

    await handler(context, makeRequest());

    expect(context.res.status).toBe(200);
    expect(context.res.body).toBe('{"price":59.86}');
  });

  // --- Upstream error codes ------------------------------------------------

  test('GET with jwt and upstream 403 returns 403 with Stock quote service error', async () => {
    makeSuccessResponse(403, 'Forbidden');
    const context = makeContext();

    await handler(context, makeRequest());

    expect(context.res.status).toBe(403);
    expect(JSON.parse(context.res.body)).toEqual({
      error: 'Stock quote service error',
    });
  });

  test('GET with jwt and upstream 500 returns 500 with Stock quote service error', async () => {
    makeSuccessResponse(500, 'Internal Server Error');
    const context = makeContext();

    await handler(context, makeRequest());

    expect(context.res.status).toBe(500);
    expect(JSON.parse(context.res.body)).toEqual({
      error: 'Stock quote service error',
    });
  });

  // --- Network failure -----------------------------------------------------

  test('Network error (https.get emits error) returns 502 Bad Gateway', async () => {
    makeNetworkError(new Error('ECONNREFUSED'));
    const context = makeContext();

    await handler(context, makeRequest());

    expect(context.res.status).toBe(502);
    expect(JSON.parse(context.res.body)).toEqual({
      error: 'Bad Gateway: stock quote service unavailable',
    });
  });

  // --- CORS origin handling ------------------------------------------------

  test('Allowed origin is echoed in Access-Control-Allow-Origin', async () => {
    makeSuccessResponse(200, '{}');
    const context = makeContext();
    const req = makeRequest({
      headers: { authorization_jwt: 'jwt', origin: 'http://localhost:3000' },
    });

    await handler(context, req);

    expect(context.res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  test('Unknown origin falls back to the first ALLOWED_ORIGINS entry', async () => {
    makeSuccessResponse(200, '{}');
    const context = makeContext();
    const req = makeRequest({
      headers: { authorization_jwt: 'jwt', origin: 'https://unknown.example.com' },
    });

    await handler(context, req);

    expect(context.res.headers['Access-Control-Allow-Origin']).toBe(
      'https://krogertest.staffbase.com'
    );
  });

  // --- Upstream request correctness ----------------------------------------

  test('Authorization: Bearer is correctly prepended to jwt when calling upstream', async () => {
    makeSuccessResponse(200, '{}');
    const context = makeContext();
    const req = makeRequest({
      headers: {
        authorization_jwt: 'my-jwt-token',
        origin: 'https://krogertest.staffbase.com',
      },
    });

    await handler(context, req);

    expect(https.get).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-jwt-token',
        }),
      }),
      expect.any(Function)
    );
  });
});
