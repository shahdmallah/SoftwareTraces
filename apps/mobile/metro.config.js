const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const mobileReactNativeRoot = path.resolve(projectRoot, 'node_modules/react-native');
const config = getDefaultConfig(projectRoot);

config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: path.resolve(workspaceRoot, 'node_modules/safe-buffer'),
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-native': mobileReactNativeRoot,
};

const getDefaultModulesRunBeforeMainModule = config.serializer?.getModulesRunBeforeMainModule;
const initializeCoreModule = require.resolve('react-native/Libraries/Core/InitializeCore', {
  paths: [projectRoot],
});

config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule() {
    const modules = getDefaultModulesRunBeforeMainModule
      ? getDefaultModulesRunBeforeMainModule()
      : [];
    const seen = new Set();

    return [initializeCoreModule, ...modules].filter((modulePath) => {
      const normalizedPath = path.normalize(modulePath);
      if (seen.has(normalizedPath)) {
        return false;
      }
      seen.add(normalizedPath);
      return true;
    });
  },
};

// Fix for Windows file watching issues
config.watchFolders = [workspaceRoot];
config.watcher = {
  usePolling: true,
};

// Ignore gradle build artifacts Metro shouldn't watch
config.resolver.blockList = [
  /.*\.gradle.*/,
  /.*expo-module-gradle-plugin.*/,
];

module.exports = config;
