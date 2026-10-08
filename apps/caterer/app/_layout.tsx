import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { jakartaDay, shortDate } from "@catera/domain";
import { MobileProvider, useMobile } from "@catera/mobile-core";
import { AppHeader, colors, fontAssets } from "@catera/mobile-ui";
import { runtime } from "../src/runtime";
import { dapurLink } from "../src/links";

function Navigation() {
  const { t, ready, locale } = useMobile();
  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          // One header for every pushed screen: round back (or close, for a modal) button and a heading.
          header: ({ options, navigation, back }) => (
            <AppHeader
              title={String(options.title ?? "")}
              onBack={back && options.headerBackVisible !== false ? navigation.goBack : undefined}
              modal={options.presentation === "modal"}
              backLabel={options.presentation === "modal" ? t("Tutup", "Close") : t("Kembali", "Back")}
            />
          ),
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/masuk" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/daftar" options={{ title: t("Daftar", "Sign up") }} />
        {/* Every pushed screen gets a plain title; without one the header shows the route path. */}
        <Stack.Screen name="pelanggan/[id]" options={{ title: t("Pelanggan", "Customer") }} />
        <Stack.Screen name="paket/[id]" options={{ title: t("Paket", "Package") }} />
        <Stack.Screen name="paket/baru" options={{ title: t("Paket baru", "New package") }} />
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
        <Stack.Screen name="aktifkan" options={{ title: t("Aktifkan pembayaran", "Turn on payments") }} />
        <Stack.Screen name="tim" options={{ title: t("Tim", "Team") }} />
        <Stack.Screen name="impor" options={{ title: t("Impor pelanggan", "Import customers") }} />
        <Stack.Screen name="uang" options={{ title: t("Uang", "Money") }} />
        <Stack.Screen name="laporan/[id]" options={{ title: t("Laporan masalah", "Problem report") }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <MobileProvider runtime={runtime} linkMapper={dapurLink}>
        <Navigation />
      </MobileProvider>
    </SafeAreaProvider>
  );
}
