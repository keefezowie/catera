import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme, useNavigationContainerRef } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Appearance, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMobile } from "@catera/mobile-core";
import {
  contentTitled,
  DemoStrip,
  fontAssets,
  LaunchCover,
  LayoutScaleProvider,
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
  WindowEdge,
} from "@catera/mobile-ui";
import { registerNavigation } from "../src/nav";
import { runtime } from "../src/runtime";
import { AppProviders } from "../src/shell";
import { useFlowOptions } from "../src/stack";

// The native splash stays up until the phone's own reads are done (fonts, theme, stored session), so the first frame
// already has the right theme, fonts and, when kept, content. See `Launch`.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** True until the launch cover has played in this JS context; a root that mounts again later (a warm start) skips it. */
let coldStart = true;
/**
 * The scheme the native splash was drawn in: the system's, read before the theme provider hands a stored choice to
 * `Appearance`. The launch cover repeats the splash, so it uses this, not the app's theme.
 */
const splashScheme = Appearance.getColorScheme() === "dark" ? "dark" : "light";

/** Whether the native splash has lifted: the phone's own reads finished, or the 1500ms ceiling passed first. */
const SplashReleased = createContext(false);

function Navigation() {
  const { t, ready, booted, demo } = useMobile();
  const released = use(SplashReleased);
  const container = useNavigationContainerRef();
  // goToTab and openLink target each navigator by key; a push tapped while the session loads opens once it can.
  useEffect(() => registerNavigation(container), [container]);
  const palette = useColors();
  const { scheme } = useThemePreference();
  const screenOptions = useStackScreenOptions(demo);
  const flow = useFlowOptions();
  // The app's default glyphs follow the theme: pushed screens and the launch gate sit on the canvas. A tab root's
  // MoodHeader sets the mood's glyphs over this while its screen is in front.
  const statusBar = <StatusBar style={statusBarStyle({ scheme, mood: null, demo })} />;
  // No stored session: the gate waits for the first answer. The mascot shows its words only after 300ms, so a quick
  // answer shows nothing; before the phone's reads finish the canvas is all there is (under the splash). Once the
  // splash has lifted the mascot shows even if a read is still out: a stored-session read that hangs past the splash's
  // ceiling must never leave a blank canvas.
  if (!ready)
    return (
      <>
        {statusBar}
        <View style={{ flex: 1, backgroundColor: palette.canvas }}>
          {booted || released ? <MascotLoading label={t("Menyiapkan Catera…", "Getting Catera ready…")} /> : null}
        </View>
      </>
    );
  return (
    <MoodLabelsProvider t={t}>
      <TopInsetOwner owned={demo}>
        {statusBar}
        {demo ? <DemoStrip label={t("Demo (data contoh)", "Demo (sample data)")} /> : null}
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
          {/* Beli's choice sheets (delivery address, start date) and the address and help forms opened over a
              purchase: native sheets in this stack, so the purchase stays underneath and Close returns to it. */}
          <Stack.Screen name="pembelian/alamat-pilih" options={sheetOptions({ detents: "fit", palette })} />
          <Stack.Screen name="pembelian/mulai" options={sheetOptions({ detents: "fit", palette })} />
          <Stack.Screen name="pembelian/alamat-form" options={sheetOptions({ detents: "form", palette })} />
          <Stack.Screen name="pembelian/bantuan-form" options={sheetOptions({ detents: "form", palette })} />
          {/* The forms with fields are sheets in this stack, not in a tab's: a root sheet draws above the tab bar, so
              TalkBack lands on its title and the bar never covers "Kirim laporan" (spec 4.1 fallback). Their URLs are
              unchanged; `openLink` opens the page each sits over first (`sheetParent`): Ada masalah and Ubah hari over
              their Hari, the address and help forms over Alamat and Bantuan, the review over Beranda. */}
          {/* The day opens at three quarters and expands; it covers the tab bar, so its actions are never under it. */}
          <Stack.Screen name="hari/[id]" options={sheetOptions({ detents: "day", palette })} />
          <Stack.Screen name="masalah/[id]" options={sheetOptions({ detents: "form", palette })} />
          {/* The calendar needs the room of the large detent. */}
          <Stack.Screen name="ubah-hari/[id]" options={sheetOptions({ detents: "large", palette })} />
          <Stack.Screen name="ulasan/[id]" options={sheetOptions({ detents: "form", palette })} />
          <Stack.Screen name="alamat-form" options={sheetOptions({ detents: "form", palette })} />
          <Stack.Screen name="bantuan-form" options={sheetOptions({ detents: "form", palette })} />
          <Stack.Screen name="hapus-akun" options={sheetOptions({ detents: "form", palette })} />
          {/* A black story: its own close button replaces the header, and a fade keeps its ground from cutting in. */}
          <Stack.Screen
            name="tomorrow"
            options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }}
          />
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

/** Language is not ready before the fonts, so this one message is plain Indonesian. It sits on the canvas of the active theme. */
function FontError() {
  const palette = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: palette.canvas }}>
      <Text selectable>Huruf aplikasi gagal dimuat. Tutup lalu buka lagi aplikasinya.</Text>
    </View>
  );
}

/** Past the splash's ceiling with the fonts still loading: the mascot, its words in the system face. */
function FontWait() {
  const { t } = useMobile();
  return <MascotLoading startup label={t("Menyiapkan Catera…", "Getting Catera ready…")} />;
}

/**
 * The launch sequence (spec 3.1, 3.2): holds the native splash until the fonts, the stored theme and the stored session
 * have been read, or 1500ms at most, then on a cold start lays the launch cover over the first screen for one beat.
 * It sits above the startup gate, so it is mounted whatever the gate shows. It reports when the splash lifts, so the
 * gate knows the person is now looking at it.
 */
function Launch({ fontsDone, onReleased }: { fontsDone: boolean; onReleased: () => void }) {
  const { booted } = useMobile();
  const { loaded } = useThemePreference();
  const released = useSplashHold(fontsDone && loaded && booted, () => void SplashScreen.hideAsync().catch(() => {}));
  const [cover, setCover] = useState(coldStart);
  useEffect(() => {
    coldStart = false;
  }, []);
  useEffect(() => {
    if (released) onReleased();
  }, [released, onReleased]);
  return cover ? <LaunchCover scheme={splashScheme} hold={!released} onDone={() => setCover(false)} /> : null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);
  const [released, setReleased] = useState(false);
  const markReleased = useCallback(() => setReleased(true), []);
  // Every provider mounts at once, so the theme and the session are read while the fonts load.
  return (
    <SafeAreaProvider>
      <WindowEdge />
      <ThemeProvider storageKey={runtime.storageKey("theme")}>
        <LayoutScaleProvider value="v2">
          <MoodProvider>
            <SplashReleased value={released}>
              <AppProviders
                runtime={runtime}
                overlay={<Launch fontsDone={loaded || !!error} onReleased={markReleased} />}
              >
                {error ? (
                  <FontError />
                ) : !loaded ? (
                  <FontWait />
                ) : (
                  <ToastProvider>
                    <NavigationColors>
                      <Navigation />
                    </NavigationColors>
                  </ToastProvider>
                )}
              </AppProviders>
            </SplashReleased>
          </MoodProvider>
        </LayoutScaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
