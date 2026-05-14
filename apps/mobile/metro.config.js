const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const workspaceNodeModules = path.resolve(workspaceRoot, 'node_modules');
const mobileReactNativeRoot = path.resolve(projectRoot, 'node_modules/react-native');
const config = getDefaultConfig(projectRoot);

config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  workspaceNodeModules,
];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: path.resolve(workspaceNodeModules, 'safe-buffer'),
  react: path.resolve(workspaceNodeModules, 'react'),
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

// Resolve hoisted workspace dependencies explicitly; avoid crawling unrelated apps.
config.watchFolders = [workspaceNodeModules];
config.watcher = {
  usePolling: true,
};

// Ignore gradle build artifacts Metro shouldn't watch
config.resolver.blockList = [
  /.*\.gradle.*/,
  /[/\\]node_modules[/\\].*[/\\]android[/\\].*[/\\]build([/\\].*)?$/,
  /[/\\]node_modules[/\\].*[/\\]android[/\\].*[/\\]\.gradle([/\\].*)?$/,
  /.*expo-module-gradle-plugin.*/,
  /.*expo-gradle-plugin.*/,
  /[/\\]node_modules[/\\]\.[^/\\]+-[^/\\]+([/\\].*)?$/,
];

module.exports = config;
