import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useMobile } from "@catera/mobile-core";
import { tabBarColors, tabLabelStyle, useColors } from "@catera/mobile-ui";

type CustomerTab = "index" | "jadwal" | "jelajah" | "akun";

type Glyph = keyof typeof Ionicons.glyphMap;

/** Outline until selected, filled when selected. Elsewhere, state glyphs (saved heart, selected star, coverage sun and moon) are filled because the fill carries the state; other icons are outline. */
const icons: Record<CustomerTab, { filled: Glyph; outline: Glyph }> = {
  index: { filled: "home", outline: "home-outline" },
  jadwal: { filled: "calendar", outline: "calendar-outline" },
  jelajah: { filled: "search", outline: "search-outline" },
  akun: { filled: "person", outline: "person-outline" },
};

const order = Object.keys(icons) as CustomerTab[];

/**
 * The platform's own tab bar: Material 3 navigation bar on Android (label always shown, filled icon on the indicator
 * pill), the system tab bar on iOS, which on iOS 26 shrinks to the selected tab while a long list scrolls down and
 * returns on scroll up. Colours follow the theme and never the mood. Each trigger is a group, `(jadwal)`, with its own
 * stack (`(index,jadwal,jelajah,akun)/_layout.tsx`), so detail screens push inside the tab and the bar stays.
 */
export default function TabsLayout() {
  const { t } = useMobile();
  const bar = tabBarColors(useColors());
  const label = tabLabelStyle();
  const titles: Record<CustomerTab, string> = {
    index: t("Beranda", "Home"),
    jadwal: t("Jadwal", "Schedule"),
    jelajah: t("Jelajah", "Explore"),
    akun: t("Akun", "Account"),
  };
  return (
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
        <NativeTabs.Trigger key={name} name={`(${name})`}>
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
  );
}
