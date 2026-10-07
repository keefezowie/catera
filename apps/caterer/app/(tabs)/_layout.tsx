import { Redirect, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { colors, FONT } from "@catera/mobile-ui";
import { tabsForRole, type CatererTab } from "../../src/roles";
import { RoleGate } from "../../src/RoleGate";

const icons: Record<CatererTab, keyof typeof Ionicons.glyphMap> = {
  index: "home-outline",
  pelanggan: "people-outline",
  menu: "book-outline",
  usaha: "storefront-outline",
};

export default function TabsLayout() {
  const { actor, t } = useMobile();
  if (!actor) return <Redirect href="/masuk" />;
  const allowed = tabsForRole(actor.role);
  const titles: Record<CatererTab, string> = {
    index: t("Hari ini", "Today"),
    pelanggan: t("Pelanggan", "Customers"),
    menu: t("Menu", "Menu"),
    usaha: t("Usaha", "Business"),
  };
  return (
    <RoleGate>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.forest,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 64 },
          tabBarLabelStyle: { fontFamily: FONT, fontSize: 12, fontWeight: "700" },
        }}
      >
        {(Object.keys(icons) as CatererTab[]).map((name) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: titles[name],
              href: allowed.includes(name) ? undefined : null,
              tabBarIcon: ({ color, size }) => <Ionicons name={icons[name]} color={color} size={size} />,
            }}
          />
        ))}
      </Tabs>
    </RoleGate>
  );
}
