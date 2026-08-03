import React, { useEffect, useState, useCallback } from 'react';
import KROGER_LOGO from '../../public/assets/Kroger.png';
import { getAccessToken } from './services/pingone-auth';

declare const process: { env: { STOCKQUOTE_API_URL: string } };

interface StockData {
  name: string;
  symbol: string;
  market?: string;
  exchange?: string;
  currentPrice: number;
  changeFromPreviousClose: number;
  percentChangeFromPreviousClose: number;
  date: string;
  time: string;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    maxWidth: '384px',
    padding: '14px 20px',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '6px',
    alignSelf: 'stretch',
    borderRadius: '16px',
    border: '1px solid #E5E7EB',
    background: 'rgba(129, 186, 255, 0.27)',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.10), 0 1px 2px -1px rgba(0, 0, 0, 0.10)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  logo: {
    flexShrink: 0,
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  ticker: {
    color: '#084999',
    fontFamily: 'Inter',
    fontSize: '14px',
    fontStyle: 'normal',
    fontWeight: 800,
    lineHeight: '20px',
  },
  company: {
    color: '#101828',
    fontFamily: 'Inter',
    fontSize: '12px',
    fontStyle: 'normal',
    fontWeight: 400,
    lineHeight: '15px',
  },
  priceSection: {
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  price: {
    color: '#101828',
    textAlign: 'right' as const,
    fontFamily: 'Inter',
    fontSize: '16px',
    fontStyle: 'normal',
    fontWeight: 700,
    lineHeight: '24px',
  },
  changePositive: {
    color: '#019338',
    textAlign: 'right' as const,
    fontFamily: 'Inter',
    fontSize: '12px',
    fontStyle: 'normal',
    fontWeight: 600,
    lineHeight: '20px',
  },
  changeNegative: {
    fontSize: '0.9rem',
    fontWeight: 600,
    marginTop: '4px',
    color: '#dc2626',
    textAlign: 'right' as const,
  },
  date: {
    color: '#101828',
    fontFamily: 'Inter',
    fontSize: '10px',
    fontStyle: 'normal',
    fontWeight: 400,
    lineHeight: '15px',
  },
  status: {
    fontSize: '0.9rem',
    color: '#666',
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid #e5e7eb',
    borderTopColor: '#074085',
    animation: 'krogerspin 0.8s linear infinite',
    display: 'inline-block',
  },
  retryBtn: {
    marginTop: '4px',
    padding: '3px 10px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    background: '#074085',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

const KrogerStockQuote: React.FC = () => {
  const [authState, setAuthState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData]           = useState<StockData | null>(null);
  const [dataError, setDataError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      let res = await fetch(process.env.STOCKQUOTE_API_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        const retryToken = await getAccessToken();
        res = await fetch(process.env.STOCKQUOTE_API_URL, { headers: { Authorization: `Bearer ${retryToken}` } });
      }
      const json: StockData = await res.json();
      setData(json);
      setDataError(false);
    } catch {
      setDataError(true);
    }
  }, []);

  const runAuth = useCallback(() => {
    setAuthState('loading');
    getAccessToken()
      .then(() => {
        setAuthState('ready');
        fetchData();
      })
      .catch(err => {
        console.warn('[KrogerStockQuote] PingOne authentication failed:', String(err));
        setAuthState('error');
      });
  }, [fetchData]);

  useEffect(() => {
    runAuth();
  }, []);

  useEffect(() => {
    if (authState !== 'ready') return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [authState, fetchData]);

  const renderPrice = () => {
    if (authState === 'loading') {
      return (
        <>
          <style>{'@keyframes krogerspin{to{transform:rotate(360deg)}}'}</style>
          <span style={styles.spinner} />
        </>
      );
    }

    if (authState === 'error') {
      return (
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...styles.status, color: '#ef4444' }}>Sign-in failed</div>
          <button style={styles.retryBtn} onClick={runAuth}>Retry</button>
        </div>
      );
    }

    if (dataError) return <div style={styles.status}>Unable to load</div>;
    if (!data)     return <div style={styles.status}>Loading...</div>;

    const change = data.changeFromPreviousClose;
    const pct    = data.percentChangeFromPreviousClose;
    const sign   = change >= 0 ? '+' : '-';
    const changeStyle = change >= 0 ? styles.changePositive : styles.changeNegative;

    return (
      <>
        <div style={styles.price}>${data.currentPrice.toFixed(2)}</div>
        <div style={changeStyle}>
          {sign}${Math.abs(change).toFixed(2)} today ({pct.toFixed(2)}%)
        </div>
        <div style={styles.date}>{data.date}&nbsp;&nbsp;{data.time} ET</div>
      </>
    );
  };

  return (
    <div style={styles.card}>
      <div style={styles.logo}>
        <img src={KROGER_LOGO} alt="Kroger" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
      </div>
      <div style={styles.info}>
        <div style={styles.ticker}>{data ? `${data.market ?? data.exchange ?? 'NYSE'}: ${data.symbol}` : 'NYSE: KR'}</div>
        <div style={styles.company}>{data?.name ?? 'The Kroger Co.'}</div>
      </div>
      <div style={styles.priceSection}>
        {renderPrice()}
      </div>
    </div>
  );
};

export default KrogerStockQuote;
