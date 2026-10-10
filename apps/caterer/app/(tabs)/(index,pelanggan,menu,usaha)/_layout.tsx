import { Stack } from "expo-router";
import { jakartaDay, shortDate } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { tabOfSegment } from "../../../src/nav";
import { CATERER_TABS, SCREEN_TAB, tabsForRole } from "../../../src/roles";
import { useStackScreenOptions } from "../../../src/stack";

/** Each tab's stack starts at its own root, so a link opened cold to a detail screen has the tab root behind it. */
export const unstable_settings = Object.fromEntries(CATERER_TABS.map((tab) => [tab, { anchor: tab }]));

/**
 * The stack inside one tab. Detail screens push here, so the tab bar stays and switching tabs keeps each tab's place.
 * `segment` is this copy's group, `(menu)`; its root comes first. The other tab roots are declared too (the shared
 * folder holds them) but are never opened inside this tab: links to a tab root go through `goToTab`.
 *
 * What a role may open comes from `tabsForRole`: a tab root it does not have, and every screen of that tab
 * (`SCREEN_TAB`), is protected, so a helper (staff) never has them in any stack.
 */
export default function TabStack({ segment }: { segment: string }) {
  const { t, locale, actor } = useMobile();
  const screenOptions = useStackScreenOptions();
  const root = tabOfSegment(segment);
  const allowed = tabsForRole(actor?.role);
  const opens = (screen: keyof typeof SCREEN_TAB) => allowed.includes(SCREEN_TAB[screen]);
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name={root} options={{ headerShown: false }} />
      {CATERER_TABS.filter((name) => name !== root).map((name) => (
        <Stack.Protected key={name} guard={allowed.includes(name)}>
          <Stack.Screen name={name} options={{ headerShown: false }} />
        </Stack.Protected>
      ))}
      {/* Every pushed screen gets a plain title; without one the header shows the route path. */}
      <Stack.Protected guard={opens("laporan/[id]")}>
        <Stack.Screen name="laporan/[id]" options={{ title: t("Laporan masalah", "Problem report") }} />
      </Stack.Protected>
      <Stack.Protected guard={opens("menu/[date]")}>
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
      </Stack.Protected>
      <Stack.Protected guard={opens("pelanggan/[id]")}>
        <Stack.Screen name="pelanggan/[id]" options={{ title: t("Pelanggan", "Customer") }} />
      </Stack.Protected>
      <Stack.Protected guard={opens("paket/[id]")}>
        <Stack.Screen name="paket/[id]" options={{ title: t("Paket", "Package") }} />
      </Stack.Protected>
      <Stack.Protected guard={opens("paket/baru")}>
        <Stack.Screen name="paket/baru" options={{ title: t("Paket baru", "New package") }} />
      </Stack.Protected>
      <Stack.Protected guard={opens("tim")}>
        <Stack.Screen name="tim" options={{ title: t("Tim", "Team") }} />
      </Stack.Protected>
      <Stack.Protected guard={opens("uang")}>
        <Stack.Screen name="uang" options={{ title: t("Uang", "Money") }} />
      </Stack.Protected>
    </Stack>
  );
}
