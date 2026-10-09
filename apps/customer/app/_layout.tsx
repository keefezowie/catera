import { useMemo, type ReactNode } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMobile } from "@catera/mobile-core";
import {
  AppHeader,
  DemoStrip,
  fontAssets,
  navigationTheme,
  Text,
  ThemeProvider,
  TopInsetOwner,
  useColors,
  useThemePreference,
} from "@catera/mobile-ui";
import { runtime } from "../src/runtime";
import { AppProviders } from "../src/shell";

function Navigation() {
  const { t, ready, demo } = useMobile();
  const palette = useColors();
  const { scheme } = useThemePreference();
  // Above the ready gate, so the loading spinner also gets glyphs that read on the chosen theme.
  const statusBar = <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
  if (!ready)
    return (
      <>
        {statusBar}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.canvas }}>
          <ActivityIndicator color={palette.forest} />
        </View>
      </>
    );
  return (
    <TopInsetOwner owned={demo}>
      {statusBar}
      {demo ? <DemoStrip label={t("Demo · data sintetis", "Demo · synthetic data")} /> : null}
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
          contentStyle: { backgroundColor: palette.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: t("Masuk", "Sign in"), presentation: "modal" }} />
        <Stack.Screen name="register" options={{ title: t("Daftar", "Sign up") }} />
        <Stack.Screen name="recover" options={{ title: t("Pemulihan akun", "Account recovery") }} />
        <Stack.Screen
          name="auth/callback"
          options={{ title: t("Verifikasi akun", "Verify account"), headerBackVisible: false }}
        />
        <Stack.Screen name="pilih-menu/[id]" options={{ title: t("Pilih menu", "Choose menus") }} />
        <Stack.Screen name="subscriptions/[id]/menu" options={{ headerShown: false }} />
        <Stack.Screen name="paket/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="package/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="beli/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="renew/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="bayar/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="checkout/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="payment/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="hari/[id]" options={{ title: t("Hari", "Day") }} />
        <Stack.Screen name="subscriptions/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="bantuan" options={{ title: t("Bantuan dan laporan", "Help and reports") }} />
        <Stack.Screen name="masalah/[id]" options={{ title: t("Ada masalah", "Report a problem") }} />
        <Stack.Screen name="claim/[token]" options={{ headerShown: false }} />
        <Stack.Screen name="alamat" options={{ title: t("Alamat", "Addresses") }} />
        <Stack.Screen name="addresses" options={{ headerShown: false }} />
        <Stack.Screen name="pembayaran" options={{ title: t("Riwayat pembayaran", "Payment history") }} />
        <Stack.Screen name="disimpan" options={{ title: t("Disimpan", "Saved") }} />
        <Stack.Screen name="saved" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ title: t("Notifikasi", "Notifications") }} />
      </Stack>
    </TopInsetOwner>
  );
}

/**
 * Gives the navigator the active palette. Scene containers and cards read this instead of the library's light
 * default, so no screen shows a light background behind its own surfaces in dark.
 */
function NavigationColors({ children }: { children: ReactNode }) {
  const palette = useColors();
  const { scheme } = useThemePreference();
  const theme = useMemo(() => navigationTheme(scheme === "dark" ? DarkTheme : DefaultTheme, palette), [palette, scheme]);
  return <NavigationTheme value={theme}>{children}</NavigationTheme>;
}

/** Language is not ready before the fonts, so this one message is plain Indonesian. It sits on the canvas of the active theme. */
function FontError() {
  const palette = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: palette.canvas }}>
      <Text selectable>Font tidak dapat dimuat. Mulai ulang aplikasi.</Text>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);
  if (error)
    return (
      <ThemeProvider storageKey={runtime.storageKey("theme")}>
        <FontError />
      </ThemeProvider>
    );
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider storageKey={runtime.storageKey("theme")}>
        <AppProviders runtime={runtime}>
          <NavigationColors>
            <Navigation />
          </NavigationColors>
        </AppProviders>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
