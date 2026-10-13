jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
// Reanimated's jest mock omits useReducedMotion; tests flip it with jest.spyOn. It also leaves out
// LayoutAnimationConfig: the stand-in renders its children and keeps its props, so a test reads `skipEntering` and
// `skipExiting`.
jest.mock("react-native-reanimated", () => {
  const { createElement, Fragment } = require("react");
  const LayoutAnimationConfig = ({ children }) => createElement(Fragment, null, children);
  LayoutAnimationConfig.displayName = "LayoutAnimationConfig";
  return {
    ...require("react-native-reanimated/mock"),
    useReducedMotion: jest.fn(() => false),
    LayoutAnimationConfig,
  };
});
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
// In-memory SecureStore so sessions, locale and demo tokens persist within a test.
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
  };
});
// expo-crypto's native module is absent under Jest; Node's UUID is equivalent here.
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));
// lottie-react-native draws through a native view. The stand-in is a host View that keeps every prop, so a test reads
// the `source`, `loop` and `autoPlay` it was given.
jest.mock("lottie-react-native", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  const LottieView = (props) => createElement(View, props);
  LottieView.displayName = "LottieView";
  return { __esModule: true, default: LottieView };
});
// mobile-ui's Pengaturan reaches mobile-core, which loads expo-notifications; the real module throws in Expo Go
// at import. Suites that exercise push mock it themselves with the full surface.
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined", canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic-phone]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
