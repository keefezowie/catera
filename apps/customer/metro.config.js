const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, "../..");

// Metro watches the whole workspace, apps/web included. Skip the folders that churn there (the demo Postgres data, the
// Next cache, native build output, review captures); watching them grew Metro to an 8 GB heap within hours.
const churn = [".data", "output", "graphify-out", ".superpowers", "apps/web/.data", "apps/web/.next"].concat(
  ["customer", "caterer"].flatMap((app) => ["app/build", ".gradle", "build"].map((dir) => `apps/${app}/android/${dir}`)),
);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
config.resolver.blockList = [].concat(
  config.resolver.blockList ?? [],
  churn.map((dir) => new RegExp(`^${escape(path.join(root, dir))}[\\\\/]`)),
);

// The root package.json `overrides` pin one copy of Reanimated and worklets for the whole workspace. Resolving these
// native-bound modules from the app keeps shared packages (packages/mobile-ui) on that single copy at runtime.
const pinned = ["react-native-reanimated", "react-native-worklets"];
const origin = path.join(__dirname, "package.json");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromApp = pinned.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  return context.resolveRequest(fromApp ? { ...context, originModulePath: origin } : context, moduleName, platform);
};

module.exports = config;
