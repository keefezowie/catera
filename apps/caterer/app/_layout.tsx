import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Appearance, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MobileProvider, useMobile } from "@catera/mobile-core";
import {
  DemoStrip,
  fontAssets,
  LaunchCover,
  MascotLoading,
  MoodLabelsProvider,
  MoodProvider,
  navigationTheme,
  sheetOptions,
  statusBarStyle,
  Text,
  ThemeProvider,
  ToastProvider,
  TopInsetOwner,
  useColors,
  useStackScreenOptions,
  useSplashHold,
  useThemePreference,
} from "@catera/mobile-ui";
import { runtime } from "../src/runtime";
import { dapurLink } from "../src/links";
import { openLink, sessionChanged } from "../src/nav";
import { SCREEN_TAB, tabsForRole } from "../src/roles";
import { useModalOptions } from "../src/stack";
import { clearCachedDays } from "../src/today/offline";

// The native splash stays up until the phone's own reads are done (fonts, theme, stored session), so the first frame
// already has the right theme, fonts and, when kept, the day. See `Launch`.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** True until the launch cover has played in this JS context; a root that mounts again later (a warm start) skips it. */
let coldStart = true;
/**
 * The scheme the native splash was drawn in: the system's, read before the theme provider hands a stored choice to
 * `Appearance`. The launch cover repeats the splash, so it uses this, not the app's theme.
 */
const splashScheme = Appearance.getColorScheme() === "dark" ? "dark" : "light";

/** Whether the native splash has let go: at once when the phone's reads are done, or at its 1500ms ceiling. */
const SplashReleased = createContext(false);

function Navigation() {
  const { t, ready, booted, demo, actor } = useMobile();
  const released = use(SplashReleased);
  const screenOptions = useStackScreenOptions(demo);
  const palette = useColors();
  const { scheme } = useThemePreference();
  const modal = useModalOptions();
  const allowed = tabsForRole(actor?.role);
  // A link held while the session loads opens once the tabs mount; signed out, it is dropped (`sessionChanged`).
  const session = !ready ? "loading" : actor ? "signedIn" : "signedOut";
  useEffect(() => sessionChanged(session), [session]);
  // The app's default glyphs follow the theme: pushed screens and the launch gate sit on the canvas. A tab root's
  // MoodHeader sets the mood's glyphs over this while its screen is in front. Above the ready gate, so the gate gets
  // them too.
  const statusBar = <StatusBar style={statusBarStyle({ scheme, mood: null, demo })} />;
  // No stored session: the gate waits for the first answer. The mascot shows its words only after 300ms, so a quick
  // answer shows nothing; before the phone's reads finish the canvas is all there is (under the splash). Once the splash
  // has let go at its ceiling the mascot shows even if a read still hangs, so the gate is never a blank canvas.
  if (!ready)
    return (
      <>
        {statusBar}
        <View style={{ flex: 1, backgroundColor: palette.canvas }}>
          {booted || released ? (
            <MascotLoading label={t("Menyiapkan dapur kamu…", "Getting your kitchen ready…")} />
          ) : null}
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
          {/* The confirm and action sheets (`useConfirm`, `useActionSheet`), sized to their content, over any screen. */}
          <Stack.Screen name="konfirmasi" options={sheetOptions({ detents: "fit", palette })} />
          <Stack.Screen name="aksi" options={sheetOptions({ detents: "fit", palette })} />
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

/** Past the splash's ceiling with the fonts still loading: the mascot, its words in the system face. */
function FontWait() {
  const { t } = useMobile();
  return <MascotLoading startup label={t("Menyiapkan dapur kamu…", "Getting your kitchen ready…")} />;
}

/**
 * The launch sequence (spec 3.1, 3.2): holds the native splash until the fonts, the stored theme and the stored session
 * have been read, or 1500ms at most, then on a cold start lays the launch cover over the first screen for one beat.
 */
function Launch({ fontsDone, children }: { fontsDone: boolean; children: ReactNode }) {
  const { booted } = useMobile();
  const { loaded } = useThemePreference();
  const released = useSplashHold(fontsDone && loaded && booted, () => void SplashScreen.hideAsync().catch(() => {}));
  const [cover, setCover] = useState(coldStart);
  useEffect(() => {
    coldStart = false;
  }, []);
  // The app under it learns when the splash let go (the launch gate's mascot); the cover is drawn last, on top.
  return (
    <SplashReleased value={released}>
      {children}
      {cover ? <LaunchCover scheme={splashScheme} hold={!released} onDone={() => setCover(false)} /> : null}
    </SplashReleased>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Every provider mounts at once, so the theme and the session are read while the fonts load. Signing out forgets the
  // kept days, so the next person on this phone never sees them.
  return (
    <SafeAreaProvider>
      <ThemeProvider storageKey={runtime.storageKey("theme")}>
        <MoodProvider>
          <MobileProvider runtime={runtime} linkMapper={dapurLink} openLink={openLink} onSignedOut={clearCachedDays}>
            <Launch fontsDone={fontsLoaded || !!fontError}>
              {fontError ? (
                <FontError />
              ) : !fontsLoaded ? (
                <FontWait />
              ) : (
                <ToastProvider>
                  <NavigationColors>
                    <Navigation />
                  </NavigationColors>
                </ToastProvider>
              )}
            </Launch>
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
