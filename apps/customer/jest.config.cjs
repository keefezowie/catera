module.exports = {
  preset: "jest-expo/ios",
  testMatch: ["<rootDir>/tests/**/*.test.tsx"],
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", { presets: ["babel-preset-expo"] }],
  },
  moduleNameMapper: {
    "^react/package.json$": require.resolve("react/package.json"),
    "^react$": require.resolve("react"),
    "^react-test-renderer$": require.resolve("react-test-renderer"),
    "^@catera/domain$": "<rootDir>/../../packages/domain/src/index.ts",
    "^@catera/api-client$": "<rootDir>/../../packages/api-client/src/index.ts",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo/.*|react-navigation|@react-navigation/.*|@catera/.*)/)",
  ],
};
