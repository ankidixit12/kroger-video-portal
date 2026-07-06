import React, { useEffect, useState } from 'react';

interface StockData {
  price: string;
  change: number;
  pct: string;
  date: string;
}

function getStockData(): StockData {
  const basePrice = 53.42;
  const change = parseFloat((Math.random() * 2 - 0.5).toFixed(2));
  const price = (basePrice + change).toFixed(2);
  const pct = ((change / basePrice) * 100).toFixed(2);
  const now = new Date();
  const dateStr =
    now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ',  ' +
    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
    ' EDT';
  return { price, change, pct, date: dateStr };
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    padding: '24px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    maxWidth: '520px',
    width: '100%',
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
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  company: {
    fontSize: '0.875rem',
    color: '#666',
    marginTop: '2px',
  },
  priceSection: {
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  price: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  changePositive: {
    fontSize: '0.9rem',
    fontWeight: 600,
    marginTop: '4px',
    color: '#16a34a',
  },
  changeNegative: {
    fontSize: '0.9rem',
    fontWeight: 600,
    marginTop: '4px',
    color: '#dc2626',
  },
  date: {
    fontSize: '0.75rem',
    color: '#999',
    marginTop: '4px',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#1a1a1a',
    marginBottom: '16px',
  },
  wrapper: {
    padding: '16px',
  },
};

const KrogerStockQuote: React.FC = () => {
  const [data, setData] = useState<StockData>(getStockData());

  useEffect(() => {
    const interval = setInterval(() => {
      setData(getStockData());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const sign = data.change >= 0 ? '+' : '';
  const changeStyle = data.change >= 0 ? styles.changePositive : styles.changeNegative;

  return (
    <div style={styles.wrapper}>
      <div style={styles.title}>Kroger Stock</div>
      <div style={styles.card}>
        <div style={styles.logo}>
          <img src="/assets/images.png" alt="Kroger" style={{ width: '80px', height: 'auto' }} />
        </div>
        <div style={styles.info}>
          <div style={styles.ticker}>NYSE: KR</div>
          <div style={styles.company}>The Kroger Co.</div>
        </div>
        <div style={styles.priceSection}>
          <div style={styles.price}>${data.price}</div>
          <div style={changeStyle}>
            {sign}${Math.abs(data.change).toFixed(2)} today ({sign}{data.pct}%)
          </div>
          <div style={styles.date}>{data.date}</div>
        </div>
      </div>
    </div>
  );
};

export default KrogerStockQuote;
