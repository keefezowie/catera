import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Notifications, useMobile } from "@catera/mobile-core";

/** Every mounted status (Akun's row, the Notifikasi card) hears when push is turned on. */
const listeners = new Set<(key: string) => void>();

/** Push on this phone: Aktif only after this account registered the phone (device.register)
 * and the phone still allows notifications. */
export function usePush() {
  const { runtime, actor, enablePush, t } = useMobile();
  const key = runtime.storageKey(`push.${actor?.id ?? "guest"}`);
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([
      Notifications ? Notifications.getPermissionsAsync().catch(() => null) : Promise.resolve(null),
      SecureStore.getItemAsync(key).catch(() => null),
    ]).then(([permission, flag]) => {
      if (live) setOn(permission?.status === "granted" && flag === "on");
    });
    const heard = (k: string) => {
      if (k === key) setOn(true);
    };
    listeners.add(heard);
    return () => {
      live = false;
      listeners.delete(heard);
    };
  }, [key]);
  const enable = useCallback(async () => {
    await enablePush(t("Pengantaran & bantuan", "Deliveries & support"));
    await SecureStore.setItemAsync(key, "on").catch(() => undefined);
    listeners.forEach((l) => l(key));
  }, [enablePush, key, t]);
  return { on, enable };
}
