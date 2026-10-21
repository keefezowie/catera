import { useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { menuSummary, perMealPrice, type Offer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  FONT,
  MoodHeader,
  PhotoRing,
  PressableRow,
  PressableScale,
  ReadError,
  Screen,
  Skeleton,
  SkeletonGroup,
  StateArt,
  Text,
  themedStyles,
  useColors,
  useMood,
  useMoodIntent,
  useMoodColors,
} from "@catera/mobile-ui";
import { topTags } from "./categories";
import { FilterChip } from "./FilterChip";
import { PackageCard } from "./PackageCard";
import { type CatalogOffer } from "./format";
import { chooseArea, useStoredArea } from "./area";
import { useSaved } from "./saved";
import { photoUri } from "../today/Plate";
import { packageHref } from "../hrefs";
import { JelajahSkeleton } from "../skeletons";

const BUDGET = 30000;
/** An empty or error state's lines sit centred under its mascot. */
const centred = { textAlign: "center" } as const;
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

/** One of the two 60 point meal buttons: a tab of the mood, which is also the meal the list is filtered to. */
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
  const ink = selected ? palette.toggleActive : palette.headerMeta;
  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      // The meal that is already chosen has nothing to confirm.
      haptic={selected ? "none" : "select"}
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
        // Selected: a pill in the card colour with a forest ring and label (direction K).
        backgroundColor: selected ? palette.onToggleActive : palette.toggleTrack,
        borderWidth: 2,
        borderColor: selected ? palette.toggleActive : palette.markerIdle,
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
  // null while the area kept on this phone is read; the page is already up, with its list as a skeleton. The area
  // sheet (`/area`) keeps a new choice through `chooseArea`, which this hears at once.
  const area = useStoredArea();
  return <Browse area={area} onArea={chooseArea} />;
}

function Browse({ area, onArea }: { area: string | null; onArea: (value: string) => void }) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const palette = useMoodColors();
  const { mood, setMood } = useMood();
  const asked = useMoodIntent();
  // The meal buttons are the mood toggle, so the list always follows the mood, wherever it was changed.
  const meal = mood === "siang" ? "lunch" : "dinner";
  const styles = useStyles();
  const saved = useSaved("/jelajah");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [budget, setBudget] = useState(false);
  const [trial, setTrial] = useState(false);

  // The area goes to the server too, but the list is narrowed here by each package's own areas.
  // Chips and search filter what it returned, so toggling one never refetches or blanks the list.
  const query = new URLSearchParams({ limit: "100", ...(area ? { area } : {}) }).toString();
  // The catalog is read once the area is known, so the first read is already for it.
  const catalog = useData<{ items: Offer[] } | null>(area === null ? "jelajah:area" : `jelajah:${query}`, () =>
    area === null ? Promise.resolve(null) : runtime.api.catalog("?" + query),
  );
  // One wait from the first frame to the first list: the area read, then the catalog read, under one skeleton.
  const waiting = area === null || (catalog.loading && !catalog.data);

  const needle = search.trim().toLowerCase();
  const all = catalog.data?.items;
  // Only packages that deliver to the chosen area; "Semua area" (no area) shows everything.
  const inArea = useMemo(
    () => ((all ?? []) as CatalogOffer[]).filter((o) => !area || (o.areas ?? []).includes(area)),
    [all, area],
  );
  const inMeal = useMemo(() => inArea.filter((o) => o.meal === meal || o.meal === "both"), [inArea, meal]);
  // The circles are what caterers tagged in the packages of this area and meal, so none leads to an empty list. A tag
  // that left with an area or meal change no longer filters, so a list never hides behind a circle that is not on screen.
  const tags = useMemo(() => topTags(inMeal, CIRCLES), [inMeal]);
  const activeTag = tags.some((x) => x.tag === tag) ? tag : "";
  const mealWord = mood === "siang" ? "siang" : "malam";
  const mealWordEn = mood === "siang" ? "lunch" : "dinner";
  const items = useMemo(
    () =>
      inMeal.filter(
        (o) =>
          (!activeTag || o.tags.includes(activeTag)) &&
          (!budget || perMealPrice(o) <= BUDGET) &&
          (!trial || !!o.trialPrice) &&
          (!needle ||
            [o.name, o.caterer, ...o.tags, ...o.menus.map((m) => menuSummary(m, locale))]
              .join(" ")
              .toLowerCase()
              .includes(needle)),
      ),
    [inMeal, activeTag, budget, trial, needle, locale],
  );
  // The meal is not a choice that can be cleared: it is the mood, so it is always one of the two.
  const filtered = !!(needle || activeTag || budget || trial);
  const clear = () => {
    setSearch("");
    setTag("");
    setBudget(false);
    setTrial(false);
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
              accessibilityValue={area === null ? undefined : { text: area || t("Belum dipilih", "Not chosen") }}
              onPress={() => router.push("/area" as never)}
              style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="location-outline" size={18} color={palette.headerMeta} />
              {area === null ? (
                // The kept area is still being read (a moment): its place waits rather than saying "Pilih area". It is
                // part of the list's wait, so it breathes with the list's skeleton (mounted in the same commit), and
                // that group names the wait for screen readers.
                <SkeletonGroup>
                  <Skeleton testID="jelajah-area-skeleton" onMood width={96} height={16} />
                </SkeletonGroup>
              ) : (
                <Text variant="label" style={{ flexShrink: 1, fontSize: 15, color: palette.headerMeta }} numberOfLines={1}>
                  {area || t("Pilih area", "Choose area")}
                </Text>
              )}
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
                borderWidth: 1.5,
                borderColor: palette.markerIdle,
              }}
            >
              <Ionicons name="heart-outline" size={22} color={palette.headerText} />
            </PressableScale>
          }
          title={<JelajahTitle />}
        >
          <View accessibilityRole="tablist" accessibilityLabel={t("Waktu makan", "Meal time")} style={{ flexDirection: "row", gap: 10 }}>
            <MealButton label={t("Siang", "Lunch")} icon="sunny" selected={asked === "siang"} onPress={() => setMood("siang")} />
            <MealButton label={t("Malam", "Dinner")} icon="moon" selected={asked === "malam"} onPress={() => setMood("malam")} />
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
              // The field is the card colour, 1.0x off a pale header, so its edge (3:1) is its boundary.
              backgroundColor: palette.toggleTrack,
              borderWidth: 1.5,
              borderColor: palette.markerIdle,
            }}
          >
            <Ionicons name="search-outline" size={20} color={palette.headerMeta} />
            <TextInput
              accessibilityLabel={t("Cari paket", "Search packages")}
              value={search}
              onChangeText={setSearch}
              placeholder={t("Cari menu atau katering…", "Search a dish or caterer…")}
              placeholderTextColor={palette.headerMeta}
              returnKeyType="search"
              style={{ flex: 1, minHeight: 48, fontFamily: FONT, fontSize: 15, color: palette.headerText }}
            />
          </View>
        </MoodHeader>
      }
    >
      {/* The circles, the chips and the list arrive together from one skeleton, as one block. The chips filter what
          the read returned, so before it there is nothing for them to narrow. */}
      <FadeSwap swapKey={waiting ? "loading" : "ready"} style={{ gap: 16 }}>
        {waiting ? (
          <JelajahSkeleton />
        ) : (
          <>
            {tags.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circles}>
                {tags.map(({ tag: name, image }) => (
                  <PhotoRing
                    key={name}
                    uri={photoUri(image, runtime.apiBase)}
                    size={66}
                    ring={name === activeTag ? "selected" : "none"}
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

            {saved.error ? <ReadError message={saved.error} onRetry={() => void saved.reload()} /> : null}

            {/* Each state without packages leads with its mascot, centred above its line: puzzled when the read failed,
                searching when the area, meal, search or chips found nothing. */}
            {catalog.error && !catalog.data ? (
              <ReadError art message={catalog.error} onRetry={() => void catalog.reload()} />
            ) : area && inArea.length === 0 ? (
              <View style={{ gap: 10 }}>
                <StateArt pose="mencari" />
                <Text variant="heading" style={centred}>
                  {t(`Belum ada katering yang antar ke ${area}.`, `No caterer delivers to ${area} yet.`)}
                </Text>
                <Button variant="secondary" label={t("Lihat semua area", "See all areas")} onPress={() => onArea("")} />
              </View>
            ) : inArea.length === 0 ? (
              // Nothing is on offer at all (no area is chosen here), so there is no other meal to send the person to.
              <View style={{ gap: 10 }}>
                <StateArt pose="mencari" />
                <Text variant="heading" style={centred}>
                  {t("Belum ada paket.", "No packages yet.")}
                </Text>
              </View>
            ) : items.length === 0 && !filtered ? (
              // Only the meal is narrowing and the area has packages, so the other meal has some: say which meal is empty
              // and offer the other one.
              <View style={{ gap: 10 }}>
                <StateArt pose="mencari" />
                <Text variant="heading" style={centred}>
                  {area
                    ? t(`Belum ada paket makan ${mealWord} di ${area}.`, `No ${mealWordEn} packages in ${area} yet.`)
                    : t(`Belum ada paket makan ${mealWord}.`, `No ${mealWordEn} packages yet.`)}
                </Text>
                <Button
                  variant="secondary"
                  label={mood === "siang" ? t("Lihat makan malam", "See dinner") : t("Lihat makan siang", "See lunch")}
                  onPress={() => setMood((m) => (m === "siang" ? "malam" : "siang"))}
                />
              </View>
            ) : items.length === 0 ? (
              <View style={{ gap: 10 }}>
                <StateArt pose="mencari" />
                <Text variant="heading" style={centred}>
                  {t("Belum ada paket yang cocok.", "No matching packages yet.")}
                </Text>
                <Text style={[{ color: c.muted }, centred]}>
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
                  onOpen={() => router.push(packageHref(o.id, o.name) as never)}
                  onToggleSaved={() => void saved.toggle(o.id)}
                  canSave={saved.signedIn}
                />
              ))
            )}
          </>
        )}
      </FadeSwap>
    </Screen>
  );
}

const useStyles = themedStyles(() => ({
  circles: { gap: 8 },
  chips: { gap: 8 },
}));
