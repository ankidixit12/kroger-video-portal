module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { esmodules: true },
        loose: true,
      },
    ],
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  plugins: [
    '@babel/plugin-syntax-dynamic-import',
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ['@babel/plugin-proposal-object-rest-spread', { loose: true }],
  ],
};
