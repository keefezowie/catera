import { useEffect, useRef, useState, type RefObject } from "react";
import {
  View,
  Image,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  AccessibilityInfo,
  findNodeHandle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  menuItems,
  mealLabel,
  menuSourceLabel,
  type Offer,
  type Dish,
} from "@catera/domain";
import { useNative, apiBase } from "./context";
import { Txt } from "./ui";
import { colors } from "@catera/design-tokens";
const C = { ...colors, ink: colors.charcoal, soft: colors.sage };
import { NutritionStrip } from "./package-preview";

const uri = (src: string) => (src.startsWith("/") ? apiBase + src : src);
function DishTile({
  dish,
  group,
  duplicate,
  onOpen,
}: {
  dish: Dish;
  group?: string;
  duplicate: boolean;
  onOpen: (dish: Dish, target: RefObject<View | null>) => void;
}) {
  const [failed, setFailed] = useState(false);
  const { t } = useNative();
  const trigger = useRef<View>(null);
  return (
    <View style={{ gap: 8 }}>
      {!!dish.image && !failed && (
        <Pressable
          ref={trigger}
          accessibilityRole="button"
          accessibilityLabel={t("Lihat foto ", "View photo ") + dish.name}
          onPress={() => onOpen(dish, trigger)}
          style={
            duplicate ? { minHeight: 44, justifyContent: "center" } : undefined
          }
        >
          {duplicate ? (
            <Txt style={{ color: C.forest, textDecorationLine: "underline" }}>
              {t("Lihat foto hidangan", "View dish photo")}
            </Txt>
          ) : (
            <Image
              accessibilityLabel={dish.name}
              source={{ uri: uri(dish.image) }}
              style={S.photo}
              onError={() => setFailed(true)}
            />
          )}
        </Pressable>
      )}
      {!!group && <Txt style={S.secondary}>{group}</Txt>}
      <Txt style={{ fontSize: 17, fontWeight: "700" }}>{dish.name}</Txt>
      {!!dish.serving && <Txt style={S.secondary}>{dish.serving}</Txt>}
      {!!dish.description && <Txt>{dish.description}</Txt>}
    </View>
  );
}

export function DishGallery({
  offer,
  coverImage,
  onMealLayout,
}: {
  offer: Pick<Offer, "menus" | "packageType">;
  coverImage?: string;
  onMealLayout?: (meal: string, y: number) => void;
}) {
  const { locale, t } = useNative();
  const { width, fontScale } = useWindowDimensions();
  const [selected, setSelected] = useState<Dish | null>(null);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<RefObject<View | null> | null>(null);
  const focusFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (focusFrame.current != null) cancelAnimationFrame(focusFrame.current);
    },
    [],
  );
  const closeButton = useRef<View>(null);
  const restoreFocus = () => {
    const handle = findNodeHandle(trigger.current?.current || null);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  };
  const close = () => {
    setSelected(null);
    focusFrame.current = requestAnimationFrame(restoreFocus);
  };
  return (
    <View style={{ gap: 28 }}>
      {offer.menus.map((menu) => {
        const dishes = menuItems(menu);
        const columns = width >= 360 && fontScale < 1.3 && dishes.length > 1;
        return (
          <View
            key={menu.meal}
            nativeID={"isi-paket-" + menu.meal}
            style={{ gap: 14 }}
            onLayout={(e) => onMealLayout?.(menu.meal, e.nativeEvent.layout.y)}
          >
            <View style={{ gap: 3 }}>
              <Txt kind="heading">{mealLabel(menu.meal, locale)}</Txt>
              <Txt style={S.secondary}>{menuSourceLabel(menu, locale)}</Txt>
            </View>
            {!!menu.composition?.length && (
              <Txt>
                {menu.composition
                  .map((g) => `${g.slots} ${g.name}`)
                  .join(" · ")}
              </Txt>
            )}
            <View style={S.grid}>
              {dishes.map((dish) => (
                <View
                  key={`${dish.id}:${dish.image}`}
                  style={{ width: columns ? "47%" : "100%" }}
                >
                  <DishTile
                    dish={dish}
                    group={
                      menu.composition?.find((g) => g.id === dish.groupId)?.name
                    }
                    duplicate={
                      dishes.length === 1 &&
                      !!dish.image &&
                      dish.image === coverImage
                    }
                    onOpen={(value, target) => {
                      trigger.current = target;
                      setFailed(false);
                      setSelected(value);
                    }}
                  />
                </View>
              ))}
            </View>
            <NutritionStrip menu={menu} />
          </View>
        );
      })}
      <Modal
        visible={!!selected}
        animationType="fade"
        onRequestClose={close}
        onDismiss={restoreFocus}
        onShow={() => {
          const handle = findNodeHandle(closeButton.current);
          if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 14 }}
            accessibilityViewIsModal
          >
            <Pressable
              ref={closeButton}
              accessibilityRole="button"
              onPress={close}
              style={{
                minHeight: 44,
                justifyContent: "center",
                alignSelf: "flex-end",
              }}
            >
              <Txt>{t("Tutup", "Close")}</Txt>
            </Pressable>
            <Txt kind="heading">{selected?.name}</Txt>
            {!!selected?.serving && <Txt>{selected.serving}</Txt>}
            {selected &&
              (failed ? (
                <Txt>
                  {t(
                    "Foto belum dapat ditampilkan.",
                    "This photo could not be displayed.",
                  )}
                </Txt>
              ) : (
                <Image
                  accessibilityLabel={selected.name}
                  source={{ uri: uri(selected.image) }}
                  resizeMode="contain"
                  style={{ width: "100%", height: width * 1.05 }}
                  onError={() => setFailed(true)}
                />
              ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const S = StyleSheet.create({
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 12 },
  secondary: { fontSize: 13, color: C.muted },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 24,
  },
});
