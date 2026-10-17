import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Catera Dapur",
  slug: "catera-dapur",
  scheme: "catera-dapur",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "../../packages/brand/assets/app-icon.png",
  ios: {
    // iOS 18 home-screen appearances: the light icon is the existing one; dark and tinted are phase-f derivatives.
    icon: {
      light: "../../packages/brand/assets/app-icon.png",
      dark: "../../packages/brand/assets/phase-f/icon-ios-dark.png",
      tinted: "../../packages/brand/assets/phase-f/icon-ios-tinted.png",
    },
    supportsTablet: true,
    bundleIdentifier: "id.catera.dapur",
  },
  android: {
    package: "id.catera.dapur",
    permissions: ["POST_NOTIFICATIONS"],
    adaptiveIcon: {
      foregroundImage: "../../packages/brand/assets/phase-f/adaptive-foreground.png",
      backgroundColor: "#163D2E",
      monochromeImage: "../../packages/brand/assets/phase-f/icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-notifications", { color: "#163D2E" }],
    ["expo-image-picker", { photosPermission: "Catera Dapur memakai foto kamu untuk gambar paket.", cameraPermission: "Catera Dapur memakai kamera untuk memotret bukti pengantaran yang sudah sampai." }],
    // The theme canvas with the mascot mark, light and dark (spec 3.3). The marks are processed transparent
    // derivatives drawn inside the Android 12+ circular safe zone; LaunchCover repeats them at the same 200dp.
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FDFAF3",
        image: "../../packages/brand/assets/phase-f/splash-mark-light.png",
        imageWidth: 200,
        dark: {
          backgroundColor: "#151514",
          image: "../../packages/brand/assets/phase-f/splash-mark-dark.png",
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "1c3f597c-4cba-498d-9d14-48b9c5ebafcc",
    },
  },
};
export default config;
