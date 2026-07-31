import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import KrogerStockQuote from '../src/KrogerStockQuote';

jest.mock('../src/constants', () => ({
  PLUGIN_ID: '6a62f458a1562171e13f19d1',
  TOKEN_BASE_PATH: '/api/installations',
  STOCKQUOTE_API_URL: 'http://localhost:3000/api/stockquote',
}));

jest.mock('../../qumu2/staffbase-widget/public/assets/Kroger.png', () => 'mock-logo', {
  virtual: true,
});

const TOKEN_RESPONSE = { jwt: 'test-jwt-token' };

const sampleData = {
  name: 'The Kroger Co.',
  symbol: 'KR',
  exchange: 'NYSE',
  currentPrice: 59.86,
  changeFromPreviousClose: 0.54,
  percentChangeFromPreviousClose: 0.91,
  date: '2024-01-15',
  time: '4:00 PM',
};

// Matches the videoService.ts pattern: token fetch first, then data fetch
function makeTokenThenDataFetch(stockResponse: object, stockStatus = 200) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockFetch = jest.fn() as any;
  mockFetch
    .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(TOKEN_RESPONSE) })
    .mockResolvedValueOnce({ ok: stockStatus < 400, status: stockStatus, json: () => Promise.resolve(stockResponse) });
  return mockFetch;
}

describe('KrogerStockQuote', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = jest.fn();
    window.fetch = mockFetch as typeof window.fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows "Loading..." initially when fetch is pending', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<KrogerStockQuote />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('shows default "NYSE: KR" and "The Kroger Co." while loading', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<KrogerStockQuote />);
    expect(screen.getByText('NYSE: KR')).toBeInTheDocument();
    expect(screen.getByText('The Kroger Co.')).toBeInTheDocument();
  });

  test('fetches JWT from token endpoint then calls stockquote API with Authorization_jwt header', async () => {
    window.fetch = makeTokenThenDataFetch(sampleData);
    render(<KrogerStockQuote />);

    await waitFor(() => expect(screen.getByText('$59.86')).toBeInTheDocument());

    const calls = (window.fetch as jest.Mock).mock.calls;
    // First call: Staffbase token endpoint (same as videoService.ts)
    expect(calls[0][0]).toContain('/api/installations/6a62f458a1562171e13f19d1/service/token');
    expect(calls[0][1]).toMatchObject({ credentials: 'include' });
    // Second call: stockquote API with JWT header
    expect(calls[1][0]).toBe('http://localhost:3000/api/stockquote');
    expect(calls[1][1].headers).toMatchObject({ Authorization_jwt: 'test-jwt-token' });
  });

  test('renders price, positive change, date and time on success', async () => {
    window.fetch = makeTokenThenDataFetch(sampleData);
    render(<KrogerStockQuote />);

    await waitFor(() => expect(screen.getByText('$59.86')).toBeInTheDocument());
    expect(screen.getByText(/\+\$0\.54/)).toBeInTheDocument();
    expect(screen.getByText(/2024-01-15/)).toBeInTheDocument();
    expect(screen.getByText(/4:00 PM ET/)).toBeInTheDocument();
  });

  test('shows exchange and symbol from data after load', async () => {
    window.fetch = makeTokenThenDataFetch(sampleData);
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('NYSE: KR')).toBeInTheDocument());
  });

  test('shows "Unable to load" when token fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('Unable to load')).toBeInTheDocument());
  });

  test('shows "Unable to load" when token response has no JWT', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('Unable to load')).toBeInTheDocument());
  });

  test('retries stockquote API on 401 with fresh token (same as videoService.ts)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockFetchRetry = jest.fn() as any;
    mockFetchRetry
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(TOKEN_RESPONSE) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(TOKEN_RESPONSE) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(sampleData) });
    window.fetch = mockFetchRetry;
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('$59.86')).toBeInTheDocument());
    expect(mockFetchRetry).toHaveBeenCalledTimes(4);
  });

  test('negative change renders -$1.23 with red style', async () => {
    const negativeData = {
      ...sampleData,
      currentPrice: 58.0,
      changeFromPreviousClose: -1.23,
      percentChangeFromPreviousClose: -2.08,
    };
    window.fetch = makeTokenThenDataFetch(negativeData);
    render(<KrogerStockQuote />);

    await waitFor(() => expect(screen.getByText(/-\$1\.23/)).toBeInTheDocument());
    expect(screen.getByText(/-\$1\.23/)).toHaveStyle({ color: '#dc2626' });
  });

  test('sets up 30-second interval for auto-refresh', () => {
    const setIntervalSpy = jest.spyOn(window, 'setInterval');
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<KrogerStockQuote />);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
  });

  test('clears interval on unmount (no memory leak)', () => {
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<KrogerStockQuote />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
