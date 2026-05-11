const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

// Prefer the app-local React packages so Expo resolves the same versions as
// react-native-renderer, while still allowing other hoisted workspace deps.
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

// Fix for Windows file watching issues
config.watchFolders = [workspaceRoot];
config.watcher = {
  usePolling: true,
};

module.exports = config;
