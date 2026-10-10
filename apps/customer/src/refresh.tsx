import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl } from "react-native";
import { useColors } from "@catera/mobile-ui";

/**
 * The platform pull to refresh for a screen whose content is already on it (spec 2.4): Beranda, Jadwal and Paket saya.
 * Pulling runs `reload` (each `useData` reload keeps what is shown while it reads, and records a failure on its own
 * line), so a refresh never swaps the page for a skeleton. The spinner is the platform's, in forest. Hand the result to
 * `Screen`'s `refreshControl`.
 */
export function usePullToRefresh(reload: () => Promise<unknown>) {
  const c = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(reload);
  latest.current = reload;
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void latest
      .current()
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setRefreshing(false);
      });
  }, []);
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[c.forest]}
      tintColor={c.forest}
      progressBackgroundColor={c.surface}
    />
  );
}
