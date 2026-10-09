import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { areaOptions, menuSummary, perMealPrice, type Offer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FONT,
  fonts,
  MoodHeader,
  PhotoRing,
  PressableRow,
  PressableScale,
  Screen,
  Sheet,
  Text,
  themedStyles,
  useColors,
  useMood,
  useMoodColors,
} from "@catera/mobile-ui";
import { topTags } from "./categories";
import { FilterChip } from "./FilterChip";
import { PackageCard } from "./PackageCard";
import { type CatalogOffer } from "./format";
import { useSaved } from "./saved";
import { photoUri } from "../today/Plate";

const AREA_KEY = "catera.area";
const BUDGET = 30000;
const CIRCLES = 6;

/** The headline names the meal the mood is on, over two lines like Beranda's. */
function JelajahTitle() {
  const { t } = useMobile();
  const { mood } = useMood();
  const palette = useMoodColors();
  const meal = mood === "siang" ? t("Makan siang", "Lunch") : t("Makan malam", "Dinner");
  return (
    <Text testID="jelajah-title" variant="display" accessibilityRole="header" style={{ color: palette.headerText }}>
      {`${meal}\n${t("minggu depan?", "next week?")}`}
    </Text>
  );
}

/** One of the two 60 point meal buttons: it sets the mood and filters the list to that meal. */
function MealButton({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: "sunny" | "moon";
  selected: boolean;
  onPress: () => void;
}) {
  const palette = useMoodColors();
  const ink = selected ? palette.onToggleActive : palette.headerMeta;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: selected ? palette.toggleActive : palette.toggleTrack,
      }}
    >
      <Ionicons name={icon} size={20} color={ink} />
      <Text variant="label" style={{ color: ink, fontSize: 15 }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Jelajah: choose an area, pick a meal and a category, narrow with two chips, then browse packages as photo rows. */
export function Jelajah() {
  const c = useColors();
  const { t } = useMobile();
  const [area, setArea] = useState<string | null>(null);
  useEffect(() => {
    // The legacy provider reads the same key, so the choice carries over both ways.
    void SecureStore.getItemAsync(AREA_KEY)
      .then((value) => setArea(value || ""))
      .catch(() => setArea(""));
  }, []);
  if (area === null)
    return (
      <Screen
        scroll={false}
        header={
          <MoodHeader
            testID="jelajah-header"
            meta={t("Memuat…", "Loading…")}
            title={<JelajahTitle />}
          />
        }
      >
        <ActivityIndicator color={c.forest} />
      </Screen>
    );
  return (
    <Browse
      area={area}
      onArea={(value) => {
        setArea(value);
        void SecureStore.setItemAsync(AREA_KEY, value).catch(() => {});
      }}
    />
  );
}

function Browse({ area, onArea }: { area: string; onArea: (value: string) => void }) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const palette = useMoodColors();
  const { setMood } = useMood();
  const styles = useStyles();
  const saved = useSaved("/jelajah");
  const [search, setSearch] = useState("");
  const [meal, setMeal] = useState<"" | "lunch" | "dinner">("");
  const [tag, setTag] = useState("");
  const [budget, setBudget] = useState(false);
  const [trial, setTrial] = useState(false);
  const [picking, setPicking] = useState(false);

  // The area goes to the server too, but the list is narrowed here by each package's own areas.
  // Chips and search filter what it returned, so toggling one never refetches or blanks the list.
  const query = new URLSearchParams({ limit: "100", ...(area ? { area } : {}) }).toString();
  const catalog = useData<{ items: Offer[] }>(`jelajah:${query}`, () => runtime.api.catalog("?" + query));

  const needle = search.trim().toLowerCase();
  const all = catalog.data?.items;
  // Only packages that deliver to the chosen area; "Semua area" (no area) shows everything.
  const inArea = useMemo(
    () => ((all ?? []) as CatalogOffer[]).filter((o) => !area || (o.areas ?? []).includes(area)),
    [all, area],
  );
  // The circles are what caterers tagged in the packages shown for this area. A tag that left with an area change
  // no longer filters, so a list never hides behind a circle that is not on screen.
  const tags = useMemo(() => topTags(inArea, CIRCLES), [inArea]);
  const activeTag = tags.some((x) => x.tag === tag) ? tag : "";
  const items = useMemo(
    () =>
      inArea.filter(
        (o) =>
          (!meal || o.meal === meal || o.meal === "both") &&
          (!activeTag || o.tags.includes(activeTag)) &&
          (!budget || perMealPrice(o) <= BUDGET) &&
          (!trial || !!o.trialPrice) &&
          (!needle ||
            [o.name, o.caterer, ...o.tags, ...o.menus.map((m) => menuSummary(m, locale))]
              .join(" ")
              .toLowerCase()
              .includes(needle)),
      ),
    [inArea, meal, activeTag, budget, trial, needle, locale],
  );
  const filtered = !!(needle || meal || activeTag || budget || trial);
  const clear = () => {
    setSearch("");
    setMeal("");
    setTag("");
    setBudget(false);
    setTrial(false);
  };
  // A meal button is both the mood toggle and the meal filter; pressing the chosen one again lifts the filter.
  const pickMeal = (value: "lunch" | "dinner") => {
    setMeal(meal === value ? "" : value);
    setMood(value === "lunch" ? "siang" : "malam");
  };

  return (
    <Screen
      header={
        <MoodHeader
          testID="jelajah-header"
          meta={
            <PressableRow
              accessibilityRole="button"
              accessibilityLabel={t("Pilih area pengantaran", "Choose delivery area")}
              accessibilityValue={{ text: area || t("Belum dipilih", "Not chosen") }}
              onPress={() => setPicking(true)}
              style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="location-outline" size={18} color={palette.headerMeta} />
              <Text variant="label" style={{ flexShrink: 1, fontSize: 15, color: palette.headerMeta }} numberOfLines={1}>
                {area || t("Pilih area", "Choose area")}
              </Text>
              <Ionicons name="chevron-down" size={16} color={palette.headerMeta} />
            </PressableRow>
          }
          trailing={
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t("Paket disimpan", "Saved packages")}
              haptic="tap"
              onPress={() => router.push("/disimpan" as never)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.toggleTrack,
              }}
            >
              <Ionicons name="heart-outline" size={22} color={palette.headerText} />
            </PressableScale>
          }
          title={<JelajahTitle />}
        >
          <View style={{ flexDirection: "row", gap: 10 }}>
            <MealButton label={t("Siang", "Lunch")} icon="sunny" selected={meal === "lunch"} onPress={() => pickMeal("lunch")} />
            <MealButton label={t("Malam", "Dinner")} icon="moon" selected={meal === "dinner"} onPress={() => pickMeal("dinner")} />
          </View>
          <View
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderCurve: "continuous",
              backgroundColor: palette.toggleTrack,
            }}
          >
            <Ionicons name="search-outline" size={20} color={palette.headerMeta} />
            <TextInput
              accessibilityLabel={t("Cari paket", "Search packages")}
              value={search}
              onChangeText={setSearch}
              placeholder={t("Cari ayam bakar, nabati, Bu Rini…", "Search grilled chicken, plant-based, Bu Rini…")}
              placeholderTextColor={palette.headerMeta}
              returnKeyType="search"
              style={{ flex: 1, minHeight: 48, fontFamily: FONT, fontSize: 15, color: palette.headerText }}
            />
          </View>
        </MoodHeader>
      }
    >
      {tags.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circles}>
          {tags.map(({ tag: name, image }) => (
            <PhotoRing
              key={name}
              uri={photoUri(image, runtime.apiBase)}
              size={66}
              ring={name === activeTag ? "sunrise" : "none"}
              label={name}
              selected={name === activeTag}
              onPress={() => setTag(name === activeTag ? "" : name)}
              accessibilityLabel={t(`Kategori ${name}`, `Category ${name}`)}
            />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <FilterChip label={t("Di bawah Rp30.000", "Under Rp30,000")} selected={budget} onPress={() => setBudget(!budget)} />
        <FilterChip label={t("Bisa coba 1 hari", "One-day trial")} selected={trial} onPress={() => setTrial(!trial)} />
      </ScrollView>

      {saved.error ? (
        <Text selectable style={{ color: c.danger }}>
          {saved.error}
        </Text>
      ) : null}

      {catalog.loading && !catalog.data ? (
        <ActivityIndicator color={c.forest} />
      ) : catalog.error && !catalog.data ? (
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: c.danger }}>
            {catalog.error}
          </Text>
          <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void catalog.reload()} />
        </View>
      ) : area && inArea.length === 0 ? (
        <View style={{ gap: 10 }}>
          <Text variant="heading">
            {t(`Belum ada katering yang antar ke ${area}.`, `No caterer delivers to ${area} yet.`)}
          </Text>
          <Button variant="secondary" label={t("Lihat semua area", "See all areas")} onPress={() => onArea("")} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ gap: 10 }}>
          <Text variant="heading">{t("Belum ada paket yang cocok.", "No matching packages yet.")}</Text>
          <Text style={{ color: c.muted }}>
            {t("Coba kata kunci atau pilihan lain.", "Try another keyword or choice.")}
          </Text>
          {filtered ? <Button variant="secondary" label={t("Hapus pilihan", "Clear choices")} onPress={clear} /> : null}
        </View>
      ) : (
        items.map((o) => (
          <PackageCard
            key={o.id}
            layout="row"
            offer={o}
            saved={saved.isSaved(o.id)}
            onOpen={() => router.push(`/paket/${encodeURIComponent(o.id)}` as never)}
            onToggleSaved={() => void saved.toggle(o.id)}
          />
        ))
      )}

      <Sheet
        visible={picking}
        onClose={() => setPicking(false)}
        title={t("Area pengantaran", "Delivery area")}
        closeLabel={t("Tutup", "Close")}
      >
        {["", ...areaOptions].map((value) => (
          <PressableRow
            key={value || "all"}
            accessibilityRole="button"
            accessibilityState={{ selected: value === area }}
            onPress={() => {
              onArea(value);
              setPicking(false);
            }}
            style={styles.option}
          >
            <Text style={{ flex: 1, fontFamily: value === area ? fonts.extrabold : fonts.regular }}>
              {value || t("Semua area", "All areas")}
            </Text>
            {value === area ? <Ionicons name="checkmark" size={20} color={c.forest} /> : null}
          </PressableRow>
        ))}
      </Sheet>
    </Screen>
  );
}

const useStyles = themedStyles(() => ({
  circles: { gap: 8 },
  chips: { gap: 8 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
}));
