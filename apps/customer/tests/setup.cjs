jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
// Jest runs Reanimated's JS module, whose CSS event hook throws when 4.7's native initializer registers one: load the
// web initializer the JS module belongs with.
jest.mock("react-native-reanimated/src/initializers", () => jest.requireActual("react-native-reanimated/src/initializers.ts"));
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
// QR rendering and its native SVG ref are verified in the Android runtime.
jest.mock("react-native-qrcode-svg", () => ({ __esModule: true, default: () => null }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
// expo-image draws through a native view. The stand-in is a host View that keeps every prop, so a test reads the
// `source`, `transition` and style it was given; `loadAsync` is a spy for the mascot warm-up.
jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  const Image = (props) => createElement(View, props);
  Image.displayName = "ExpoImage";
  Image.loadAsync = jest.fn((source) => Promise.resolve({ __ref: source }));
  return { Image };
});
// On Android `useHaptic` plays the view's own feedback (`performAndroidHapticsAsync`). The stand-in hands a choice tick
// to `selectionAsync` and a key click to `impactAsync`, so a test asserts which kind of feedback fired, whatever the
// platform; `packages/mobile-ui` tests the platform mapping itself (apps/customer/tests/haptics.test.ts).
jest.mock("expo-haptics", () => {
  const impactAsync = jest.fn(() => Promise.resolve());
  const selectionAsync = jest.fn(() => Promise.resolve());
  const AndroidHaptics = { Segment_Tick: "segment-tick", Clock_Tick: "clock-tick", Virtual_Key: "virtual-key" };
  return {
    impactAsync,
    selectionAsync,
    notificationAsync: jest.fn(() => Promise.resolve()),
    performAndroidHapticsAsync: jest.fn((type) =>
      type === AndroidHaptics.Virtual_Key ? impactAsync("light") : selectionAsync(),
    ),
    AndroidHaptics,
    ImpactFeedbackStyle: { Light: "light" },
    NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  };
});
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
// NetInfo reads a native module that Jest does not have. The stand-in keeps the listeners and the current state: a
// test sets what the first `NetInfo.fetch()` reports with `NetInfo.__set(state)` and drives a change with
// `NetInfo.__emit(state)`. Nothing is emitted on its own, and the state starts online.
jest.mock("@react-native-community/netinfo", () => {
  const listeners = new Set();
  const online = { isConnected: true, isInternetReachable: true };
  let current = online;
  const NetInfo = {
    addEventListener: jest.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    fetch: jest.fn(async () => current),
    __set: (state) => {
      current = state ?? online;
    },
    __emit: (state) => {
      current = state;
      [...listeners].forEach((listener) => listener(state));
    },
    __listeners: listeners,
  };
  return { __esModule: true, default: NetInfo, ...NetInfo };
});
// A test that went offline (`goOffline()` in tests/offline.ts) must not leave the phone offline for the next one.
afterEach(() => {
  require("@react-native-community/netinfo").__set();
});
// Google and Apple sign-in (mobile-core `signInWithGoogle`, `signInWithApple`, `isAppleSignInAvailable`) reach native
// modules Jest does not have. The stand-ins resolve as a cancelled browser and an unavailable Apple sign-in; a test that
// drives either flow sets its own result with `mockResolvedValueOnce` or `mockRejectedValueOnce`.
jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(async () => ({ type: "cancel" })),
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
  maybeCompleteAuthSession: jest.fn(() => ({ type: "failed" })),
  dismissAuthSession: jest.fn(),
  WebBrowserResultType: { CANCEL: "cancel", DISMISS: "dismiss", OPENED: "opened", LOCKED: "locked" },
}));
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(async () => {
    throw Object.assign(new Error("The user canceled the authorization attempt."), { code: "ERR_REQUEST_CANCELED" });
  }),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
