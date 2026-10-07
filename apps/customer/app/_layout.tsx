import { useEffect, useRef, type ReactNode } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MobileProvider, useMobile } from "@catera/mobile-core";
import { colors, FONT, Text } from "@catera/mobile-ui";
import { runtime } from "../src/runtime";
import { customerLink } from "../src/links";
// Old screens (Jadwal, Jelajah, Akun, purchase and payment) still read the old provider
// until Tasks 8–13 replace them; it no longer routes pushes.
import { NativeProvider, useNative } from "../src/context";
import { NativeSavedProvider } from "../src/saved";

/** Keeps the old provider's session in step with MobileProvider while both are mounted. */
function LegacySessionBridge({ children }: { children: ReactNode }) {
  const mobile = useMobile();
  const legacy = useNative();
  const mobileId = mobile.ready ? (mobile.actor?.id ?? "") : null;
  const legacyId = legacy.ready ? (legacy.actor?.id ?? "") : null;
  const seenMobile = useRef<string | null>(null);
  const seenLegacy = useRef<string | null>(null);
  // Each effect fires only when one side's signed-in identity changes (sign-in, logout),
  // then asks the other side to re-read the shared SecureStore session.
  useEffect(() => {
    if (mobileId === null) return;
    const previous = seenMobile.current;
    seenMobile.current = mobileId;
    if (previous !== null && previous !== mobileId && legacyId !== mobileId) void legacy.refresh();
  }, [mobileId]);
  useEffect(() => {
    if (legacyId === null) return;
    const previous = seenLegacy.current;
    seenLegacy.current = legacyId;
    if (previous !== null && previous !== legacyId && mobileId !== legacyId) void mobile.refresh();
  }, [legacyId]);
  return <>{children}</>;
}

function Navigation() {
  const { t, ready } = useMobile();
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
          headerTintColor: colors.forest,
          headerStyle: { backgroundColor: colors.canvas },
          headerTitleStyle: { fontFamily: FONT },
          contentStyle: { backgroundColor: colors.canvas },
          headerBackTitle: t("Kembali", "Back"),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: t("Masuk", "Sign in"), presentation: "modal" }} />
        <Stack.Screen name="register" options={{ title: t("Buat akun", "Create account") }} />
        <Stack.Screen name="recover" options={{ title: t("Pemulihan akun", "Account recovery") }} />
        <Stack.Screen
          name="auth/callback"
          options={{ title: t("Verifikasi akun", "Verify account"), headerBackVisible: false }}
        />
        <Stack.Screen name="subscriptions/[id]/menu" options={{ title: t("Pilih menu", "Choose menus") }} />
        <Stack.Screen name="package/[id]" options={{ title: t("Detail paket", "Package details") }} />
        <Stack.Screen name="checkout/[id]" options={{ title: t("Porsi & jadwal", "Portions & schedule") }} />
        <Stack.Screen name="payment/[id]" options={{ title: t("Pembayaran", "Payment") }} />
        <Stack.Screen name="delivery/[id]" options={{ title: t("Pengantaran", "Delivery") }} />
        <Stack.Screen name="subscriptions/[id]" options={{ title: t("Langganan", "Subscription") }} />
        <Stack.Screen name="support" options={{ title: t("Bantuan", "Support") }} />
        <Stack.Screen name="addresses" options={{ title: t("Alamat", "Addresses") }} />
        <Stack.Screen name="saved" options={{ title: t("Paket tersimpan", "Saved packages") }} />
        <Stack.Screen name="notifications" options={{ title: t("Notifikasi", "Notifications") }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Jakarta: require("../../../packages/brand/assets/fonts/PlusJakartaSans[wght].ttf"),
  });
  if (error)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text>Font tidak dapat dimuat. Mulai ulang aplikasi.</Text>
      </View>
    );
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <NativeProvider routeNotifications={false}>
          <NativeSavedProvider>
            <LegacySessionBridge>
              <Navigation />
            </LegacySessionBridge>
          </NativeSavedProvider>
        </NativeProvider>
      </MobileProvider>
    </SafeAreaProvider>
  );
}
