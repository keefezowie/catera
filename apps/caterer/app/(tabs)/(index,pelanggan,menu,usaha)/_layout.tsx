import { Stack } from "expo-router";
import { jakartaDay, shortDate } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { tabOfSegment } from "../../../src/nav";
import type { CatererTab } from "../../../src/roles";
import { useStackScreenOptions } from "../../../src/stack";

/** Each tab's stack starts at its own root, so a link opened cold to a detail screen has the tab root behind it. */
export const unstable_settings = {
  index: { anchor: "index" },
  pelanggan: { anchor: "pelanggan" },
  menu: { anchor: "menu" },
  usaha: { anchor: "usaha" },
};

const ROOTS: CatererTab[] = ["index", "pelanggan", "menu", "usaha"];
/** Roots and screens only an owner opens; a helper (staff) never has them in any stack. */
const OWNER_ROOTS: CatererTab[] = ["pelanggan", "usaha"];

/**
 * The stack inside one tab. Detail screens push here, so the tab bar stays and switching tabs keeps each tab's place.
 * `segment` is this copy's group, `(menu)`; its root comes first. The other tab roots are declared too (the shared
 * folder holds them) but are never opened inside this tab: links to a tab root go through `goToTab`.
 */
export default function TabStack({ segment }: { segment: string }) {
  const { t, locale, actor } = useMobile();
  const screenOptions = useStackScreenOptions();
  const root = tabOfSegment(segment);
  const owner = actor?.role === "owner";
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name={root} options={{ headerShown: false }} />
      {ROOTS.filter((name) => name !== root && !OWNER_ROOTS.includes(name)).map((name) => (
        <Stack.Screen key={name} name={name} options={{ headerShown: false }} />
      ))}
      {/* Every pushed screen gets a plain title; without one the header shows the route path. */}
      <Stack.Screen name="laporan/[id]" options={{ title: t("Laporan masalah", "Problem report") }} />
      <Stack.Screen
        name="menu/[date]"
        options={({ route }) => {
          const date = String((route.params as { date?: string } | undefined)?.date ?? "");
          const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
          return {
            title:
              !valid || date === jakartaDay(new Date())
                ? t("Menu hari ini", "Today's menu")
                : `${t("Menu", "Menu")} ${shortDate(date, locale)}`,
          };
        }}
      />
      <Stack.Protected guard={owner}>
        {OWNER_ROOTS.filter((name) => name !== root).map((name) => (
          <Stack.Screen key={name} name={name} options={{ headerShown: false }} />
        ))}
        <Stack.Screen name="pelanggan/[id]" options={{ title: t("Pelanggan", "Customer") }} />
        <Stack.Screen name="paket/[id]" options={{ title: t("Paket", "Package") }} />
        <Stack.Screen name="paket/baru" options={{ title: t("Paket baru", "New package") }} />
        <Stack.Screen name="tim" options={{ title: t("Tim", "Team") }} />
        <Stack.Screen name="uang" options={{ title: t("Uang", "Money") }} />
      </Stack.Protected>
    </Stack>
  );
}
