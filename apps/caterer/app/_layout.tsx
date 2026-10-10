import { useEffect, useMemo, type ReactNode } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MobileProvider, useMobile } from "@catera/mobile-core";
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
  useStackScreenOptions,
  useThemePreference,
} from "@catera/mobile-ui";
import { runtime } from "../src/runtime";
import { dapurLink } from "../src/links";
import { openLink, sessionChanged } from "../src/nav";
import { SCREEN_TAB, tabsForRole } from "../src/roles";
import { useModalOptions } from "../src/stack";

function Navigation() {
  const { t, ready, demo, actor } = useMobile();
  const screenOptions = useStackScreenOptions(demo);
  const palette = useColors();
  const { scheme } = useThemePreference();
  const modal = useModalOptions();
  const allowed = tabsForRole(actor?.role);
  // A link held while the session loads opens once the tabs mount; signed out, it is dropped (`sessionChanged`).
  const session = !ready ? "loading" : actor ? "signedIn" : "signedOut";
  useEffect(() => sessionChanged(session), [session]);
  // The app's default glyphs follow the theme: pushed screens and the loading spinner sit on the canvas. A tab root's
  // MoodHeader sets the mood's glyphs over this while its screen is in front. Above the ready gate, so the spinner
  // gets them too.
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
        {/* The tabs, each with its own stack of detail screens (`(tabs)/(index,pelanggan,menu,usaha)`), and above them
            the screens that cover the tab bar: signing in, and the owner's Aktifkan and Impor. */}
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/masuk" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/daftar" options={{ title: t("Daftar", "Sign up") }} />
          {/* Short, self-contained tasks, so they present as modals over the tab bar, with Close at the leading edge
              of the native bar. A role opens each only when it has that screen's tab (`SCREEN_TAB`): a helper
              (staff) never does, from a link or a notification. */}
          <Stack.Protected guard={allowed.includes(SCREEN_TAB.aktifkan)}>
            <Stack.Screen name="aktifkan" options={{ ...modal, title: t("Aktifkan pembayaran", "Turn on payments") }} />
          </Stack.Protected>
          <Stack.Protected guard={allowed.includes(SCREEN_TAB.impor)}>
            <Stack.Screen name="impor" options={{ ...modal, title: t("Impor pelanggan", "Import customers") }} />
          </Stack.Protected>
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
          <MobileProvider runtime={runtime} linkMapper={dapurLink} openLink={openLink}>
            <NavigationColors>
              <Navigation />
            </NavigationColors>
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
