import { View, Image } from "react-native";
import {
  menuItems,
  menuSourceLabel,
  menuSummary,
  mealLabel,
  packageTypeLabel,
  nutritionSummary,
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
  offer: Pick<Offer, "menus" | "packageType">;
  compact?: boolean;
  presentation?: "default" | "gallery";
  coverImage?: string;
  onMealLayout?: (meal: string, y: number) => void;
}) {
  const { t, locale } = useNative();
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
      {offer.menus.map((m) => (
        <View key={m.meal} style={{ gap: 8 }}>
          <Txt kind="small">
            {mealLabel(m.meal, locale)} ·{" "}
            {menuSourceLabel(m, locale)}
          </Txt>
          {!!m.composition?.length && (
            <Txt>
              {m.composition.map((g) => `${g.slots} ${g.name}`).join(" · ")}
            </Txt>
          )}
          {compact ? (
            <Txt kind="small">{menuSummary(m)}</Txt>
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
                      {m.composition?.find((g) => g.id === i.groupId)?.name}
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
          {(!!nutritionSummary(m.nutrition, locale) || !compact) && (
            <Txt kind="small">
              {nutritionSummary(m.nutrition, locale)
                ? `${nutritionSummary(m.nutrition, locale)}\n${t("Per porsi · estimasi katerer", "Per portion · caterer estimate")}`
                : t("Informasi gizi belum tersedia", "Nutrition unavailable")}
            </Txt>
          )}
        </View>
      ))}
    </View>
  );
}
