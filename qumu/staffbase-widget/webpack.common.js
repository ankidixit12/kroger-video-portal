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
        'process.env.STAFFBASE_BASE_URL': JSON.stringify(process.env.STAFFBASE_BASE_URL || ''),
        'process.env.QUMU_SERVICE_ROOT': JSON.stringify(process.env.QUMU_SERVICE_ROOT || ''),
        'process.env.QUMU_KULUS_BASE_URL': JSON.stringify(process.env.QUMU_KULUS_BASE_URL || ''),
        'process.env.QUMU_TOKEN_BASE_URL': JSON.stringify(process.env.QUMU_TOKEN_BASE_URL || ''),
        'process.env.QUMU_POST_BASE_URL': JSON.stringify(process.env.QUMU_POST_BASE_URL || ''),
        'process.env.QUMU_USERNAME':   JSON.stringify(process.env.QUMU_USERNAME   || ''),
        'process.env.QUMU_PASSWORD':   JSON.stringify(process.env.QUMU_PASSWORD   || ''),
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
      ],
    },
  },

  // ── Local demo page (kroger-video.js) ───────────────────────────────────
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
        'process.env.STAFFBASE_BASE_URL': JSON.stringify(process.env.STAFFBASE_BASE_URL || ''),
        'process.env.QUMU_SERVICE_ROOT': JSON.stringify(process.env.QUMU_SERVICE_ROOT || ''),
        'process.env.QUMU_KULUS_BASE_URL': JSON.stringify(process.env.QUMU_KULUS_BASE_URL || ''),
        'process.env.QUMU_TOKEN_BASE_URL': JSON.stringify(process.env.QUMU_TOKEN_BASE_URL || ''),
        'process.env.QUMU_POST_BASE_URL': JSON.stringify(process.env.QUMU_POST_BASE_URL || ''),
        'process.env.QUMU_USERNAME':   JSON.stringify(process.env.QUMU_USERNAME   || ''),
        'process.env.QUMU_PASSWORD':   JSON.stringify(process.env.QUMU_PASSWORD   || ''),
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
      ],
    },
  },
];
