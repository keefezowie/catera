import { useEffect } from "react";
import { Redirect, useNavigationContainerRef } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { tabBarColors, tabLabelStyle, useColors } from "@catera/mobile-ui";
import { registerNavigation, releaseNavigation } from "../../src/nav";
import { CATERER_TABS, tabsForRole, type CatererTab } from "../../src/roles";
import { RoleGate } from "../../src/RoleGate";

type Glyph = keyof typeof Ionicons.glyphMap;

/** Outline until selected, filled when selected. Elsewhere, state glyphs (saved heart, selected star, coverage sun and moon) are filled because the fill carries the state; other icons are outline. */
const icons: Record<CatererTab, { filled: Glyph; outline: Glyph }> = {
  index: { filled: "home", outline: "home-outline" },
  pelanggan: { filled: "people", outline: "people-outline" },
  menu: { filled: "book", outline: "book-outline" },
  usaha: { filled: "storefront", outline: "storefront-outline" },
};

/**
 * The platform's own tab bar, as in the customer app. Every route stays declared so the navigator keeps one shape;
 * the tabs a role may not open (staff: Pelanggan and Usaha) are hidden triggers. Each trigger is a group, `(menu)`, with
 * its own stack (`(index,pelanggan,menu,usaha)/_layout.tsx`), so detail screens push inside the tab and the bar stays.
 */
export default function TabsLayout() {
  const { actor, t } = useMobile();
  const navigation = useNavigationContainerRef();
  // goToTab selects a tab by targeting these navigators by key, so it needs the container once the tabs exist; a push
  // tap that arrived while the session loaded opens then. Unmounting or changing account forgets it again.
  const account = actor?.id;
  useEffect(() => {
    if (!account) return;
    registerNavigation(navigation);
    return releaseNavigation;
  }, [navigation, account]);
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
        {CATERER_TABS.map((name) => (
          <NativeTabs.Trigger key={name} name={`(${name})`} hidden={!allowed.includes(name)}>
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
