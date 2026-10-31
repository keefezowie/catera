import { Stack } from "expo-router";
import { sheetOptions, useColors } from "@catera/mobile-ui";

/**
 * First-run onboarding (spec ruling 5): welcome, area (1/2), lauk (2/2), then the loader. Every step draws its own top
 * row, so no header; the loader alone has no swipe back, so it is never swiped away midway.
 */
export default function MulaiLayout() {
  const palette = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="area" />
      <Stack.Screen name="lauk" />
      <Stack.Screen name="mencari" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="area-pilih" options={sheetOptions({ detents: "fit", palette })} />
    </Stack>
  );
}
