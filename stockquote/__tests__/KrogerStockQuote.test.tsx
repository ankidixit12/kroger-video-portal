import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import KrogerStockQuote from '../src/KrogerStockQuote';

// jest.mock factory works without the file existing on disk — TS can't resolve
// the path but Jest intercepts it before hitting the filesystem.
jest.mock('../../qumu/staffbase-widget/src/services/pingone-auth', () => ({
  getAccessToken: jest.fn(),
}));

// @ts-ignore — module path exists at runtime via the mock above
import { getAccessToken } from '../../qumu/staffbase-widget/src/services/pingone-auth';
const mockGetAccessToken = getAccessToken as jest.Mock;

declare const process: { env: Record<string, string> };
(process as any).env.STOCKQUOTE_API_URL = 'https://stock.example.com/api/quote';

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

describe('KrogerStockQuote', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    window.fetch = mockFetch as typeof window.fetch;
    mockGetAccessToken.mockResolvedValue('test-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('shows "Loading..." after auth succeeds but data fetch is pending', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('Loading...')).toBeInTheDocument());
  });

  test('shows default "NYSE: KR" and "The Kroger Co." while loading', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('NYSE: KR')).toBeInTheDocument());
    expect(screen.getByText('The Kroger Co.')).toBeInTheDocument();
  });

  test('calls getAccessToken then fetches stockquote API with Bearer token', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(sampleData) });
    render(<KrogerStockQuote />);

    await waitFor(() => expect(screen.getByText('$59.86')).toBeInTheDocument());

    expect(mockGetAccessToken).toHaveBeenCalled();
    const stockCall = mockFetch.mock.calls.find((c: any[]) =>
      c[0] === 'https://stock.example.com/api/quote'
    );
    expect(stockCall).toBeDefined();
    expect(stockCall[1].headers).toMatchObject({ Authorization: 'Bearer test-token' });
  });

  test('renders price, positive change, date and time on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(sampleData) });
    render(<KrogerStockQuote />);

    await waitFor(() => expect(screen.getByText('$59.86')).toBeInTheDocument());
    expect(screen.getByText(/\+\$0\.54/)).toBeInTheDocument();
    expect(screen.getByText(/2024-01-15/)).toBeInTheDocument();
    expect(screen.getByText(/4:00 PM ET/)).toBeInTheDocument();
  });

  test('shows exchange and symbol from data after load', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(sampleData) });
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('NYSE: KR')).toBeInTheDocument());
  });

  test('shows "Unable to load" when data fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('Unable to load')).toBeInTheDocument());
  });

  test('shows "Sign-in failed" when auth fails', async () => {
    mockGetAccessToken.mockRejectedValue(new Error('AUTH_FAILED'));
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('Sign-in failed')).toBeInTheDocument());
  });

  test('retries stockquote API on 401 with fresh token', async () => {
    const mockFetchRetry = jest.fn() as any;
    mockFetchRetry
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(sampleData) });
    window.fetch = mockFetchRetry;
    render(<KrogerStockQuote />);
    await waitFor(() => expect(screen.getByText('$59.86')).toBeInTheDocument());
    expect(mockFetchRetry).toHaveBeenCalledTimes(2);
  });

  test('negative change renders -$1.23 with red style', async () => {
    const negativeData = {
      ...sampleData,
      currentPrice: 58.0,
      changeFromPreviousClose: -1.23,
      percentChangeFromPreviousClose: -2.08,
    };
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(negativeData) });
    render(<KrogerStockQuote />);

    await waitFor(() => expect(screen.getByText(/-\$1\.23/)).toBeInTheDocument());
    expect(screen.getByText(/-\$1\.23/)).toHaveStyle({ color: '#dc2626' });
  });

  test('sets up 30-second interval for auto-refresh', async () => {
    const setIntervalSpy = jest.spyOn(window, 'setInterval');
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<KrogerStockQuote />);
    await waitFor(() =>
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000)
    );
  });

  test('clears interval on unmount (no memory leak)', async () => {
    const setIntervalSpy = jest.spyOn(window, 'setInterval');
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<KrogerStockQuote />);
    await waitFor(() =>
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000)
    );
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
