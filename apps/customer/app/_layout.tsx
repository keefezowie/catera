import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { View, Text } from "react-native";
import { MascotLoading } from "../src/mascot-loading";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NativeProvider, useNative } from "../src/context";

function Navigation() {
  const { t } = useNative();
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: "#163D2E",
          headerStyle: { backgroundColor: "#FDFAF3" },
          headerTitleStyle: { fontFamily: "Jakarta" },
          contentStyle: { backgroundColor: "#FDFAF3" },
          headerBackTitle: t("Kembali", "Back"),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{ title: t("Masuk", "Sign in"), presentation: "modal" }}
        />
        <Stack.Screen
          name="package/[id]"
          options={{ title: t("Detail paket", "Package details") }}
        />
        <Stack.Screen
          name="checkout/[id]"
          options={{ title: t("Porsi & jadwal", "Portions & schedule") }}
        />
        <Stack.Screen
          name="payment/[id]"
          options={{ title: t("Pembayaran", "Payment") }}
        />
        <Stack.Screen
          name="delivery/[id]"
          options={{ title: t("Pengantaran", "Delivery") }}
        />
        <Stack.Screen
          name="subscriptions/[id]"
          options={{ title: t("Langganan", "Subscription") }}
        />
        <Stack.Screen
          name="support"
          options={{ title: t("Bantuan", "Support") }}
        />
        <Stack.Screen
          name="addresses"
          options={{ title: t("Alamat", "Addresses") }}
        />
        <Stack.Screen
          name="compare"
          options={{ title: t("Bandingkan paket", "Compare packages") }}
        />
        <Stack.Screen
          name="notifications"
          options={{ title: t("Notifikasi", "Notifications") }}
        />
      </Stack>
    </>
  );
}
export default function Layout() {
  const [loaded, error] = useFonts({
    Jakarta: require("../../../packages/brand/assets/fonts/PlusJakartaSans[wght].ttf"),
  });
  if (error)
    return (
      <View>
        <Text>Font tidak dapat dimuat. Mulai ulang aplikasi.</Text>
      </View>
    );
  if (!loaded) return <MascotLoading startup />;
  return (
    <SafeAreaProvider>
      <NativeProvider>
        <Navigation />
      </NativeProvider>
    </SafeAreaProvider>
  );
}
