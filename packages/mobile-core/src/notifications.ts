import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

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

/**
 * Takes this phone's Expo push token off the signed-in account (`device.unregister`, sent through `send` while the
 * session still exists) and then forgets the account's switch flag (`flagKey`, `push.<actorId>`). Rejects when this
 * build has no token to give (no notifications module, no EAS project) or the token read or the server fails; the flag
 * is kept then, so a switch that reads it still matches what the server holds. The token is never logged.
 * Used by the switch's `turnOff` and by sign-out.
 */
export async function unregisterThisPhone(
  send: (action: string, payload: unknown) => Promise<unknown>,
  flagKey: string,
): Promise<void> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!Notifications || !projectId) throw new Error("NOT_CONFIGURED");
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!data) throw new Error("NOT_CONFIGURED");
  await send("device.unregister", { token: data });
  await SecureStore.deleteItemAsync(flagKey).catch(() => undefined);
}
