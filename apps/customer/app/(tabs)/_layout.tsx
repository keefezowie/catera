import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { colors, fonts } from "@catera/mobile-ui";

type CustomerTab = "index" | "jadwal" | "jelajah" | "akun";

type Glyph = keyof typeof Ionicons.glyphMap;

/** Outline while inactive, filled when focused; content icons elsewhere stay outline. */
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
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 64 },
        tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.bold },
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
