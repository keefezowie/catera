import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { colors, fonts } from "@catera/mobile-ui";

type CustomerTab = "index" | "jadwal" | "jelajah" | "akun";

const icons: Record<CustomerTab, keyof typeof Ionicons.glyphMap> = {
  index: "home",
  jadwal: "calendar",
  jelajah: "search",
  akun: "person",
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
            tabBarIcon: ({ color, size }) => <Ionicons name={icons[name]} color={color} size={size} />,
          }}
        />
      ))}
      {legacy.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
