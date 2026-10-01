import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Image,
  Modal,
  Switch,
  Pressable,
  PanResponder,
  Animated,
  AccessibilityInfo,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  currency,
  mealLabel,
  purchaseCommitment,
  perMealPrice,
  menuSummary,
  areaOptions,
  swipeTarget,
  type Offer,
} from "@catera/domain";
import { useNative, apiBase } from "./context";
import {
  Screen,
  Txt,
  Btn,
  Field,
  Select,
  LanguageSelect,
  Photo,
  OfferCard,
  Empty,
  C,
  styles,
} from "./ui";
import { NativeSaveButton, NativeSavedIntent } from "./saved";

type Filters = {
  search: string;
  meal: string;
  packageType: string;
  trial: boolean;
  flex: boolean;
  diet: boolean;
  max: string;
  sort: string;
};
const defaults: Filters = {
  search: "",
  meal: "all",
  packageType: "all",
  trial: false,
  flex: false,
  diet: false,
  max: "",
  sort: "recommended",
};
function readFilters(params: Record<string, string>): Filters {
  const text = (key: string) =>
    typeof params[key] === "string" ? params[key] : "";
  return {
    ...defaults,
    search: text("search"),
    meal: ["lunch", "dinner", "both"].includes(text("meal"))
      ? text("meal")
      : "all",
    packageType: ["ala_carte", "nasi_box"].includes(text("type"))
      ? text("type")
      : "all",
    trial: text("trial") === "1",
    flex: text("flex") === "1",
    diet: text("plantBased") === "1",
    max: text("max").replace(/[^0-9]/g, ""),
    sort: ["price", "rating"].includes(text("sort"))
      ? text("sort")
      : "recommended",
  };
}
export function NativeDiscover() {
  const params = useLocalSearchParams<Record<string, string>>();
  const {
    offers,
    area,
    setArea,
    compare,
    error,
    ready,
    refresh,
    t,
    locale,
    demo,
  } = useNative();
  const dimensions = useWindowDimensions();
  const [preferred, setPreferred] = useState<"swipe" | "list">("swipe");
  const [fit, setFit] = useState(true),
    [filtersOpen, setFiltersOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => readFilters(params));
  const [activeId, setActiveId] = useState(params.card || "");
  const scroll = useRef<ScrollView>(null),
    sections = useRef({ packages: 0, how: 0 });
  const queryKey = JSON.stringify(readFilters(params));
  useEffect(() => setFilters(readFilters(params)), [queryKey]);
  useEffect(() => setActiveId(params.card || ""), [params.card]);
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () =>
      setSearching(false),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    void SecureStore.getItemAsync("catera.discovery-view")
      .then((value) => {
        if (value === "list") setPreferred("list");
      })
      .catch(() => {});
  }, []);
  useEffect(
    () => setFit(true),
    [dimensions.height, dimensions.width, dimensions.fontScale],
  );
  const requested = params.section === "how-it-works" ? "list" : params.view;
  const mode =
    requested === "swipe" || requested === "list" ? requested : preferred;
  const canSwipe =
    dimensions.width <= 560 &&
    process.env.EXPO_PUBLIC_CATERA_SWIPE_DISCOVERY !== "false";
  const feed =
    canSwipe && dimensions.fontScale <= 1.35 && fit && mode === "swipe";
  function choose(value: "swipe" | "list") {
    setPreferred(value);
    setFit(true);
    void SecureStore.setItemAsync("catera.discovery-view", value).catch(
      () => {},
    );
    router.setParams?.({ view: value, section: undefined });
  }
  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setActiveId("");
    router.setParams?.({
      search: next.search || undefined,
      meal: next.meal === "all" ? undefined : next.meal,
      type: next.packageType === "all" ? undefined : next.packageType,
      trial: next.trial ? "1" : undefined,
      flex: next.flex ? "1" : undefined,
      plantBased: next.diet ? "1" : undefined,
      max: next.max || undefined,
      sort: next.sort === "recommended" ? undefined : next.sort,
      card: undefined,
    });
  }
  const filtered = offers
    .filter(
      (offer) =>
        (filters.meal === "all" || offer.meal === filters.meal) &&
        (filters.packageType === "all" ||
          offer.packageType === filters.packageType) &&
        (!filters.trial || !!offer.trialPrice) &&
        (!filters.flex || offer.flexible) &&
        (!filters.diet || offer.tags.includes("Plant-based")) &&
        (!filters.max || perMealPrice(offer) <= Number(filters.max)) &&
        (!filters.search.trim() ||
          [
            offer.name,
            offer.caterer,
            ...offer.tags,
            ...offer.menus.map((menu) => menuSummary(menu, locale)),
          ]
            .join(" ")
            .toLowerCase()
            .includes(filters.search.trim().toLowerCase())),
    )
    .sort((a, b) =>
      area && a.areas.includes(area) !== b.areas.includes(area)
        ? Number(b.areas.includes(area)) - Number(a.areas.includes(area))
        : filters.sort === "price"
          ? perMealPrice(a) - perMealPrice(b)
          : filters.sort === "rating"
            ? (b.rating || 0) - (a.rating || 0)
            : 0,
    );
  function returnPath(card = activeId) {
    const query = new URLSearchParams({ view: feed ? "swipe" : "list" });
    for (const [key, value] of Object.entries({
      search: filters.search,
      meal: filters.meal,
      type: filters.packageType,
      max: filters.max,
      sort: filters.sort,
      trial: filters.trial ? "1" : "",
      flex: filters.flex ? "1" : "",
      plantBased: filters.diet ? "1" : "",
      card,
    }))
      if (value && value !== "all") query.set(key, value);
    return "/discover?" + query;
  }
  const selectCard = useCallback((id: string) => {
    setActiveId(id);
    router.setParams?.({ card: id });
  }, []);
  async function scrollTo(key: "packages" | "how") {
    choose("list");
    const reduced = await AccessibilityInfo.isReduceMotionEnabled();
    scroll.current?.scrollTo({ y: sections.current[key], animated: !reduced });
  }
  const modes = (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {canSwipe && (
        <>
          <Btn
            secondary={!feed}
            label={t("Geser", "Swipe")}
            onPress={() => choose("swipe")}
          />
          <Btn
            secondary={feed}
            label={t("Daftar", "List")}
            onPress={() => choose("list")}
          />
        </>
      )}
      <View style={{ flex: 1 }}>
        <Btn
          secondary
          label={t("Tersimpan", "Saved")}
          icon="bookmark-outline"
          onPress={() => router.push("/saved")}
        />
      </View>
      <Btn
        secondary
        label={t("Filter", "Filter")}
        icon="options-outline"
        onPress={() => setFiltersOpen(true)}
      />
    </View>
  );
  const areaAndSearch = (
    <View style={feed ? { flexDirection: "row", gap: 8 } : styles.stack}>
      <View style={feed ? { flex: 1 } : {}}>
        <Select
          label={t("Area pengantaran", "Delivery area")}
          value={area}
          onChange={(value) => {
            setArea(value);
            setActiveId("");
            router.setParams?.({ card: undefined });
          }}
          options={[
            { value: "", label: t("Pilih area", "Choose area") },
            ...areaOptions.map((value) => ({ value, label: value })),
          ]}
        />
      </View>
      <View style={feed ? { flex: 1.2 } : {}}>
        <Field
          label={t("Cari makanan favorit", "Find your favorite meals")}
          value={filters.search}
          onFocus={() => {
            if (feed) setSearching(true);
          }}
          onChangeText={(search) => update({ search })}
          placeholder={t("Paket, menu, katerer", "Packages, meals, caterers")}
        />
      </View>
    </View>
  );
  const comparison =
    compare.length > 0 ? (
      <Btn
        label={
          t("Bandingkan ", "Compare ") +
          compare.length +
          t(" paket", " packages")
        }
        onPress={() =>
          router.push(
            ("/compare?next=" + encodeURIComponent(returnPath())) as never,
          )
        }
      />
    ) : null;
  const modal = (
    <Modal
      visible={filtersOpen}
      animationType="none"
      onRequestClose={() => setFiltersOpen(false)}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>
          <Txt kind="title">{t("Filter paket", "Package filters")}</Txt>
          <Select
            label={t("Waktu makan", "Meal time")}
            value={filters.meal}
            onChange={(meal) => update({ meal })}
            options={[
              { value: "all", label: t("Semua paket", "All packages") },
              { value: "lunch", label: t("Makan siang", "Lunch") },
              { value: "dinner", label: t("Makan malam", "Dinner") },
              { value: "both", label: t("Siang + malam", "Lunch + dinner") },
            ]}
          />
          <Select
            label={t("Jenis paket", "Package type")}
            value={filters.packageType}
            onChange={(packageType) => update({ packageType })}
            options={[
              { value: "all", label: t("Semua jenis", "All types") },
              { value: "ala_carte", label: "À la carte" },
              { value: "nasi_box", label: t("Nasi box", "Rice box") },
            ]}
          />
          {(["trial", "flex", "diet"] as const).map((key) => (
            <View
              style={[styles.row, { justifyContent: "space-between" }]}
              key={key}
            >
              <Txt>
                {key === "trial"
                  ? t("Bisa coba dulu", "Trial available")
                  : key === "flex"
                    ? t("Jadwal fleksibel saja", "Flexible packages only")
                    : "Plant-based"}
              </Txt>
              <Switch
                accessibilityLabel={
                  key === "trial"
                    ? t("Trial tersedia", "Trial available")
                    : key === "flex"
                      ? t("Jadwal fleksibel saja", "Flexible packages only")
                      : "Plant-based"
                }
                value={filters[key]}
                onValueChange={(value) => update({ [key]: value })}
                trackColor={{ true: C.forest }}
              />
            </View>
          ))}
          <Field
            label={t("Harga maksimum / sekali makan", "Maximum price / meal")}
            keyboardType="numeric"
            value={filters.max}
            onChangeText={(max) => update({ max: max.replace(/[^0-9]/g, "") })}
          />
          <Select
            label={t("Urutkan", "Sort")}
            value={filters.sort}
            onChange={(sort) => update({ sort })}
            options={[
              { value: "recommended", label: t("Rekomendasi", "Recommended") },
              { value: "price", label: t("Harga terendah", "Lowest price") },
              {
                value: "rating",
                label: t("Rating tertinggi", "Highest rated"),
              },
            ]}
          />
          <Btn
            secondary
            label={t("Hapus filter", "Reset filters")}
            onPress={() => update(defaults)}
          />
          <Btn
            label={t("Lihat paket", "Show packages")}
            onPress={() => setFiltersOpen(false)}
          />
          <Btn
            secondary
            label={t("Tutup", "Close")}
            onPress={() => setFiltersOpen(false)}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
  const empty = (
    <Empty
      title={
        ready
          ? t("Belum ada paket yang cocok.", "No matching packages yet.")
          : t("Memuat paket…", "Loading packages…")
      }
      body={
        ready
          ? t(
              "Coba pencarian atau filter lain.",
              "Try another search or filter.",
            )
          : ""
      }
    />
  );
  if (feed)
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 6, gap: 6 }}>
          {demo && (
            <Txt kind="small" style={styles.demo}>
              {t(
                "Demo sintetis · Tidak ada transaksi uang",
                "Synthetic demo · No money transactions",
              )}
            </Txt>
          )}
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Txt kind="heading" style={{ flex: 1, fontSize: 18 }}>
              {t("Paket katering", "Catering packages")}
            </Txt>
            <LanguageSelect />
          </View>
          {modes}
          {areaAndSearch}
          <NativeSavedIntent />
          {error ? (
            <View accessibilityRole="alert">
              <Txt style={styles.error}>{error}</Txt>
              <Btn
                secondary
                label={t("Coba lagi", "Retry")}
                onPress={() => void refresh()}
              />
            </View>
          ) : null}
          <Txt kind="small">
            {filtered.length} {t("paket ditemukan", "packages found")}
          </Txt>
          {searching ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Btn
                secondary
                label={t("Lihat hasil pencarian", "Show search results")}
                onPress={() => {
                  Keyboard.dismiss();
                  setSearching(false);
                }}
              />
            </View>
          ) : filtered.length ? (
            <NativePackagePager
              offers={filtered}
              activeId={activeId}
              onSelect={selectCard}
              onCannotFit={() => setFit(false)}
              returnPath={returnPath}
            />
          ) : (
            <ScrollView>{empty}</ScrollView>
          )}
          {comparison}
        </View>
        {modal}
      </SafeAreaView>
    );
  return (
    <>
      <Screen refresh={refresh} scrollRef={scroll}>
        <Image
          source={require("../../../packages/brand/assets/wordmark.png")}
          style={{ width: 148, height: 50, alignSelf: "center" }}
          resizeMode="contain"
        />
        <LanguageSelect />
        {canSwipe && mode === "swipe" && (
          <Txt>
            {t(
              "Tampilan daftar digunakan agar semua informasi tetap terbaca.",
              "List view keeps all package information readable on this screen.",
            )}
          </Txt>
        )}
        {modes}
        <View style={styles.row}>
          <Btn
            secondary
            label={t("Jelajah katering", "Explore caterers")}
            onPress={() => void scrollTo("packages")}
          />
          <Btn
            secondary
            label={t("Cara berlangganan", "How it works")}
            onPress={() => void scrollTo("how")}
          />
        </View>
        {areaAndSearch}
        <NativeSavedIntent />
        <View
          style={{
            backgroundColor: C.forest,
            padding: 25,
            borderRadius: 14,
            gap: 16,
          }}
        >
          <Txt
            kind="title"
            style={{ color: C.cream, fontSize: 35, lineHeight: 43 }}
          >
            {t("Makan enak.\nSetiap hari.", "Eat well.\nEvery day.")}
          </Txt>
          <Txt style={{ color: C.cream, fontSize: 12 }}>
            {t(
              "Pilih makanannya, atur jadwalnya, nikmati harinya.",
              "Choose your meals, plan your schedule, enjoy your day.",
            )}
          </Txt>
          <Photo src="/assets/food/ayam-panggang.png" height={190} />
        </View>
        <View
          nativeID="packages"
          onLayout={(event) => {
            sections.current.packages = event.nativeEvent.layout.y;
          }}
        >
          <Txt kind="heading">
            {t("Mau makan apa hari ini?", "What sounds good today?")}
          </Txt>
        </View>
        {error && <Txt style={styles.error}>{error}</Txt>}
        {comparison}
        <Txt kind="small">
          {filtered.length} {t("paket ditemukan", "packages found")}
        </Txt>
        {filtered.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            returnPath={returnPath(offer.id)}
          />
        ))}
        {!filtered.length && empty}
        <View
          nativeID="how-it-works"
          style={styles.stack}
          onLayout={(event) => {
            sections.current.how = event.nativeEvent.layout.y;
            if (params.section === "how-it-works")
              scroll.current?.scrollTo({
                y: sections.current.how,
                animated: false,
              });
          }}
        >
          <Txt kind="heading">{t("Cara berlangganan", "How it works")}</Txt>
          <Txt>
            {t(
              "Pilih katerer dan paket yang menjangkau alamatmu.",
              "Choose a caterer and package that deliver to your address.",
            )}
          </Txt>
          <Txt>
            {t(
              "Tentukan porsi dan tanggal mulai, lalu tinjau jadwal serta harga sebelum membayar.",
              "Set portions and a start date, then review the schedule and price before paying.",
            )}
          </Txt>
          <Txt>
            {t(
              "Pantau pengantaran di Jadwal. Beli paket berikutnya saat kamu siap; tidak ada perpanjangan otomatis.",
              "Track deliveries in Calendar. Buy your next package when ready; there is no automatic renewal.",
            )}
          </Txt>
          <Btn
            label={t("Temukan paketmu", "Find your package")}
            onPress={() => void scrollTo("packages")}
          />
        </View>
      </Screen>
      {modal}
    </>
  );
}
export function NativePackagePager({
  offers,
  activeId,
  onSelect,
  onCannotFit,
  returnPath,
}: {
  offers: Offer[];
  activeId: string;
  onSelect: (id: string) => void;
  onCannotFit: () => void;
  returnPath: (id: string) => string;
}) {
  const { t, locale, area, compare, toggleCompare } = useNative();
  const list = useRef<FlatList<Offer>>(null),
    active = useRef(0),
    origin = useRef(0);
  const alignedHeight = useRef(0);
  const [height, setHeight] = useState(0),
    [index, setIndex] = useState(0),
    [reduced, setReduced] = useState(false);
  const drag = useRef(new Animated.Value(0)).current;
  const ids = offers.map((offer) => offer.id).join(",");
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const next = Math.max(
      0,
      offers.findIndex((offer) => offer.id === activeId),
    );
    if (
      height &&
      (active.current !== next || alignedHeight.current !== height)
    ) {
      list.current?.scrollToIndex({ index: next, animated: false });
      alignedHeight.current = height;
    }
    active.current = next;
    setIndex(next);
  }, [ids, activeId, height]);
  const choose = useCallback(
    (target: number) => {
      const next = Math.max(0, Math.min(offers.length - 1, target));
      if (next === active.current) return;
      active.current = next;
      setIndex(next);
      list.current?.scrollToIndex({ index: next, animated: !reduced });
      onSelect(offers[next].id);
      AccessibilityInfo.announceForAccessibility(
        t(
          `Paket ${next + 1} dari ${offers.length}: ${offers[next].name}`,
          `Package ${next + 1} of ${offers.length}: ${offers[next].name}`,
        ),
      );
    },
    [offers, reduced, onSelect, locale],
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.numberActiveTouches === 1 &&
          Math.abs(gesture.dy) > 12 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          origin.current = active.current;
        },
        onPanResponderMove: (_, gesture) => {
          if (!reduced) drag.setValue(Math.max(-80, Math.min(80, gesture.dy)));
        },
        onPanResponderRelease: (_, gesture) => {
          drag.setValue(0);
          choose(
            swipeTarget(
              origin.current,
              offers.length,
              -gesture.dy,
              -gesture.vy,
            ),
          );
        },
        onPanResponderTerminate: () => drag.setValue(0),
        onPanResponderTerminationRequest: () => true,
      }),
    [choose, reduced, offers.length, drag],
  );
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View
        testID="native-discovery-viewport"
        {...pan.panHandlers}
        style={{
          flex: 1,
          overflow: "hidden",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: C.line,
        }}
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      >
        {height > 0 && (
          <Animated.View style={{ flex: 1, transform: [{ translateY: drag }] }}>
            <FlatList
              ref={list}
              data={offers}
              scrollEnabled={false}
              pagingEnabled
              disableIntervalMomentum
              snapToInterval={height}
              keyExtractor={(offer) => offer.id}
              initialNumToRender={2}
              maxToRenderPerBatch={3}
              windowSize={3}
              getItemLayout={(_, index) => ({
                length: height,
                offset: height * index,
                index,
              })}
              extraData={[index, locale, area, compare]}
              onScrollToIndexFailed={(info) =>
                list.current?.scrollToOffset({
                  offset: height * info.index,
                  animated: false,
                })
              }
              renderItem={({ item: offer, index: itemIndex }) => {
                const commitment = purchaseCommitment({
                  offer,
                  addressCovered: area ? offer.areas.includes(area) : null,
                });
                return (
                  <View
                    testID={"native-discovery-card-" + offer.id}
                    style={{ height, backgroundColor: C.cream }}
                    accessibilityElementsHidden={itemIndex !== index}
                    importantForAccessibility={
                      itemIndex !== index ? "no-hide-descendants" : "auto"
                    }
                  >
                    <NativePackagePhoto offer={offer} />
                    <View
                      style={{ padding: 10, gap: 4 }}
                      onLayout={(event) => {
                        if (
                          itemIndex === active.current &&
                          event.nativeEvent.layout.height + 100 > height
                        )
                          onCannotFit();
                      }}
                    >
                      <Txt
                        kind="small"
                        style={{ fontSize: 12, lineHeight: 16 }}
                      >
                        {offer.caterer}
                      </Txt>
                      <Txt
                        kind="heading"
                        style={{ fontSize: 19, lineHeight: 24 }}
                      >
                        {offer.name}
                      </Txt>
                      <Txt style={{ fontSize: 12, lineHeight: 17 }}>
                        {offer.days} {t("hari pengantaran", "delivery days")} ·{" "}
                        {mealLabel(offer.meal, locale)} ·{" "}
                        {offer.flexible
                          ? t("Fleksibel", "Flexible")
                          : t("Jadwal tetap", "Fixed")}
                      </Txt>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "baseline",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <Txt
                          style={{
                            fontSize: 23,
                            lineHeight: 28,
                            fontWeight: "700",
                            color: C.forest,
                          }}
                        >
                          {currency(commitment.packagePrice, locale)}
                        </Txt>
                        <View style={{ gap: 1 }}>
                          <Txt style={{ fontSize: 12, lineHeight: 17 }}>
                            {t("Paket / 1 porsi", "Package / 1 portion")}
                          </Txt>
                          <Txt
                            style={{
                              fontSize: 12,
                              lineHeight: 17,
                              fontWeight: "700",
                              color: C.forest,
                            }}
                          >
                            {currency(perMealPrice(offer), locale)}{" "}
                            {t("/ sekali makan", "/ meal")}
                          </Txt>
                        </View>
                      </View>
                      <Txt
                        style={{ fontSize: 12, lineHeight: 17, color: C.muted }}
                      >
                        {t(
                          "Pengantaran termasuk. Biaya layanan saat checkout.",
                          "Delivery included. Service fee at checkout.",
                        )}
                      </Txt>
                      <Txt
                        style={{
                          fontSize: 12,
                          lineHeight: 17,
                          color:
                            commitment.addressEligibility === "outside"
                              ? "#A33024"
                              : C.forest,
                        }}
                      >
                        {area
                          ? offer.areas.includes(area)
                            ? t(`Mengantar ke ${area}`, `Delivers to ${area}`)
                            : t(
                                "Di luar area pengantaran",
                                "Outside delivery area",
                              )
                          : t(
                              "Pilih area untuk memeriksa jangkauan.",
                              "Choose an area to check delivery coverage.",
                            )}
                      </Txt>
                      <View
                        style={{ flexDirection: "row", gap: 6, marginTop: 4 }}
                      >
                        <NativeSaveButton
                          compact
                          packageId={offer.id}
                          name={offer.name}
                          returnPath={returnPath(offer.id)}
                        />
                        <Pressable
                          style={[
                            styles.button,
                            styles.secondary,
                            { flex: 1, paddingHorizontal: 4 },
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: compare.includes(offer.id),
                          }}
                          accessibilityLabel={
                            t("Bandingkan: ", "Compare: ") + offer.name
                          }
                          onPress={() => toggleCompare(offer.id)}
                        >
                          <Txt
                            style={{
                              fontSize: 12,
                              lineHeight: 18,
                              fontWeight: "700",
                              color: C.forest,
                            }}
                          >
                            {compare.includes(offer.id)
                              ? t("Dipilih", "Selected")
                              : t("Bandingkan", "Compare")}
                          </Txt>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.button,
                            { flex: 1.25, paddingHorizontal: 4 },
                          ]}
                          accessibilityRole="link"
                          accessibilityLabel={
                            t("Lihat paket: ", "View package: ") + offer.name
                          }
                          onPress={() =>
                            router.push(
                              ("/package/" +
                                offer.id +
                                "?next=" +
                                encodeURIComponent(
                                  returnPath(offer.id),
                                )) as never,
                            )
                          }
                        >
                          <Txt
                            style={{
                              fontSize: 12,
                              lineHeight: 18,
                              fontWeight: "700",
                              color: C.cream,
                            }}
                          >
                            {t("Lihat paket", "View package")}
                          </Txt>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          </Animated.View>
        )}
      </View>
      <View
        style={[styles.row, { justifyContent: "space-between", minHeight: 48 }]}
      >
        <Btn
          secondary
          label={t("Sebelumnya", "Previous")}
          disabled={index === 0}
          onPress={() => choose(active.current - 1)}
        />
        <Txt kind="small">
          {index + 1}/{offers.length}
          {index === offers.length - 1
            ? t(" · Terakhir", " · Last")
            : t(" · Geser ke atas", " · Swipe up")}
        </Txt>
        <Btn
          secondary
          label={t("Berikutnya", "Next")}
          disabled={index === offers.length - 1}
          onPress={() => choose(active.current + 1)}
        />
      </View>
    </View>
  );
}
function NativePackagePhoto({ offer }: { offer: Offer }) {
  const { t } = useNative(),
    [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [offer.image]);
  return failed || !offer.image ? (
    <View
      style={{
        flex: 1,
        minHeight: 100,
        backgroundColor: C.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt kind="small">{t("Foto tidak tersedia", "Photo unavailable")}</Txt>
    </View>
  ) : (
    <Image
      source={{
        uri: offer.image.startsWith("/") ? apiBase + offer.image : offer.image,
      }}
      accessibilityLabel={offer.name}
      style={{ flex: 1, minHeight: 100, maxHeight: "40%", width: "100%" }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}
