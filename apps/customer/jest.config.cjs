const path = require("node:path");
// packages/mobile-ui imports Reanimated from the hoisted root copy; pin it to this app's pinned SDK copy.
const pinned = (name) => path.dirname(require.resolve(`${name}/package.json`));

module.exports = {
  preset: "jest-expo/android",
  testMatch: ["<rootDir>/tests/**/*.test.tsx"],
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", { presets: ["babel-preset-expo"] }],
  },
  moduleNameMapper: {
    "^react/package.json$": require.resolve("react/package.json"),
    "^react$": require.resolve("react"),
    "^react-native-reanimated$": pinned("react-native-reanimated"),
    "^react-native-reanimated/(.*)$": `${pinned("react-native-reanimated")}/$1`,
    "^react-native-worklets$": pinned("react-native-worklets"),
    "^react-native-worklets/(.*)$": `${pinned("react-native-worklets")}/$1`,
    "^react-test-renderer$": require.resolve("react-test-renderer"),
    "^@catera/domain$": "<rootDir>/../../packages/domain/src/index.ts",
    "^@catera/api-client$": "<rootDir>/../../packages/api-client/src/index.ts",
    "^@catera/design-tokens$": "<rootDir>/../../packages/design-tokens/src/index.ts",
    "^@catera/mobile-core$": "<rootDir>/../../packages/mobile-core/src/index.ts",
    "^@catera/mobile-ui$": "<rootDir>/../../packages/mobile-ui/src/index.ts",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|react-native-url-polyfill|react-native-reanimated|react-native-safe-area-context|react-native-worklets|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo/.*|react-navigation|@react-navigation/.*|@expo-google-fonts/.*|standard-navigation|@catera/.*)/)",
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.cjs"],
};
