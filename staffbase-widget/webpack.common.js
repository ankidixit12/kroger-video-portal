const path    = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
require('dotenv').config({
  path: path.resolve(__dirname, '.env'),
  override: true,
});

module.exports = [
  // ── Staffbase SDK widget (kroger-video-widget.js) ──────────────────────
  // React/ReactDOM are bundled inside the widget. Staffbase does not
  // expose them as window globals, so they must be self-contained.
  {
    name: 'staffbase-widget',
    entry: { 'kroger-video-widget': './src/index.tsx' },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, './dist'),
      clean: false,
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.API_BASE_URL':    JSON.stringify(process.env.API_BASE_URL    || 'http://localhost:3000'),
        'process.env.QUMU_USERNAME':   JSON.stringify(process.env.QUMU_USERNAME   || ''),
        'process.env.QUMU_PASSWORD':   JSON.stringify(process.env.QUMU_PASSWORD   || ''),
        'process.env.QUMU_API_URL':    JSON.stringify(process.env.QUMU_API_URL    || 'https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/mycart-qumu/kulus'),
      }),
      new CopyPlugin({
        patterns: [
          { from: 'public', to: '' },
        ],
      }),
    ],
    module: {
      rules: [
        { test: /\.m?js$/, resolve: { fullySpecified: false } },
        { test: /\.(tsx?|jsx?)$/, use: 'babel-loader', exclude: /node_modules/ },
        { test: /\.svg$/, type: 'asset/inline' },
        { test: /\.(png|jpe?g|gif|webp)$/, type: 'asset/inline' },
      ],
    },
  },


  // ── Kroger Stock Quote widget (kroger-stockquote.js) ─────────────────────
  {
    name: 'stockquote-widget',
    entry: { 'kroger-stockquote': './src/stockquote-index.tsx' },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, './dist'),
      clean: false,
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.STOCKQUOTE_API_URL': JSON.stringify(
          process.env.STOCKQUOTE_API_URL || 'http://localhost:3000/api/stockquote'
        ),
      }),
    ],
    module: {
      rules: [
        { test: /\.m?js$/, resolve: { fullySpecified: false } },
        { test: /\.(tsx?|jsx?)$/, use: 'babel-loader', exclude: /node_modules/ },
        { test: /\.svg$/, type: 'asset/inline' },
        { test: /\.(png|jpe?g|gif|webp)$/, type: 'asset/inline' },
      ],
    },
  },


  // ── Qualtrics Embedded Feedback widget (kroger-qualtrics-feedback.js) ───
  {
    name: 'qualtrics-feedback-widget',
    entry: { 'kroger-qualtrics-feedback': './src/qualtrics-index.tsx' },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, './dist'),
      clean: false,
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    plugins: [
      new webpack.DefinePlugin({}),
    ],
    module: {
      rules: [
        { test: /\.m?js$/, resolve: { fullySpecified: false } },
        { test: /\.(tsx?|jsx?)$/, use: 'babel-loader', exclude: /node_modules/ },
        { test: /\.svg$/, type: 'asset/inline' },
        { test: /\.(png|jpe?g|gif|webp)$/, type: 'asset/inline' },
      ],
    },
  },


  // ── PingOne Auth plugin (kroger-pingone-auth.js) ─────────────────────────
  // Invisible Staffbase block. Add to the global page layout once.
  // Handles PingOne PKCE auth via hidden iframe (no popup) and broadcasts the
  // access token via BroadcastChannel so every other widget on the page can
  // call requestSharedToken() from pingone-token-bridge without doing its own auth.
  {
    name:  'pingone-auth-plugin',
    entry: { 'kroger-pingone-auth': './src/pingone-auth-index.tsx' },
    output: {
      filename: '[name].js',
      path:     require('path').resolve(__dirname, './dist'),
      clean:    false,
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    plugins: [
      new webpack.DefinePlugin({}),
    ],
    module: {
      rules: [
        { test: /\.m?js$/,            resolve: { fullySpecified: false } },
        { test: /\.(tsx?|jsx?)$/,     use: 'babel-loader', exclude: /node_modules/ },
        { test: /\.svg$/,             type: 'asset/inline' },
        { test: /\.(png|jpe?g|gif|webp)$/, type: 'asset/inline' },
      ],
    },
  },


  // ── Local demo page (widget-demo.js) ───────────────────────────────────
  // React IS bundled here because widget-demo.html is a standalone page
  // with no host app supplying React.
  {
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
        'process.env.API_BASE_URL':    JSON.stringify(process.env.API_BASE_URL    || 'http://localhost:3000'),
        'process.env.QUMU_USERNAME':   JSON.stringify(process.env.QUMU_USERNAME   || ''),
        'process.env.QUMU_PASSWORD':   JSON.stringify(process.env.QUMU_PASSWORD   || ''),
        'process.env.QUMU_API_URL':    JSON.stringify(process.env.QUMU_API_URL    || 'https://staffbase-qumu-gfe9e3e8ced6g3cu.eastus2-01.azurewebsites.net/mycart-qumu/kulus'),
      }),
      new CopyPlugin({
        patterns: [
          { from: 'public', to: '' },
        ],
      }),
    ],
    module: {
      rules: [
        { test: /\.m?js$/, resolve: { fullySpecified: false } },
        { test: /\.(tsx?|jsx?)$/, use: 'babel-loader', exclude: /node_modules/ },
        { test: /\.svg$/, type: 'asset/inline' },
        { test: /\.(png|jpe?g|gif|webp)$/, type: 'asset/inline' },
      ],
    },
  },
];
