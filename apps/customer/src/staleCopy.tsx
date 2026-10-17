import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useMobile } from "@catera/mobile-core";
import { bannerTime, ReadError } from "@catera/mobile-ui";

const offlineNow = (s: Pick<NetInfoState, "isConnected" | "isInternetReachable">) =>
  s.isConnected === false || s.isInternetReachable === false;

/** Whether the phone reports a connection: null until NetInfo has answered once. */
function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const unsubscribe = NetInfo.addEventListener((s) => live && setOnline(!offlineNow(s)));
    void NetInfo.fetch().then((s) => live && setOnline((now) => (now === null ? !offlineNow(s) : now)));
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  return online;
}

/**
 * A kept copy is on screen although the phone is online: the read failed on the server side, so the copy may be old.
 * The connection banner stays silent then (it is for a phone without signal), and this says so, with the copy's time
 * and "Coba lagi". Renders nothing without a kept copy or while the phone is offline.
 */
export function StaleCopy({ savedAt, onRetry }: { savedAt?: string | null; onRetry: () => void }) {
  const { t } = useMobile();
  const online = useOnline();
  if (!savedAt || online !== true) return null;
  const at = bannerTime(new Date(savedAt));
  return (
    <ReadError
      message={t(`Belum bisa memperbarui. Menampilkan data terakhir, ${at}.`, `Couldn't refresh. Showing data from ${at}.`)}
      onRetry={onRetry}
    />
  );
}
