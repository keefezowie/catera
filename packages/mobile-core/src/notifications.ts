import Constants from "expo-constants";

type NotificationsModule = typeof import("expo-notifications");

/** Expo Go (SDK 53+) throws on Android as soon as expo-notifications loads, so the
 * module is only required in installed builds; Expo Go ("storeClient") runs without push. */
export const pushAvailable = Constants?.executionEnvironment !== "storeClient";

export const Notifications: NotificationsModule | null = pushAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("expo-notifications") as NotificationsModule)
  : null;

/**
 * Whether this build can receive push at all, read when asked rather than at load: the module is present and the app
 * is not running in Expo Go. Pengaturan shows its switch as unavailable when it is false.
 */
export function pushAvailableNow(): boolean {
  return Notifications !== null && Constants?.executionEnvironment !== "storeClient";
}
