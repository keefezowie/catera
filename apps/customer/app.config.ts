import type { ExpoConfig } from "expo/config";

/** The web host that serves /claim and /renew links (e.g. "catera.id"); without it the
 * build has no app links and those URLs keep opening in the browser. */
const webHost = process.env.EXPO_PUBLIC_CATERA_WEB_HOST?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

/** Google Maps key for the address pin, restricted to this app's package and bundle id. Without it the pin stays off. */
const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY?.trim();

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
    // Sign in with Apple (sign-in rethink, 2026-10-30): the entitlement AppleAuthentication.signInAsync needs.
    usesAppleSignIn: true,
    ...(webHost ? { associatedDomains: [`applinks:${webHost}`] } : {}),
  },
  android: {
    package: "id.catera.customer",
    // Opts in to predictive back. No preview shows yet: ReactActivity keeps a back callback enabled at all times (so
    // the system never plays back-to-home), and react-native-screens 4.26 animates no in-app back progress.
    predictiveBackGestureEnabled: true,
    // No Android auto-backup: the kept offline day and the signed-in session stay on this phone and never
    // reach a Google backup that another device could restore.
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: "../../packages/brand/assets/phase-f/adaptive-foreground.png",
      backgroundColor: "#163D2E",
      monochromeImage: "../../packages/brand/assets/phase-f/icon-monochrome.png",
    },
    permissions: ["POST_NOTIFICATIONS", "ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
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
    "expo-apple-authentication",
    ["expo-notifications", { color: "#163D2E" }],
    // Asked only when the customer taps "my location" on the address map, and never in the background.
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Catera memakai lokasimu untuk menandai titik alamat pengantaran.",
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    ["react-native-maps", { androidGoogleMapsApiKey: mapsKey ?? "", iosGoogleMapsApiKey: mapsKey ?? "" }],
    // react-native-maps brings in WorkManager, which starts at launch with Room 2.5. R8's full mode reads Room's own keep
    // rule as class-only and strips the database's constructor, so the release build crashes on open. Found 2026-11-07.
    ["expo-build-properties", { android: { extraProguardRules: "-keep class * extends androidx.room.RoomDatabase { <init>(); }" } }],
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
