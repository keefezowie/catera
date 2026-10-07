import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Catera Dapur",
  slug: "catera-dapur",
  scheme: "catera-dapur",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "../../packages/brand/assets/app-icon.png",
  ios: { supportsTablet: true, bundleIdentifier: "id.catera.dapur" },
  android: { package: "id.catera.dapur", permissions: ["POST_NOTIFICATIONS"] },
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-notifications", { color: "#163D2E" }],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFF7E9",
        image: "../../packages/brand/assets/app-icon.png",
        imageWidth: 120,
      },
    ],
  ],
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } },
};
export default config;
