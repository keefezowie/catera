import { useEffect, useMemo, type ReactNode } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme, useNavigationContainerRef } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMobile } from "@catera/mobile-core";
import {
  contentTitled,
  DemoStrip,
  fontAssets,
  MoodLabelsProvider,
  MoodProvider,
  navigationTheme,
  statusBarStyle,
  Text,
  ThemeProvider,
  TopInsetOwner,
  useColors,
  useStackScreenOptions,
  useThemePreference,
} from "@catera/mobile-ui";
import { registerNavigation } from "../src/nav";
import { runtime } from "../src/runtime";
import { AppProviders } from "../src/shell";
import { useFlowOptions } from "../src/stack";

function Navigation() {
  const { t, ready, demo } = useMobile();
  const container = useNavigationContainerRef();
  // goToTab and openLink target each navigator by key; a push tapped while the session loads opens once it can.
  useEffect(() => registerNavigation(container), [container]);
  const palette = useColors();
  const { scheme } = useThemePreference();
  const screenOptions = useStackScreenOptions(demo);
  const flow = useFlowOptions();
  // The app's default glyphs follow the theme: pushed screens and the loading spinner sit on the canvas. A tab root's
  // MoodHeader sets the mood's glyphs over this while its screen is in front.
  const statusBar = <StatusBar style={statusBarStyle({ scheme, mood: null, demo })} />;
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
    <MoodLabelsProvider t={t}>
      <TopInsetOwner owned={demo}>
        {statusBar}
        {demo ? <DemoStrip label={t("Demo · data sintetis", "Demo · synthetic data")} /> : null}
        {/* The tabs, each with its own stack of detail screens, and above them the screens that cover the tab bar:
            sign-in, buying and paying, a claim link and the story. */}
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Short forms: a sheet on iOS, each with Close at the leading edge. */}
          <Stack.Screen name="login" options={{ title: t("Masuk", "Sign in"), ...flow("modal") }} />
          <Stack.Screen name="register" options={{ title: t("Daftar", "Sign up"), ...flow("modal") }} />
          <Stack.Screen name="recover" options={{ title: t("Pemulihan akun", "Account recovery"), ...flow("modal") }} />
          <Stack.Screen
            name="auth/callback"
            options={{ title: t("Verifikasi akun", "Verify account"), headerBackVisible: false }}
          />
          {/* Buying and paying are full-screen modals: a sheet's swipe could drop a purchase or a payment midway.
              Beli replaces itself with Bayar, so the two share one presentation. */}
          <Stack.Screen name="beli/[id]" options={{ ...contentTitled(t("Beli", "Buy")), ...flow("fullScreenModal") }} />
          <Stack.Screen
            name="renew/[id]"
            options={{ ...contentTitled(t("Perpanjang", "Renew")), ...flow("fullScreenModal") }}
          />
          <Stack.Screen name="bayar/[id]" options={{ ...contentTitled(t("Bayar", "Pay")), ...flow("fullScreenModal") }} />
          <Stack.Screen name="checkout/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="payment/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="claim/[token]" options={{ ...contentTitled(""), ...flow("modal") }} />
          {/* Alamat and Bantuan opened from Beli or Bayar: the same screens as in the tabs, over the purchase, so it
              stays underneath and no second tab bar opens. Close returns to it. */}
          <Stack.Screen name="pembelian/alamat" options={{ title: t("Alamat", "Addresses"), ...flow("modal") }} />
          <Stack.Screen
            name="pembelian/bantuan"
            options={{ title: t("Bantuan dan laporan", "Help and reports"), ...flow("modal") }}
          />
          {/* A black story: its own close button replaces the header, and a fade keeps its ground from cutting in. */}
          <Stack.Screen
            name="tomorrow"
            options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }}
          />
        </Stack>
      </TopInsetOwner>
    </MoodLabelsProvider>
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
        <MoodProvider>
          <AppProviders runtime={runtime}>
            <NavigationColors>
              <Navigation />
            </NavigationColors>
          </AppProviders>
        </MoodProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
