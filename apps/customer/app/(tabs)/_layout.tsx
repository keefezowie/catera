import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBarLabel, useColors } from "@catera/mobile-ui";

type CustomerTab = "index" | "jadwal" | "jelajah" | "akun";

type Glyph = keyof typeof Ionicons.glyphMap;

/** Outline until focused, filled when focused. Elsewhere, state glyphs (saved heart, selected star, coverage sun and moon) are filled because the fill carries the state; other icons are outline. */
const icons: Record<CustomerTab, { filled: Glyph; outline: Glyph }> = {
  index: { filled: "home", outline: "home-outline" },
  jadwal: { filled: "calendar", outline: "calendar-outline" },
  jelajah: { filled: "search", outline: "search-outline" },
  akun: { filled: "person", outline: "person-outline" },
};

// /discover is still emitted by old links; its stub redirects to Jelajah.
const legacy = ["discover"] as const;

export default function TabsLayout() {
  const { t } = useMobile();
  const palette = useColors();
  const insets = useSafeAreaInsets();
  const titles: Record<CustomerTab, string> = {
    index: t("Beranda", "Home"),
    jadwal: t("Jadwal", "Schedule"),
    jelajah: t("Jelajah", "Explore"),
    akun: t("Akun", "Account"),
  };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.forest,
        tabBarInactiveTintColor: palette.muted,
        // The bar is 64dp plus the bottom inset, which it also pads, so the labels sit above the gesture pill and
        // every item keeps a full 64dp touch area (never under 48dp).
        tabBarStyle: {
          backgroundColor: palette.tabBar,
          borderTopColor: palette.line,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarItemStyle: { minHeight: 48 },
        tabBarLabel: ({ color, children }) => <TabBarLabel color={color}>{children}</TabBarLabel>,
      }}
    >
      {(Object.keys(icons) as CustomerTab[]).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: titles[name],
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? icons[name].filled : icons[name].outline} color={color} size={size} />
            ),
          }}
        />
      ))}
      {legacy.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
