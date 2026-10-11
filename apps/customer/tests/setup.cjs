jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
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
// `source`, `transition` and style it was given and can fire its `onError`.
jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  const Image = (props) => createElement(View, props);
  Image.displayName = "ExpoImage";
  return { Image };
});
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
