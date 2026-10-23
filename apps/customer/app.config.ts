import type { ExpoConfig } from "expo/config";

/** The web host that serves /claim and /renew links (e.g. "catera.id"); without it the
 * build has no app links and those URLs keep opening in the browser. */
const webHost = process.env.EXPO_PUBLIC_CATERA_WEB_HOST?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

const config: ExpoConfig = {
  name: "Catera",
  slug: "catera-customer",
  scheme: "catera",
  version: "1.0.0",
  orientation: "default",
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
    bundleIdentifier: "id.catera.customer",
    ...(webHost ? { associatedDomains: [`applinks:${webHost}`] } : {}),
  },
  android: {
    package: "id.catera.customer",
    adaptiveIcon: {
      foregroundImage: "../../packages/brand/assets/phase-f/adaptive-foreground.png",
      backgroundColor: "#163D2E",
      monochromeImage: "../../packages/brand/assets/phase-f/icon-monochrome.png",
    },
    permissions: ["POST_NOTIFICATIONS"],
    ...(webHost
      ? {
          intentFilters: [
            {
              action: "VIEW",
              autoVerify: true,
              data: ["/claim/", "/renew/"].map((pathPrefix) => ({ scheme: "https", host: webHost, pathPrefix })),
              category: ["BROWSABLE", "DEFAULT"],
            },
          ],
        }
      : {}),
  },
  plugins: [
    "expo-sharing",
    "expo-router",
    "expo-secure-store",
    ["expo-notifications", { color: "#163D2E" }],
    // The theme canvas with the mascot mark, light and dark (spec 3.3). The marks are processed transparent
    // derivatives drawn inside the Android 12+ circular safe zone; LaunchCover repeats them at the same 200dp.
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
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
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
        "17010cc0-9bc3-40c7-b8c5-62b6a2f6b0e0",
    },
  },
};
export default config;
