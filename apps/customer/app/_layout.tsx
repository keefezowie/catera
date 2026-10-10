import { useEffect, useMemo, type ReactNode } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme, useNavigationContainerRef } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMobile } from "@catera/mobile-core";
import {
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
  useMood,
  useThemePreference,
} from "@catera/mobile-ui";
import { registerNavigation } from "../src/nav";
import { runtime } from "../src/runtime";
import { AppProviders } from "../src/shell";
import { useStackScreenOptions } from "../src/stack";

function Navigation() {
  const { t, ready, demo } = useMobile();
  const container = useNavigationContainerRef();
  // goToTab and openLink target each navigator by key; a push tapped while the session loads opens once it can.
  useEffect(() => registerNavigation(container), [container]);
  const palette = useColors();
  const { scheme } = useThemePreference();
  const { mood } = useMood();
  const screenOptions = useStackScreenOptions();
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
    <MoodLabelsProvider t={t}>
      <TopInsetOwner owned={demo}>
        {statusBar}
        {demo ? <DemoStrip label={t("Demo · data sintetis", "Demo · synthetic data")} /> : null}
        {/* The tabs, each with its own stack of detail screens, and above them the screens that cover the tab bar:
            sign-in, buying and paying, a claim link and the story. */}
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: t("Masuk", "Sign in"), presentation: "modal" }} />
          <Stack.Screen name="register" options={{ title: t("Daftar", "Sign up") }} />
          <Stack.Screen name="recover" options={{ title: t("Pemulihan akun", "Account recovery") }} />
          <Stack.Screen
            name="auth/callback"
            options={{ title: t("Verifikasi akun", "Verify account"), headerBackVisible: false }}
          />
          <Stack.Screen name="beli/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="renew/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="bayar/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="checkout/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="payment/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="claim/[token]" options={{ headerShown: false }} />
          {/* Alamat and Bantuan opened from Beli or Bayar: the same screens as in the tabs, over the purchase, so it
              stays underneath and no second tab bar opens. Close returns to it. */}
          <Stack.Screen name="pembelian/alamat" options={{ title: t("Alamat", "Addresses"), presentation: "modal" }} />
          <Stack.Screen
            name="pembelian/bantuan"
            options={{ title: t("Bantuan dan laporan", "Help and reports"), presentation: "modal" }}
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
