const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add platform-specific resolver for web to handle native modules
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Platform-specific module resolution
config.resolver.platformImplementations = {
  web: {
    'react-native-maps': false, // Disable react-native-maps on web
  },
};

// Exclude native modules from web bundle
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Handle native module imports gracefully on web
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;