const path = require('path');

module.exports = {
  entry: { 'kroger-video-widget': './src/index.tsx' },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../public'),
    clean: false,
  },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: { fullySpecified: false },
      },
      {
        test: /\.(tsx?|jsx?)$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.svg$/,
        type: 'asset/inline',
      },
    ],
  },
};
