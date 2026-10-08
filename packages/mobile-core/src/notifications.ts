import Constants from "expo-constants";

type NotificationsModule = typeof import("expo-notifications");

/** Expo Go (SDK 53+) throws on Android as soon as expo-notifications loads, so the
 * module is only required in installed builds; Expo Go ("storeClient") runs without push. */
export const pushAvailable = Constants?.executionEnvironment !== "storeClient";

export const Notifications: NotificationsModule | null = pushAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("expo-notifications") as NotificationsModule)
  : null;
