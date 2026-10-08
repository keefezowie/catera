import { Redirect, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { colors, fonts } from "@catera/mobile-ui";
import { tabsForRole, type CatererTab } from "../../src/roles";
import { RoleGate } from "../../src/RoleGate";

type Glyph = keyof typeof Ionicons.glyphMap;

/** Outline while inactive, filled when focused (same rule as the customer app); content icons stay outline. */
const icons: Record<CatererTab, { filled: Glyph; outline: Glyph }> = {
  index: { filled: "home", outline: "home-outline" },
  pelanggan: { filled: "people", outline: "people-outline" },
  menu: { filled: "book", outline: "book-outline" },
  usaha: { filled: "storefront", outline: "storefront-outline" },
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
          tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.bold },
        }}
      >
        {(Object.keys(icons) as CatererTab[]).map((name) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: titles[name],
              href: allowed.includes(name) ? undefined : null,
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? icons[name].filled : icons[name].outline} color={color} size={size} />
              ),
            }}
          />
        ))}
      </Tabs>
    </RoleGate>
  );
}
