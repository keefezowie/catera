import {
  View,
  Pressable,
  Text,
  StyleSheet,
  type TextProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  compositionPreview,
  nutritionMetrics,
  menuSourceLabel,
  type MealMenu,
  type Offer,
} from "@catera/domain";
import { useNative } from "./context";
import { colors } from "@catera/design-tokens";
const C = { ...colors, ink: colors.charcoal, soft: colors.sage };

function PreviewText(props: TextProps) {
  return (
    <Text
      {...props}
      style={[
        { fontFamily: "Jakarta", color: C.ink, lineHeight: 23 },
        props.style,
      ]}
    />
  );
}

const icons = [
  "flame-outline",
  "barbell-outline",
  "nutrition-outline",
  "water-outline",
] as const;
export function NutritionStrip({ menu }: { menu: MealMenu }) {
  const { locale, t } = useNative();
  const metrics = nutritionMetrics(menu.nutrition, locale);
  if (!metrics.length) return null;
  return (
    <View style={{ gap: 9, marginTop: 12 }}>
      <View style={S.metrics}>
        {metrics.map((metric, i) => (
          <View
            key={metric.key}
            accessible
            accessibilityLabel={
              metric.label +
              ": " +
              (metric.available
                ? metric.value
                : t("Belum tersedia", "Unavailable"))
            }
            style={{ flex: 1, minWidth: 0, gap: 4 }}
          >
            <Ionicons
              name={icons[i]}
              size={17}
              color={C.forest}
              accessible={false}
            />
            <PreviewText
              style={{ fontSize: 11, lineHeight: 17, color: C.muted }}
            >
              {metric.label}
            </PreviewText>
            <PreviewText
              style={{ fontSize: 13, lineHeight: 19, fontWeight: "700" }}
            >
              {metric.value}
            </PreviewText>
          </View>
        ))}
      </View>
      <PreviewText style={{ fontSize: 11, lineHeight: 17, color: C.muted }}>
        {t(
          "Estimasi katerer · per porsi makan",
          "Caterer estimate · per meal portion",
        )}
      </PreviewText>
    </View>
  );
}

export function PackagePreview({
  offer,
  meal,
  onMealChange,
}: {
  offer: Offer;
  meal: string;
  onMealChange: (value: string) => void;
}) {
  const { t, locale } = useNative();
  const menu = offer.menus.find((m) => m.meal === meal) || offer.menus[0];
  if (!menu) return null;
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {offer.meal === "both" && (
          <View style={S.switch}>
            {["lunch", "dinner"].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{
                  selected: menu.meal === value,
                  disabled: !offer.menus.some((m) => m.meal === value),
                }}
                disabled={!offer.menus.some((m) => m.meal === value)}
                onPress={() => onMealChange(value)}
                style={[
                  S.meal,
                  menu.meal === value && { backgroundColor: C.forest },
                ]}
              >
                <PreviewText
                  style={{
                    fontSize: 12,
                    color: menu.meal === value ? C.cream : C.forest,
                  }}
                >
                  {value === "lunch"
                    ? t("Siang", "Lunch")
                    : t("Malam", "Dinner")}
                </PreviewText>
              </Pressable>
            ))}
          </View>
        )}
        <PreviewText style={{ fontSize: 12, color: C.muted }}>
          {menuSourceLabel(menu, locale)}
        </PreviewText>
      </View>
      <Text
        numberOfLines={2}
        style={{
          fontFamily: "Jakarta",
          fontSize: 14,
          lineHeight: 22,
          color: C.ink,
        }}
      >
        {compositionPreview(menu, offer.packageType, locale)}
      </Text>
      <Pressable
        accessibilityRole="link"
        style={{
          minHeight: 44,
          justifyContent: "center",
          alignSelf: "flex-start",
        }}
        onPress={() =>
          router.push({
            pathname: "/package/[id]",
            params: { id: offer.id, section: "contents", meal: menu.meal },
          } as never)
        }
      >
        <PreviewText
          style={{
            color: C.forest,
            fontSize: 13,
            textDecorationLine: "underline",
          }}
        >
          {t("Lihat isi paket", "See included dishes")}
        </PreviewText>
      </Pressable>
      <NutritionStrip menu={menu} />
    </View>
  );
}
const S = StyleSheet.create({
  metrics: { flexDirection: "row", gap: 8 },
  switch: {
    flexDirection: "row",
    gap: 2,
    padding: 3,
    backgroundColor: C.soft,
    borderRadius: 9,
  },
  meal: {
    paddingHorizontal: 13,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 6,
  },
});
