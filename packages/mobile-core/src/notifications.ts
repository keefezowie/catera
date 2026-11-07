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
 * Used by the switch's `turnOff` and by sign-out. `ownerKey` is `PUSH_OWNER`, forgotten with the flag only when it names
 * `actorId`: a mark naming someone else means the token is still on that account, and only the mark can release it.
 */
export async function unregisterThisPhone(
  send: (action: string, payload: unknown) => Promise<unknown>,
  flagKey: string,
  ownerKey: string,
  actorId: string | undefined,
): Promise<void> {
  await send("device.unregister", { token: await phoneToken() });
  await SecureStore.deleteItemAsync(flagKey).catch(() => undefined);
  if ((await SecureStore.getItemAsync(ownerKey).catch(() => null)) === actorId)
    await SecureStore.deleteItemAsync(ownerKey).catch(() => undefined);
}

/** This phone's Expo push token; rejects when this build has none to give. Never logged. */
async function phoneToken(): Promise<string> {
  // Each app config declares its own EAS project; the token belongs to that project.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!Notifications || !projectId) throw new Error("NOT_CONFIGURED");
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!data) throw new Error("NOT_CONFIGURED");
  return data;
}

/**
 * Storage name of the account this phone's token was last registered to. It stays until the token comes off that
 * account, so a session that expired or a sign-out without signal leaves it behind, and the next account can release it.
 */
export const PUSH_OWNER = "push.owner";
/** Set once this phone has let go of a token an older build, which kept no mark, may have left on any account. */
const PUSH_UNMARKED_RELEASED = "push.unmarked-released";

/**
 * Runs when the server confirms `actorId`. If the token still sits on another account, that account must stop getting
 * this phone's notifications, and no one but its owner can unregister it (`device.unregister` deletes only the caller's
 * row). `device.register` moves a token to the caller, so the new account takes it, then lets go unless its own switch
 * is on. A failure keeps the mark, and the next confirmation tries again. Tapping a notification goes through none of this.
 * With no mark the holder is unknown, so a phone that allows notifications does the same once, unless this account's
 * switch is on.
 */
export async function releasePreviousAccount(
  send: (action: string, payload: unknown) => Promise<unknown>,
  key: (name: string) => string,
  actorId: string,
): Promise<void> {
  const [owner, flag] = await Promise.all([
    SecureStore.getItemAsync(key(PUSH_OWNER)),
    SecureStore.getItemAsync(key(`push.${actorId}`)),
  ]);
  if (owner === actorId) return;
  const keeps = flag === "on";
  if (owner) {
    const token = await phoneToken();
    await send("device.register", { token });
    if (!keeps) await send("device.unregister", { token });
    // The token left that account, so its switch must not read on if that person comes back.
    await SecureStore.deleteItemAsync(key(`push.${owner}`));
  } else if (
    !keeps &&
    !(await SecureStore.getItemAsync(key(PUSH_UNMARKED_RELEASED))) &&
    (await Notifications?.getPermissionsAsync())?.status === "granted"
  ) {
    const token = await phoneToken();
    await send("device.register", { token });
    await send("device.unregister", { token });
    await SecureStore.setItemAsync(key(PUSH_UNMARKED_RELEASED), "1");
  }
  // Also marks a phone registered by a build from before this mark existed.
  if (keeps) await SecureStore.setItemAsync(key(PUSH_OWNER), actorId);
  else if (owner) await SecureStore.deleteItemAsync(key(PUSH_OWNER));
}
