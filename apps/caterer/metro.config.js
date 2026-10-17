const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The root package.json `overrides` pin one copy of Reanimated and worklets for the whole workspace. Resolving these
// native-bound modules from the app keeps shared packages (packages/mobile-ui) on that single copy at runtime.
const pinned = ["react-native-reanimated", "react-native-worklets"];
const origin = path.join(__dirname, "package.json");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromApp = pinned.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  return context.resolveRequest(fromApp ? { ...context, originModulePath: origin } : context, moduleName, platform);
};

module.exports = config;
