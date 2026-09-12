import { View, Image } from "react-native";
import {
  compositionPreview,
  componentLabel,
  menuItems,
  menuSourceLabel,
  menuSummary,
  mealLabel,
  packageTypeLabel,
  nutritionSummary,
  packageNutrition,
  type Offer,
} from "@catera/domain";
import { useNative, apiBase } from "./context";
import { Txt } from "./ui";
import { DishGallery } from "./dish-gallery";
export function PackageContents({
  offer,
  compact = false,
  presentation = "default",
  coverImage,
  onMealLayout,
}: {
  offer: Pick<Offer, "menus" | "packageType" | "nutrition">;
  compact?: boolean;
  presentation?: "default" | "gallery";
  coverImage?: string;
  onMealLayout?: (meal: string, y: number) => void;
}) {
  const { t, locale } = useNative();
  const nutrition = packageNutrition(offer);
  if (presentation === "gallery")
    return (
      <DishGallery
        offer={offer}
        coverImage={coverImage}
        onMealLayout={onMealLayout}
      />
    );
  return (
    <View style={{ gap: 12 }}>
      <Txt kind="small">{packageTypeLabel(offer.packageType, locale)}</Txt>
      {(!!nutritionSummary(nutrition, locale) || !compact) && (
        <Txt kind="small">
          {nutritionSummary(nutrition, locale)
            ? `${nutritionSummary(nutrition, locale)}\n${t("Per porsi makan · estimasi katerer", "Per meal portion · caterer estimate")}`
            : t("Informasi gizi belum tersedia", "Nutrition unavailable")}
        </Txt>
      )}
      {offer.menus.map((m) => (
        <View key={m.meal} style={{ gap: 8 }}>
          <Txt kind="small">
            {mealLabel(m.meal, locale)} · {menuSourceLabel(m, locale)}
          </Txt>
          {!!m.composition?.length && (
            <Txt>{compositionPreview(m, offer.packageType, locale)}</Txt>
          )}
          {compact ? (
            <Txt kind="small">{menuSummary(m, locale)}</Txt>
          ) : (
            menuItems(m).map((i) => (
              <View key={i.id} style={{ flexDirection: "row", gap: 12 }}>
                {!!i.image && (
                  <Image
                    source={{
                      uri: i.image.startsWith("/")
                        ? apiBase + i.image
                        : i.image,
                    }}
                    style={{ width: 64, height: 64, borderRadius: 9 }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  {!!i.groupId && (
                    <Txt kind="small">
                      {(() => {
                        const group = m.composition?.find(
                          (g) => g.id === i.groupId,
                        );
                        return group ? componentLabel(group, locale) : null;
                      })()}
                    </Txt>
                  )}
                  <Txt>
                    {i.name}
                    {i.serving ? ` · ${i.serving}` : ""}
                  </Txt>
                  {!!i.description && <Txt kind="small">{i.description}</Txt>}
                </View>
              </View>
            ))
          )}
        </View>
      ))}
    </View>
  );
}
