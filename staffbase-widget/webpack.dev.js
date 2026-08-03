const path      = require('path');
const https     = require('https');
const webpack   = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });

const PLUGIN_ID   = '6a3bd7361da609538cb79dac';
const TOKEN_URL   = `https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/staffbase-qumu/api/token/${PLUGIN_ID}`;
const QUOTE_URL   = 'https://stockquote-dfhmhnf4bbg0cwck.eastus2-01.azurewebsites.net/staffbase-stockQuote/getDelayedQuotes';

let _cachedJwt = null;

function basicAuth() {
  const u = process.env.QUMU_USERNAME || '';
  const p = process.env.QUMU_PASSWORD || '';
  return 'Basic ' + Buffer.from(u + ':' + p).toString('base64');
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    https.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function getJwt() {
  if (_cachedJwt) return _cachedJwt;
  const { status, body } = await httpsGet(TOKEN_URL, { Authorization: basicAuth() });
  if (status >= 400) throw new Error('Token endpoint returned ' + status);
  _cachedJwt = JSON.parse(body).jwt;
  return _cachedJwt;
}

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  name: 'widget-demo',
  entry: { 'widget-demo': './src/widget-demo.tsx' },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, './dist'),
    clean: false,
  },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_BASE_URL':    JSON.stringify('http://localhost:3000'),
      'process.env.QUMU_USERNAME':   JSON.stringify(process.env.QUMU_USERNAME || ''),
      'process.env.QUMU_PASSWORD':   JSON.stringify(process.env.QUMU_PASSWORD || ''),
      'process.env.QUMU_BASE_URL':   JSON.stringify('/api/kulus'),
    }),
    new CopyPlugin({ patterns: [{ from: 'public', to: '' }] }),
  ],
  module: {
    rules: [
      { test: /\.m?js$/, resolve: { fullySpecified: false } },
      { test: /\.(tsx?|jsx?)$/, use: 'babel-loader', exclude: /node_modules/ },
      { test: /\.svg$/, type: 'asset/inline' },
    ],
  },
  devServer: {
    static: [
      { directory: path.resolve(__dirname, 'dist') },
      { directory: path.resolve(__dirname, '../public') },
    ],
    port: 3000,
    open: true,
    hot: true,
    historyApiFallback: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    setupMiddlewares(middlewares, devServer) {
      devServer.app.get('/api/stockquote', async (req, res) => {
        try {
          let jwt = await getJwt();
          let { status, body } = await httpsGet(QUOTE_URL, { Authorization: 'Bearer ' + jwt, Accept: 'application/json' });
          if (status === 401) {
            _cachedJwt = null;
            jwt = await getJwt();
            ({ status, body } = await httpsGet(QUOTE_URL, { Authorization: 'Bearer ' + jwt, Accept: 'application/json' }));
          }
          if (status >= 400) { res.status(status).json({ error: 'Stock quote service error' }); return; }
          res.setHeader('Content-Type', 'application/json').status(status).end(body);
        } catch {
          res.status(502).json({ error: 'Stock quote unavailable' });
        }
      });
      return middlewares;
    },
    proxy: [
      {
        // Widget calls /api/kulus → proxy rewrites to Azure path + injects credentials from .env.
        context: ['/api/kulus'],
        target: 'https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/api/kulus': '/staffbase-qumu/kulus' },
        onProxyReq(proxyReq) {
          const u = process.env.QUMU_USERNAME || '';
          const p = process.env.QUMU_PASSWORD || '';
          if (u) proxyReq.setHeader('Authorization', 'Basic ' + Buffer.from(u + ':' + p).toString('base64'));
        },
      },
      {
        // Widget calls /api/qumu-token/{pluginId} → proxy rewrites to Azure token endpoint.
        context: ['/api/qumu-token'],
        target: 'https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/api/qumu-token': '/staffbase-qumu/api/token' },
        onProxyReq(proxyReq) {
          const u = process.env.QUMU_USERNAME || '';
          const p = process.env.QUMU_PASSWORD || '';
          if (u) proxyReq.setHeader('Authorization', 'Basic ' + Buffer.from(u + ':' + p).toString('base64'));
        },
      },
      {
        // Staffbase-style token path used in production: /api/installations/{id}/service/token
        // In dev there is no Staffbase server, so proxy it to the Qumu Azure token endpoint instead.
        context: ['/api/installations'],
        target: 'https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/api/installations/([^/]+)/service/token': '/staffbase-qumu/api/token/$1' },
        onProxyReq(proxyReq) {
          const u = process.env.QUMU_USERNAME || '';
          const p = process.env.QUMU_PASSWORD || '';
          if (u) proxyReq.setHeader('Authorization', 'Basic ' + Buffer.from(u + ':' + p).toString('base64'));
        },
      },
    ],
  },
};
