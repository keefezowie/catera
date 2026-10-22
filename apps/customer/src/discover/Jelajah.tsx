import { useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { menuSummary, perMealPrice, type Offer } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import {
  Button,
  FadeSwap,
  FONT,
  MoodHeader,
  PressableScale,
  ReadError,
  Screen,
  Skeleton,
  SkeletonGroup,
  StateArt,
  Text,
  useColors,
  useMood,
  useMoodColors,
  useScreenMargin,
} from "@catera/mobile-ui";
import { topTags } from "./categories";
import { FilterChip } from "./FilterChip";
import { MealSegment } from "./MealSegment";
import { PackageCard } from "./PackageCard";
import { PackageGrid, useGridCell } from "./PackageGrid";
import { type CatalogOffer } from "./format";
import { chooseArea, useStoredArea } from "./area";
import { useSaved } from "./saved";
import { packageHref } from "../hrefs";
import { JelajahSkeleton } from "../skeletons";

const BUDGET = 30000;
/** An empty or error state's lines sit centred under its mascot. */
const centred = { textAlign: "center" } as const;
/** The category chips after the two filters: the tags caterers used most in this area and meal. */
const CATEGORIES = 6;
/** The room a 34 chip leaves in its 44 tall row, above and below. */
const CHIP_ROW_SLOP = (nativeLayout.control.icon - nativeLayout.control.chip) / 2;

/** The headline names the meal the mood is on, as one question on one line (it wraps only when the text is large). */
function JelajahTitle() {
  const { t } = useMobile();
  const { mood } = useMood();
  const palette = useMoodColors();
  const meal = mood === "siang" ? t("Makan siang", "Lunch") : t("Makan malam", "Dinner");
  return (
    <Text testID="jelajah-title" variant="heroTitle" accessibilityRole="header" style={{ color: palette.headerText }}>
      {`${meal} ${t("minggu depan?", "next week?")}`}
    </Text>
  );
}

/** Jelajah: choose an area, pick a meal, narrow with chips and a category, then browse packages as a two column tile grid. */
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
  // The meal segment is the mood toggle, so the list always follows the mood, wherever it was changed.
  const meal = mood === "siang" ? "lunch" : "dinner";
  const cell = useGridCell();
  const margin = useScreenMargin();
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
  // The category chips are what caterers tagged in the packages of this area and meal, so none leads to an empty list.
  // A tag that left with an area or meal change no longer filters, so a list never hides behind a chip that is not on
  // screen.
  const tags = useMemo(() => topTags(inMeal, CATEGORIES), [inMeal]);
  const activeTag = tags.includes(tag) ? tag : "";
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
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t("Pilih area pengantaran", "Choose delivery area")}
              accessibilityValue={area === null ? undefined : { text: area || t("Belum dipilih", "Not chosen") }}
              haptic="none"
              onPress={() => router.push("/area" as never)}
              // The target is 44 tall and the 34 chip is drawn inside it, so the hit area is the target itself.
              style={{ alignSelf: "flex-start", maxWidth: "100%", minHeight: nativeLayout.control.icon, justifyContent: "center" }}
            >
              <View
                testID="area-chip"
                style={{
                  minHeight: nativeLayout.control.chip,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  borderRadius: nativeLayout.control.chip / 2,
                  borderCurve: "continuous",
                  backgroundColor: palette.toggleTrack,
                  borderWidth: 1.5,
                  borderColor: palette.markerIdle,
                }}
              >
                <Ionicons name="location-outline" size={16} color={palette.headerMeta} />
                {area === null ? (
                  // The kept area is still being read (a moment): its place waits rather than saying "Pilih area". It is
                  // part of the list's wait, so it breathes with the list's skeleton (mounted in the same commit), and
                  // that group names the wait for screen readers.
                  <SkeletonGroup>
                    <Skeleton testID="jelajah-area-skeleton" onMood width={96} height={14} />
                  </SkeletonGroup>
                ) : (
                  <Text variant="label" style={{ flexShrink: 1, fontSize: 13, color: palette.headerMeta }} numberOfLines={1}>
                    {area || t("Pilih area", "Choose area")}
                  </Text>
                )}
                <Ionicons name="chevron-down" size={14} color={palette.headerMeta} />
              </View>
            </PressableScale>
          }
          trailing={
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t("Paket disimpan", "Saved packages")}
              haptic="tap"
              onPress={() => router.push("/disimpan" as never)}
              style={{
                width: nativeLayout.control.icon,
                height: nativeLayout.control.icon,
                borderRadius: nativeLayout.control.icon / 2,
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
          <View
            testID="jelajah-search"
            style={{
              minHeight: nativeLayout.control.search,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 14,
              borderRadius: nativeLayout.control.search / 2,
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
              style={{ flex: 1, minHeight: nativeLayout.control.search, fontFamily: FONT, fontSize: 15, color: palette.headerText }}
            />
          </View>
        </MoodHeader>
      }
    >
      {/* The chips and the grid arrive together from one skeleton, as one block. The chips filter what the read
          returned, so before it there is nothing for them to narrow. */}
      <FadeSwap swapKey={waiting ? "loading" : "ready"} style={{ gap: 16 }}>
        {waiting ? (
          <JelajahSkeleton />
        ) : (
          <>
            {/* One row: the meal, then the two filters, then what caterers tagged. */}
            {/* The row starts at the margin and runs to the right edge of the screen. Its content is 44 tall (the chips are
                34 inside it), so each chip's hit slop sits inside its parent and is real; the negative margin gives
                the 5 above and below back to the layout. */}
            <ScrollView
              testID="chip-row"
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: -CHIP_ROW_SLOP, marginRight: -margin }}
              contentContainerStyle={{
                gap: nativeLayout.space.sm,
                alignItems: "center",
                minHeight: nativeLayout.control.icon,
                paddingRight: margin,
              }}
            >
              <MealSegment />
              <FilterChip label={t("Di bawah Rp30.000", "Under Rp30,000")} selected={budget} onPress={() => setBudget(!budget)} />
              <FilterChip label={t("Bisa coba 1 hari", "One-day trial")} selected={trial} onPress={() => setTrial(!trial)} />
              {tags.map((name) => (
                <FilterChip
                  key={name}
                  label={name}
                  accessibilityLabel={t(`Kategori ${name}`, `Category ${name}`)}
                  selected={name === activeTag}
                  onPress={() => setTag(name === activeTag ? "" : name)}
                />
              ))}
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
                  onPress={() => setMood(mood === "siang" ? "malam" : "siang")}
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
              <PackageGrid>
                {items.map((o) => (
                  <View key={o.id} testID="package-cell" style={cell}>
                    <PackageCard
                      layout="tile"
                      offer={o}
                      saved={saved.isSaved(o.id)}
                      onOpen={() => router.push(packageHref(o.id, o.name) as never)}
                      onToggleSaved={() => void saved.toggle(o.id)}
                      canSave={saved.signedIn}
                    />
                  </View>
                ))}
              </PackageGrid>
            )}
          </>
        )}
      </FadeSwap>
    </Screen>
  );
}
