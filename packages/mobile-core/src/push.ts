import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "expo-router";
import { Notifications, PUSH_OWNER, pushAvailableNow, unregisterThisPhone } from "./notifications";
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

/**
 * The switch and its two changes. **Callers must catch `turnOn()` and `turnOff()`:** a failed change puts the switch
 * back where it truly was and then rejects, and the hook cannot say so itself (mobile-core has no toast). Both
 * Pengaturan screens call `.catch(failed)`, which shows "Belum berhasil. Coba lagi."; an uncaught call would surface as
 * an unhandled rejection. A refused permission is not a failure and does not reject.
 */
export type PushSwitch = {
  state: PushSwitchState;
  /** Asks for the permission if needed, registers this phone (`device.register`) and remembers it. Rejects on failure. */
  turnOn(): Promise<void>;
  /** Removes this phone's token from the account (`device.unregister`) and forgets the flag. Rejects on failure. */
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
      change(current.current === "denied" ? "denied" : "on", () => allowAndRegister(enablePush, channelName, key)),
    [change, enablePush, channelName, key],
  );

  const turnOff = useCallback(
    () =>
      change("off", async () => {
        await unregisterThisPhone(command, key, runtime.storageKey(PUSH_OWNER), actor?.id);
        return "off";
      }),
    [change, command, key, runtime, actor?.id],
  );

  return { state, turnOn, turnOff };
}

/**
 * Asks for the permission if the phone has not given it, then registers this phone and sets the account's flag. The
 * switch's `turnOn` and the primer's "Nyalakan notifikasi" share it. A refusal settles on its state; a failed
 * registration rejects.
 */
async function allowAndRegister(
  enablePush: (channelName: string) => Promise<void>,
  channelName: string,
  key: string,
): Promise<PushSwitchState> {
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
}

/** The push primer: whether it shows, and its two answers. */
export type PushPrimer = {
  shown: boolean;
  /** "Nyalakan notifikasi": asks the phone and registers it, as the switch does. Rejects when registering fails. */
  accept(): Promise<PushSwitchState>;
  /** "Nanti saja": closes it. Either answer is final; the primer never returns. */
  dismiss(): void;
};

/**
 * The one-time push primer (polish spec, ruling 4). With `eligible` (the caller's moment: the first paid plan) it shows
 * only when this build can receive push and the phone has never been asked (`undetermined`, and it may still ask). The
 * phone remembers it the moment it shows (`push.primer`), so it appears at most once per phone, whatever the answer
 * and even if the app closes on it. An unreadable permission or mark shows nothing.
 */
export function usePushPrimer(channelName: string, eligible: boolean): PushPrimer {
  const { runtime, actor, enablePush } = useMobile();
  const [shown, setShown] = useState(false);
  const mark = runtime.storageKey("push.primer");
  const flag = runtime.storageKey(`push.${actor?.id ?? "guest"}`);
  const signedIn = !!actor;

  useEffect(() => {
    if (!eligible || !signedIn || !pushAvailableNow() || !Notifications) return;
    const phone = Notifications;
    let live = true;
    void Promise.all([Promise.resolve().then(() => phone.getPermissionsAsync()), SecureStore.getItemAsync(mark)])
      .then(async ([permission, seen]) => {
        const unasked = permission.status === "undetermined" && permission.canAskAgain !== false;
        if (!live || seen || !unasked) return;
        await SecureStore.setItemAsync(mark, "shown");
        if (live) setShown(true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [eligible, signedIn, mark]);

  const accept = useCallback(() => {
    setShown(false);
    return allowAndRegister(enablePush, channelName, flag);
  }, [enablePush, channelName, flag]);
  const dismiss = useCallback(() => setShown(false), []);
  return { shown, accept, dismiss };
}
