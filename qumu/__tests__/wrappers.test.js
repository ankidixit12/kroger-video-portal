const path = require('path');

afterEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
});

test('server wrapper loads dotenv from the qumu env file and boots the portal server', () => {
  const config = jest.fn();
  const portalServer = { started: true };

  jest.doMock('dotenv', () => ({ config }));
  jest.doMock('../portal/server', () => portalServer);

  require('../server');

  expect(config).toHaveBeenCalledWith({
    path: path.join(path.resolve(__dirname, '..'), '.env'),
  });
});

test('webpack wrapper re-exports the portal webpack config', () => {
  const webpackConfig = { mode: 'test' };

  jest.doMock('../portal/webpack.config', () => webpackConfig);

  expect(require('../webpack.config')).toBe(webpackConfig);
});