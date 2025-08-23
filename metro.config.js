const { getDefaultConfig } = require('@expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Add resolution for problematic packages
defaultConfig.resolver.extraNodeModules = {
  'microsoft-cognitiveservices-speech-sdk': __dirname + '/node_modules/microsoft-cognitiveservices-speech-sdk'
};

module.exports = defaultConfig;
