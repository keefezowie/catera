import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMobile } from "@catera/mobile-core";
import { AppHeader, colors, DemoStrip, fontAssets, Text, TopInsetOwner } from "@catera/mobile-ui";
import { runtime } from "../src/runtime";
import { AppProviders } from "../src/shell";

function Navigation() {
  const { t, ready, demo } = useMobile();
  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  return (
    <TopInsetOwner owned={demo}>
      <StatusBar style="dark" />
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
          contentStyle: { backgroundColor: colors.canvas },
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

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);
  if (error)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text>Font tidak dapat dimuat. Mulai ulang aplikasi.</Text>
      </View>
    );
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <AppProviders runtime={runtime}>
        <Navigation />
      </AppProviders>
    </SafeAreaProvider>
  );
}
