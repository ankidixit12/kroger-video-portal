import React, { useEffect, useState } from 'react';
import KROGER_LOGO from '../../public/assets/Kroger.png';

declare const process: { env: { STOCKQUOTE_API_URL: string } };
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
