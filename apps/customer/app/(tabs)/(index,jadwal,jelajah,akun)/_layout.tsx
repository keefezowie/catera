import { Stack } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { contentTitled, linkTitle, sheetOptions, useColors, useStackScreenOptions } from "@catera/mobile-ui";
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
  const palette = useColors();
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
      {/* The forms with fields (Ada masalah, Ubah hari, the review, the address and help forms) are root-stack sheets
          (`app/_layout.tsx`): react-native-screens 4.26 draws a tab-stack sheet inside the tab host, where its dimming
          view takes the first TalkBack focus and the tab bar covers the form. The area choice has no fields and fits
          its rows, so it stays a native sheet over Jelajah. */}
      <Stack.Screen name="area" options={sheetOptions({ detents: "fit", palette })} />
      <Stack.Screen name="alamat" options={{ title: t("Alamat", "Addresses") }} />
      <Stack.Screen name="addresses" options={{ headerShown: false }} />
      <Stack.Screen name="pembayaran" options={{ title: t("Riwayat pembayaran", "Payment history") }} />
      <Stack.Screen name="disimpan" options={{ title: t("Disimpan", "Saved") }} />
      {/* Its name is the screen's `nativeTitle`: the iOS large title, the first content line on Android. */}
      <Stack.Screen name="paket-saya" options={contentTitled(t("Paket aktif", "Active plans"))} />
      <Stack.Screen name="saved" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ title: t("Notifikasi", "Notifications") }} />
      <Stack.Screen name="pengaturan" options={contentTitled(t("Pengaturan", "Settings"))} />
      {/* Pengaturan's choice sheets size to their content and draw their own title. */}
      <Stack.Screen name="pengaturan/tampilan" options={sheetOptions({ detents: "fit", palette })} />
      <Stack.Screen name="pengaturan/bahasa" options={sheetOptions({ detents: "fit", palette })} />
      <Stack.Screen name="discover" options={{ headerShown: false }} />
    </Stack>
  );
}
