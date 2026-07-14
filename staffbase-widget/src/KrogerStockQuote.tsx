import React, { useEffect, useState } from 'react';

declare const process: { env: { STOCKQUOTE_API_URL: string } };

const KROGER_LOGO = 'data:image/png;base64,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';

interface StockData {
  name: string;
  symbol: string;
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
};

const KrogerStockQuote: React.FC = () => {
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState(false);

  const fetchData = () => {
    fetch(process.env.STOCKQUOTE_API_URL)
      .then((r) => r.json())
      .then((json: StockData) => { setData(json); setError(false); })
      .catch(() => setError(true));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const renderPrice = () => {
    if (error) return <div style={styles.status}>Unable to load</div>;
    if (!data) return <div style={styles.status}>Loading...</div>;

    const change = data.changeFromPreviousClose;
    const pct = data.percentChangeFromPreviousClose;
    const sign = change >= 0 ? '+' : '';
    const changeStyle = change >= 0 ? styles.changePositive : styles.changeNegative;

    return (
      <>
        <div style={styles.price}>${data.currentPrice.toFixed(2)}</div>
        <div style={changeStyle}>
          {sign}${Math.abs(change).toFixed(2)} today ({sign}{pct.toFixed(2)}%)
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
        <div style={styles.ticker}>NYSE: KR</div>
        <div style={styles.company}>The Kroger Co.</div>
      </div>
      <div style={styles.priceSection}>
        {renderPrice()}
      </div>
    </div>
  );
};

export default KrogerStockQuote;
