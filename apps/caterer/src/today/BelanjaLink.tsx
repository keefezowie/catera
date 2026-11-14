import { View } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { DecorativeIcon, PressableScale, Text, useColors } from "@catera/mobile-ui";
import { belanjaRange, weekRange } from "./belanja";
import { ACTION } from "./rows";
import { belanjaHref } from "../hrefs";
import { pushScreen } from "../nav";

/**
 * The way into Belanja 7 hari from the "Daftar masak" heading: the basket and "Belanja", a 48 target. Its screen-reader
 * name keeps the full title and the range it covers (today and the six days after), as the card it replaces had.
 */
export function BelanjaLink() {
  const { t, locale } = useMobile();
  const c = useColors();
  const range = weekRange(belanjaRange(new Date()), locale);
  const label = `${t("Belanja 7 hari", "Shopping, 7 days")}, ${t(`Porsi per menu, ${range}`, `Portions per dish, ${range}`)}`;
  return (
    <PressableScale
      testID="belanja-link"
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="tap"
      onPress={() => pushScreen(belanjaHref())}
      style={{ minHeight: ACTION, minWidth: ACTION, flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 4 }}
    >
      {/* forest: action */}
      <DecorativeIcon name="basket-outline" size={20} color={c.forest} />
      <View>
        <Text variant="bodyStrong" style={{ color: c.forest }}>
          {t("Belanja", "Shopping")}
        </Text>
      </View>
    </PressableScale>
  );
}
