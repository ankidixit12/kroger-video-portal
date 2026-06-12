const path    = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

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
        'process.env.API_BASE_URL': JSON.stringify(
          process.env.API_BASE_URL || 'http://localhost:3000'
        ),
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

  // ── Qualtrics intercept widget (kroger-qualtrics-intercept.js) ────────
  {
    name: 'qualtrics-intercept',
    entry: { 'kroger-qualtrics-intercept': './src/qualtrics-index.tsx' },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, './dist'),
      clean: false,
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.API_BASE_URL': JSON.stringify(
          process.env.API_BASE_URL || 'http://localhost:3000'
        ),
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
        'process.env.API_BASE_URL': JSON.stringify(
          process.env.API_BASE_URL || 'http://localhost:3000'
        ),
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
