import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { areaOptions } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { ChoiceList, SheetHeader, Skeleton, SkeletonGroup } from "@catera/mobile-ui";

/** The delivery area kept on this phone. The legacy provider reads the same key, so the choice carries over both ways. */
export const AREA_KEY = "catera.area";

/** Every screen showing the area hears a new choice at once (Jelajah under the area sheet). */
const listeners = new Set<(area: string) => void>();

/** Keeps a new area ("" is every area) and tells every screen showing it. */
export function chooseArea(area: string) {
  for (const listener of listeners) listener(area);
  void SecureStore.setItemAsync(AREA_KEY, area).catch(() => {});
}

/** The kept area: null while it is read from the phone, "" when none is chosen. Follows `chooseArea`. */
export function useStoredArea(): string | null {
  const [area, setArea] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const hear = (value: string) => setArea(value);
    listeners.add(hear);
    void SecureStore.getItemAsync(AREA_KEY)
      .then((value) => {
        if (live) setArea((now) => now ?? (value || ""));
      })
      .catch(() => {
        if (live) setArea((now) => now ?? "");
      });
    return () => {
      live = false;
      listeners.delete(hear);
    };
  }, []);
  return area;
}

/**
 * `/area`: the delivery area as a choice sheet over Jelajah (`sheetOptions({ detents: "fit" })`). It reads and keeps
 * the area itself, so a cold link opens it over Jelajah too. A choice applies at once and closes the sheet; back, a
 * swipe down or Close leave the area as it was. With no area kept yet nothing is marked, and "Semua area" is first.
 */
export function AreaSheet() {
  const { t } = useMobile();
  const insets = useSafeAreaInsets();
  const area = useStoredArea();
  const title = t("Area pengantaran", "Delivery area");
  return (
    <View style={{ paddingBottom: insets.bottom + 16 }}>
      <SheetHeader title={title} closeLabel={t("Tutup", "Close")} />
      {area === null ? (
        // A moment while the phone reads the kept area: the rows wait in their own shape, not unmarked.
        <SkeletonGroup label={t("Memuat area", "Loading areas")}>
          <View style={{ gap: 12, paddingHorizontal: 24, paddingVertical: 8 }}>
            {["", ...areaOptions].map((value) => (
              <Skeleton key={value || "all"} height={32} radius={8} />
            ))}
          </View>
        </SkeletonGroup>
      ) : (
        <ChoiceList
          label={title}
          options={["", ...areaOptions].map((value) => ({ value: value || "all", label: value || t("Semua area", "All areas") }))}
          // No area kept yet marks nothing: "Semua area" is a choice, not the default.
          value={area ? area : null}
          onChange={(next) => {
            chooseArea(next === "all" ? "" : next);
            router.back();
          }}
        />
      )}
    </View>
  );
}
