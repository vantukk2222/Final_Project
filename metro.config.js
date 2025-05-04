/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */
const {getDefaultConfig} = require('@react-native/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  config.resolver.extraNodeModules = require('node-libs-react-native');
  config.transformer = {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  };
  config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'cjs', 'json']; //add here

  return config;
})();
