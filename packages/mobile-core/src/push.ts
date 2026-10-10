import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { useFocusEffect } from "expo-router";
import { Notifications, pushAvailableNow } from "./notifications";
import { useMobile } from "./provider";

/**
 * What Pengaturan's notification switch shows:
 * - `on`: the phone allows notifications and this account registered this phone (the flag `push.<actorId>`).
 * - `off`: either is missing.
 * - `denied`: the phone blocks Catera's notifications; only the phone's own settings can change that.
 * - `unavailable`: this build cannot receive push (Expo Go).
 * - `loading`: the first read has not answered yet.
 */
export type PushSwitchState = "on" | "off" | "denied" | "unavailable" | "loading";

export type PushSwitch = {
  state: PushSwitchState;
  /** Asks for the permission if needed, registers this phone (`device.register`) and remembers it. */
  turnOn(): Promise<void>;
  /** Removes this phone's token from the account (`device.unregister`) and forgets the flag. */
  turnOff(): Promise<void>;
};

type Permission = { status?: string } | null;

/** The phone's permission and this account's flag, as one state. The phone wins: a blocked phone is never on. */
function stateOf(permission: Permission, flag: string | null): PushSwitchState {
  if (permission?.status === "denied") return "denied";
  if (permission?.status === "granted") return flag === "on" ? "on" : "off";
  return "off";
}

/**
 * The truthful notification switch shared by both apps. It reads the phone's permission and the flag whenever its
 * screen comes into focus and whenever the app returns to the foreground (back from the phone's settings), so a
 * permission changed outside the app shows at once.
 *
 * `turnOn` and `turnOff` move the switch at once and settle on the outcome. A failure puts the switch back where it
 * truly was and rejects, so the screen can say so ("Belum berhasil. Coba lagi."). A refused permission is not a
 * failure: it settles on `denied`. While one of them runs, reads wait their turn, so a focus never undoes it.
 * `channelName` names the Android notification channel ("Pengantaran & bantuan", "Catera Dapur").
 */
export function usePushSwitch(channelName: string): PushSwitch {
  const { runtime, actor, enablePush, command } = useMobile();
  const available = pushAvailableNow();
  const key = runtime.storageKey(`push.${actor?.id ?? "guest"}`);
  const [state, setStateValue] = useState<PushSwitchState>(available ? "loading" : "unavailable");
  const current = useRef(state);
  const setState = useCallback((next: PushSwitchState) => {
    current.current = next;
    setStateValue(next);
  }, []);
  const busy = useRef(false);
  const generation = useRef(0);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const read = useCallback(async () => {
    if (!available || !Notifications || busy.current) return;
    const asked = ++generation.current;
    const phone = Notifications;
    // An unreadable permission or flag reads as off, never as an error on screen.
    const [permission, flag] = await Promise.all([
      Promise.resolve()
        .then(() => phone.getPermissionsAsync())
        .catch(() => null),
      Promise.resolve()
        .then(() => SecureStore.getItemAsync(key))
        .catch(() => null),
    ]);
    // A newer read, or a change the user started meanwhile, has the last word.
    if (!live.current || asked !== generation.current || busy.current) return;
    setState(stateOf(permission, flag));
  }, [available, key, setState]);

  useFocusEffect(
    useCallback(() => {
      void read();
    }, [read]),
  );

  useEffect(() => {
    if (!available) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void read();
    });
    return () => subscription.remove();
  }, [available, read]);

  /** Runs one change with the switch already showing `moving`; a failure restores what was true before. */
  const change = useCallback(
    async (moving: PushSwitchState, work: () => Promise<PushSwitchState>) => {
      if (!available || !Notifications || busy.current) return;
      busy.current = true;
      generation.current += 1;
      const before = current.current === "loading" ? "off" : current.current;
      setState(moving);
      try {
        const settled = await work();
        if (live.current) setState(settled);
      } catch (e) {
        if (live.current) setState(before);
        throw e;
      } finally {
        busy.current = false;
      }
    },
    [available, setState],
  );

  const turnOn = useCallback(
    () =>
      // While the phone blocks Catera the switch never shows on, not even while it asks again.
      change(current.current === "denied" ? "denied" : "on", async () => {
        const phone = Notifications!;
        const permission = await phone.getPermissionsAsync();
        if (permission.status !== "granted") {
          const answer = await phone.requestPermissionsAsync();
          if (answer.status !== "granted") return stateOf(answer, null);
        }
        await enablePush(channelName);
        // A lost flag only means the next read shows off; the phone is registered either way.
        await SecureStore.setItemAsync(key, "on").catch(() => undefined);
        return "on";
      }),
    [change, enablePush, channelName, key],
  );

  const turnOff = useCallback(
    () =>
      change("off", async () => {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) throw new Error("NOT_CONFIGURED");
        const { data } = await Notifications!.getExpoPushTokenAsync({ projectId });
        await command("device.unregister", { token: data });
        await SecureStore.deleteItemAsync(key).catch(() => undefined);
        return "off";
      }),
    [change, command, key],
  );

  return { state, turnOn, turnOff };
}
