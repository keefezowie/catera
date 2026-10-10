import { Stack } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { contentTitled, linkTitle, useStackScreenOptions } from "@catera/mobile-ui";
import { tabOfSegment, type Tab } from "../../../src/nav";

/** Each tab's stack starts at its own root, so a cold link to a detail screen has the tab root behind it. */
export const unstable_settings = {
  index: { anchor: "index" },
  jadwal: { anchor: "jadwal" },
  jelajah: { anchor: "jelajah" },
  akun: { anchor: "akun" },
};

const ROOTS: Tab[] = ["index", "jadwal", "jelajah", "akun"];

/**
 * The stack inside one tab. Detail screens push here, so the tab bar stays and switching tabs keeps each tab's place.
 * `segment` is this copy's group, `(jadwal)`; its root comes first. The other tab roots are declared too (the shared
 * folder holds them) but are never opened inside this tab: links to a tab root go through `goToTab`.
 */
export default function TabStack({ segment }: { segment: string }) {
  const { t, demo } = useMobile();
  const screenOptions = useStackScreenOptions(demo);
  const root = tabOfSegment(segment);
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name={root} options={{ headerShown: false }} />
      {ROOTS.filter((name) => name !== root).map((name) => (
        <Stack.Screen key={name} name={name} options={{ headerShown: false }} />
      ))}
      {/* A link that knows the name carries it as `title`, so the header is final on the first frame. */}
      <Stack.Screen
        name="subscriptions/[id]"
        options={({ route }) => contentTitled(linkTitle(route.params) ?? t("Paket", "Plan"))}
      />
      <Stack.Screen name="subscriptions/[id]/menu" options={{ headerShown: false }} />
      <Stack.Screen name="pilih-menu/[id]" options={{ title: t("Pilih menu", "Choose menus") }} />
      {/* The day itself ("Senin 12 Okt") is the title; until it is known the bar stays empty, never "Hari". */}
      <Stack.Screen name="hari/[id]" options={({ route }) => ({ title: linkTitle(route.params) ?? "" })} />
      <Stack.Screen
        name="paket/[id]"
        options={({ route }) => contentTitled(linkTitle(route.params) ?? t("Paket", "Package"))}
      />
      <Stack.Screen name="package/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="bantuan" options={{ title: t("Bantuan dan laporan", "Help and reports") }} />
      <Stack.Screen name="masalah/[id]" options={{ title: t("Ada masalah", "Report a problem") }} />
      <Stack.Screen name="alamat" options={{ title: t("Alamat", "Addresses") }} />
      <Stack.Screen name="addresses" options={{ headerShown: false }} />
      <Stack.Screen name="pembayaran" options={{ title: t("Riwayat pembayaran", "Payment history") }} />
      <Stack.Screen name="disimpan" options={{ title: t("Disimpan", "Saved") }} />
      {/* Its name is the screen's `nativeTitle`: the iOS large title, the first content line on Android. */}
      <Stack.Screen name="paket-saya" options={contentTitled(t("Paket aktif", "Active plans"))} />
      <Stack.Screen name="saved" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ title: t("Notifikasi", "Notifications") }} />
      <Stack.Screen name="discover" options={{ headerShown: false }} />
    </Stack>
  );
}
