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
    // Opts in to predictive back. No preview shows yet: ReactActivity keeps a back callback enabled at all times (so
    // the system never plays back-to-home), and react-native-screens 4.26 animates no in-app back progress.
    predictiveBackGestureEnabled: true,
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
    // One splash in both themes (the system draws it before the app's stored theme is known): the forest of the app icon with
    // the icon's mascot, a processed transparent derivative inside the Android 12+ circular safe zone. LaunchCover repeats it.
    [
      "expo-splash-screen",
      {
        backgroundColor: "#163D2E",
        image: "../../packages/brand/assets/phase-f/adaptive-foreground.png",
        imageWidth: 200,
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
