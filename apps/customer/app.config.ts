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
    supportsTablet: true,
    bundleIdentifier: "id.catera.customer",
    ...(webHost ? { associatedDomains: [`applinks:${webHost}`] } : {}),
  },
  android: {
    package: "id.catera.customer",
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
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFF7E9",
        image: "../../packages/brand/assets/app-icon.png",
        imageWidth: 120,
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
