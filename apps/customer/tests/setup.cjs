jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);
// QR rendering and its native SVG ref are verified in the Android runtime.
jest.mock("react-native-qrcode-svg", () => ({ __esModule: true, default: () => null }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
