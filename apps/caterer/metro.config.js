const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Shared packages (packages/mobile-ui) sit beside a hoisted root copy of Reanimated that differs from the
// SDK-pinned copy in this app. Resolve these native-bound modules from the app so only one instance loads.
const pinned = ["react-native-reanimated", "react-native-worklets"];
const origin = path.join(__dirname, "package.json");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromApp = pinned.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  return context.resolveRequest(fromApp ? { ...context, originModulePath: origin } : context, moduleName, platform);
};

module.exports = config;
