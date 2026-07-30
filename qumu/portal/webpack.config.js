const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/portal.js',
  output: {
    filename: 'portal.js',
    path: path.resolve(__dirname, 'public'),
  },
};
