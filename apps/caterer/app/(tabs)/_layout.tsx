import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { tabBarColors, tabLabelStyle, useColors } from "@catera/mobile-ui";
import { tabsForRole, type CatererTab } from "../../src/roles";
import { RoleGate } from "../../src/RoleGate";

type Glyph = keyof typeof Ionicons.glyphMap;

/** Outline until selected, filled when selected. Elsewhere, state glyphs (saved heart, selected star, coverage sun and moon) are filled because the fill carries the state; other icons are outline. */
const icons: Record<CatererTab, { filled: Glyph; outline: Glyph }> = {
  index: { filled: "home", outline: "home-outline" },
  pelanggan: { filled: "people", outline: "people-outline" },
  menu: { filled: "book", outline: "book-outline" },
  usaha: { filled: "storefront", outline: "storefront-outline" },
};

const order = Object.keys(icons) as CatererTab[];

/**
 * The platform's own tab bar, as in the customer app. Every route stays declared so the navigator keeps one shape;
 * the tabs a role may not open (staff: Pelanggan and Usaha) are hidden triggers.
 */
export default function TabsLayout() {
  const { actor, t } = useMobile();
  const bar = tabBarColors(useColors());
  if (!actor) return <Redirect href="/masuk" />;
  const allowed = tabsForRole(actor.role);
  const label = tabLabelStyle();
  const titles: Record<CatererTab, string> = {
    index: t("Hari ini", "Today"),
    pelanggan: t("Pelanggan", "Customers"),
    menu: t("Menu", "Menu"),
    usaha: t("Usaha", "Business"),
  };
  return (
    <RoleGate>
      <NativeTabs
        labelVisibilityMode="labeled"
        minimizeBehavior="onScrollDown"
        backgroundColor={bar.backgroundColor}
        indicatorColor={bar.indicatorColor}
        rippleColor={bar.rippleColor}
        tintColor={bar.tintColor}
        iconColor={bar.iconColor}
        labelStyle={{
          default: { ...label, color: bar.labelColor.default },
          selected: { ...label, color: bar.labelColor.selected },
        }}
      >
        {order.map((name) => (
          <NativeTabs.Trigger key={name} name={name} hidden={!allowed.includes(name)}>
            <NativeTabs.Trigger.Icon
              src={{
                default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={icons[name].outline} />,
                selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={icons[name].filled} />,
              }}
            />
            <NativeTabs.Trigger.Label>{titles[name]}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </RoleGate>
  );
}
