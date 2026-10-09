import { Redirect, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBarLabel, useColors } from "@catera/mobile-ui";
import { tabsForRole, type CatererTab } from "../../src/roles";
import { RoleGate } from "../../src/RoleGate";

type Glyph = keyof typeof Ionicons.glyphMap;

/** Outline until focused, filled when focused. Elsewhere, state glyphs (saved heart, selected star, coverage sun and moon) are filled because the fill carries the state; other icons are outline. */
const icons: Record<CatererTab, { filled: Glyph; outline: Glyph }> = {
  index: { filled: "home", outline: "home-outline" },
  pelanggan: { filled: "people", outline: "people-outline" },
  menu: { filled: "book", outline: "book-outline" },
  usaha: { filled: "storefront", outline: "storefront-outline" },
};

export default function TabsLayout() {
  const { actor, t } = useMobile();
  const palette = useColors();
  const insets = useSafeAreaInsets();
  if (!actor) return <Redirect href="/masuk" />;
  const allowed = tabsForRole(actor.role);
  const titles: Record<CatererTab, string> = {
    index: t("Hari ini", "Today"),
    pelanggan: t("Pelanggan", "Customers"),
    menu: t("Menu", "Menu"),
    usaha: t("Usaha", "Business"),
  };
  const order = (Object.keys(icons) as CatererTab[]).filter((name) => allowed.includes(name));
  // A function tabBarLabel replaces the label the bar would speak ("title, tab, 1 of 4" on iOS), so each tab sets it.
  const spoken = (name: CatererTab) =>
    t(
      `${titles[name]}, tab, ${order.indexOf(name) + 1} dari ${order.length}`,
      `${titles[name]}, tab, ${order.indexOf(name) + 1} of ${order.length}`,
    );
  return (
    <RoleGate>
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
        {(Object.keys(icons) as CatererTab[]).map((name) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: titles[name],
              tabBarAccessibilityLabel: spoken(name),
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
