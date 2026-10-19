const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro is pinned to this directory.
 *
 * The app lives inside a larger repository that has its own package.json at
 * the root (the backend). Left alone, Metro's root detection walks up, finds
 * that file, treats the repository as a workspace root and adds it as a watch
 * folder — which fails outright on Windows with `Invalid root`, and on any
 * platform means Metro watches the whole backend, node_modules included.
 *
 * Naming the project root and the single folder to watch keeps the bundler
 * inside the app regardless of what sits above it.
 *
 * Deliberately NOT touched: `resolver.disableHierarchicalLookup` and
 * `resolver.nodeModulesPaths`. Setting those breaks the build — several Expo
 * packages (expo-asset among them) install nested under `node_modules/expo/`,
 * and hierarchical lookup is how Metro reaches them. expo-doctor flags both
 * overrides for this reason.
 */
const config = getDefaultConfig(__dirname);

config.projectRoot = __dirname;
config.watchFolders = [__dirname];

module.exports = config;
