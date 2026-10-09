import { useMemo, type ReactNode } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { jakartaDay, shortDate } from "@catera/domain";
import { MobileProvider, useMobile } from "@catera/mobile-core";
import {
  AppHeader,
  DemoStrip,
  fontAssets,
  MoodProvider,
  navigationTheme,
  statusBarStyle,
  Text,
  ThemeProvider,
  TopInsetOwner,
  useColors,
  useMood,
  useThemePreference,
} from "@catera/mobile-ui";
import { runtime } from "../src/runtime";
import { dapurLink } from "../src/links";

function Navigation() {
  const { t, ready, locale, demo } = useMobile();
  const palette = useColors();
  const { scheme } = useThemePreference();
  const { mood } = useMood();
  // Above the ready gate, so the loading spinner also gets glyphs that read on the chosen theme. The spinner sits on the
  // canvas and not under a mood header, so only the theme decides until the app is ready.
  const statusBar = (
    <StatusBar style={ready ? statusBarStyle({ scheme, mood, demo }) : statusBarStyle({ scheme, mood: "siang", demo: false })} />
  );
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

/** Language is not ready before the fonts, so this one message is plain Indonesian, as in the customer app. It sits on the canvas of the active theme. */
function FontError() {
  const palette = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: palette.canvas }}>
      <Text selectable>Font tidak dapat dimuat. Mulai ulang aplikasi.</Text>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  if (fontError)
    return (
      <ThemeProvider storageKey={runtime.storageKey("theme")}>
        <FontError />
      </ThemeProvider>
    );
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider storageKey={runtime.storageKey("theme")}>
        <MoodProvider>
          <MobileProvider runtime={runtime} linkMapper={dapurLink}>
            <NavigationColors>
              <Navigation />
            </NavigationColors>
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
