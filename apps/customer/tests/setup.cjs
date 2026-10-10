jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
// Reanimated's jest mock omits useReducedMotion; tests flip it with jest.spyOn.
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  useReducedMotion: jest.fn(() => false),
}));
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
