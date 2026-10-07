import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MobileProvider, useMobile } from "@catera/mobile-core";
import { colors } from "@catera/mobile-ui";
import { runtime } from "../src/runtime";
import { dapurLink } from "../src/links";

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
          headerTitleStyle: { fontFamily: "Jakarta" },
          contentStyle: { backgroundColor: colors.canvas },
          headerBackTitle: t("Kembali", "Back"),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/masuk" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/daftar" options={{ title: t("Daftar", "Sign up") }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Jakarta: require("../../../packages/brand/assets/fonts/PlusJakartaSans[wght].ttf"),
  });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <MobileProvider runtime={runtime} linkMapper={dapurLink}>
        <Navigation />
      </MobileProvider>
    </SafeAreaProvider>
  );
}
