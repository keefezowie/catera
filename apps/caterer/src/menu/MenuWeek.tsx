import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, Share, useWindowDimensions, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  addDays,
  componentLabel,
  errorLabel,
  jakartaDay,
  mealLabel,
  menuCoverImage,
  menuShareText,
  shortDate,
  type Dish,
  type MealMenu,
  type MenuMonth,
  type SellerOffer,
} from "@catera/domain";
import { plural, useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import {
  Button,
  Chip,
  COMPACT_MEDIA_INSET,
  DecorativeIcon,
  FadeSwap,
  fontFor,
  FormError,
  ListCard,
  MediaRow,
  MoodHeader,
  MoodToggle,
  PressableScale,
  Screen,
  SectionHeader,
  StoryCover,
  Text,
  Thumb,
  useBusy,
  useColors,
  useMood,
  useMoodColors,
  useScreenMargin,
} from "@catera/mobile-ui";
import { copyWeekBatches, mealOf, saveMenuDay, weekdayShort, weekDates, weekRange } from "./logic";
import { uploadPhoto } from "../business/upload";
import { photoUri } from "../photo";
import { ReadError } from "../ReadError";
import { MenuControlsSkeleton, MenuStripSkeleton, MenuWeekSkeleton } from "../skeletons";
import { SettingsGear } from "../settings/Pengaturan";

export { mealOf } from "./logic";

export type MenuDay = { date: string; version: number; editable: boolean; details: MealMenu | null };

/** Saved menus for the given dates, across however many months they span. */
export async function loadMenus(
  runtime: MobileRuntime,
  offer: SellerOffer,
  meal: string,
  dates: string[],
): Promise<MenuDay[]> {
  // The API takes the first day of the month (YYYY-MM-01).
  const months = [...new Set(dates.map((d) => `${d.slice(0, 7)}-01`))];
  const results = await Promise.all(
    months.map((m) => runtime.api.menuMonth(offer.id, offer.contentRevision ?? 0, m, meal)),
  );
  const byDate = new Map<string, MenuMonth["dates"][number]>();
  for (const r of results) for (const d of r.dates) byDate.set(d.date, d);
  return dates.map((date) => {
    const found = byDate.get(date);
    return { date, version: found?.version ?? 0, editable: found?.editable ?? false, details: found?.details ?? null };
  });
}

/**
 * The Menu header when there is no week to show (no packages yet, or a failed read): the screen keeps its mood block.
 * The first read draws the loaded header itself, its day strip as blocks.
 */
function MenuTitle() {
  const { t, actor } = useMobile();
  const m = useMoodColors();
  // Short and fixed, and the loaded header sets its week range in heroTitle, so this one matches it.
  // A helper (staff) has no Usaha, so Menu's header carries the way to Pengaturan; an owner finds it on Usaha.
  return (
    <MoodHeader
      title={
        <Text variant="heroTitle" style={{ color: m.headerText }}>
          {t("Menu", "Menu")}
        </Text>
      }
      trailing={actor?.role === "staff" ? <SettingsGear /> : undefined}
    />
  );
}

/** A failed menu read: say so plainly and offer a retry, never an empty week or endless loading. */
export function MenuLoadError({ onRetry, title = true }: { onRetry: () => void; title?: boolean }) {
  const { t } = useMobile();
  return (
    <Screen header={title ? <MenuTitle /> : undefined}>
      <ReadError art message={t("Menu belum bisa dimuat.", "The menu couldn't be loaded.")} onRetry={onRetry} />
    </Screen>
  );
}

/** The strip's gap between day tiles; the tiles share the row's width evenly after it. */
const STRIP_GAP = 4;
/** A day tile's height in the strip (its weekday over its date); the strip's skeleton holds the same. */
const DAY_HEIGHT = 56;
/** The package chips' frame: a 34 chip with its 48 target (hitSlop 7) must not be clipped by the scroller. */
const CHIP_FRAME = 48;
/** The Siang / Malam frame under the week range. */
const MEAL_FRAME = 48;
/** The customer story cover's width on the day's page (the board draws 160 by 200). */
const COVER_WIDTH = 160;
/** The photo tile: the dish thumb's size in a compact row. */
const THUMB = nativeLayout.thumb.compact;

/**
 * One dish in the day's list: a 64 compact media row with its photo in a 48 thumb, or a dashed not-set tile with the
 * camera glyph. For the owner the tile is the "Tambah foto" action (a 48 target); for a helper, and on a day that can no
 * longer change, it is inert. While a photo is on its way the same tile shows the spinner and the row's meta line says so.
 */
function DishRow({
  dish,
  canAddPhoto,
  uploading,
  busy,
  onAdd,
}: {
  dish: Dish;
  canAddPhoto: boolean;
  uploading: boolean;
  busy: boolean;
  onAdd: () => void;
}) {
  const { runtime, t } = useMobile();
  const c = useColors();
  const tile = {
    width: THUMB,
    height: THUMB,
    borderRadius: nativeLayout.radius.thumb,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  } as const;
  const dashed = { ...tile, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.controlRing } as const;
  let leading: ReactNode;
  if (dish.image) {
    leading = <Thumb testID={`menu-dish-photo-${dish.id}`} size={THUMB} uri={photoUri(dish.image, runtime.apiBase)} />;
  } else if (canAddPhoto || uploading) {
    // A photo is on its way (uploading, or saved and waiting for the fresh week): not the empty "no photo" tile.
    leading = (
      <PressableScale
        testID={uploading ? `menu-photo-pending-${dish.id}` : `menu-photo-tile-${dish.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${t("Tambah foto", "Add photo")}, ${dish.name}`}
        accessibilityState={{ disabled: busy, busy: uploading }}
        disabled={busy}
        haptic="tap"
        onPress={onAdd}
        style={[uploading ? { ...tile, backgroundColor: c.sage } : dashed, { opacity: busy && !uploading ? 0.45 : 1 }]}
      >
        {/* The loading state per DESIGN.md: a spinner where the glyph was. The small system spinner (about 20dp) sits
            inside the 48dp tile, so the row keeps its height. `busy` carries the meaning for screen readers, so the
            spinner is hidden from them. */}
        {uploading ? (
          <ActivityIndicator
            testID={`menu-photo-spinner-${dish.id}`}
            size="small"
            color={c.forest}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : (
          <DecorativeIcon name="camera-outline" size={20} color={c.muted} />
        )}
      </PressableScale>
    );
  } else {
    leading = (
      <View
        testID={`menu-photo-tile-${dish.id}`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={dashed}
      >
        <DecorativeIcon name="camera-outline" size={20} color={c.muted} />
      </View>
    );
  }
  return (
    <MediaRow
      testID={`menu-dish-${dish.id}`}
      size="compact"
      titleVariant="bodyStrong"
      leading={leading}
      title={dish.name}
      meta={uploading ? t("Mengunggah…", "Uploading…") : dish.serving || undefined}
    />
  );
}

/** Menu: this week's dishes per delivery day for one package. */
export function MenuWeek() {
  const { runtime, actor, demo, t, locale, command } = useMobile();
  const c = useColors();
  const m = useMoodColors();
  const { mood } = useMood();
  const { width: windowWidth } = useWindowDimensions();
  const margin = useScreenMargin();
  const catererId = actor?.catererId ?? "";
  const canEdit = actor?.role === "owner";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const offers = (ops.data?.offers ?? []).filter((o) => o.status === "published");
  const [packageId, setPackageId] = useState("");
  const [week, setWeek] = useState(0);
  const [picked, setPicked] = useState("");
  const offer = offers.find((o) => o.id === packageId) ?? offers[0];
  // The mood picks the meal for a package that serves both; a single-meal package keeps its own, whatever the mood.
  const meal = offer && offer.meal !== "both" ? offer.meal : mood === "siang" ? "lunch" : "dinner";
  const today = jakartaDay(new Date());
  const dates = offer ? weekDates(addDays(today, week * 7), offer.weekdays) : [];
  const days = useData(`menu-week:${offer?.id}:${meal}:${dates[0]}`, () =>
    offer ? loadMenus(runtime, offer, meal, dates) : Promise.resolve([]),
  );
  // Last week is what "Salin minggu lalu" copies from: read it up front so the button can say when there is nothing.
  // Same key and loader as the week view, so stepping back a week reuses this read.
  const lastWeekDates = dates.map((d) => addDays(d, -7));
  const previous = useData(`menu-week:${offer?.id}:${meal}:${lastWeekDates[0]}`, () =>
    offer ? loadMenus(runtime, offer, meal, lastWeekDates) : Promise.resolve([]),
  );
  // A message and a number that rises with every failure, so an identical failure is announced again.
  const [errorState, setErrorState] = useState({ message: "", key: 0 });
  const error = errorState.message;
  const setError = (message: string) => setErrorState((s) => ({ message, key: message ? s.key + 1 : s.key }));
  const [note, setNote] = useState("");
  // The dish whose photo is uploading. Dish ids are slot ids that repeat on every day, so the day (and package and
  // meal) are kept with it: another day's dish in the same slot is not the one being uploaded.
  const [uploadingDish, setUploadingDish] = useState<{ key: string; date: string; dishId: string } | null>(null);
  const [photoErrorState, setPhotoErrorState] = useState({ message: "", key: 0 });
  const photoError = photoErrorState.message;
  const setPhotoError = (message: string) => setPhotoErrorState((s) => ({ message, key: message ? s.key + 1 : s.key }));
  // One photo at a time, from the tap until the reloaded menu has landed. The ref stops a double tap before a re-render.
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoBusyRef = useRef(false);
  // A saved photo is not done until the week that was read afterwards carries it; until then no pill is offered.
  // `started` turns true once a read has begun after the save, so a failure from before it cannot end the wait.
  const [awaiting, setAwaiting] = useState<{
    key: string;
    date: string;
    dishId: string;
    url: string;
    version: number;
    started: boolean;
  } | null>(null);
  // The newest read of the week, so a save made after a slow picker uses the day's current version, not the tapped one.
  const latestDays = useRef(new Map<string, MenuDay>());
  // The strip lays itself out from the width it is given; until it is measured, the window stands in.
  const [stripWidth, setStripWidth] = useState(Math.min(windowWidth, 760) - 2 * margin);
  const template = offer ? mealOf(offer, meal) : undefined;
  // Copying and sharing both act on the visible week, so they wait for it and for something in it.
  const weekLoaded = !!days.data;
  const hasMenu = (days.data ?? []).some((d) => d.details?.items?.length);
  const lastWeekEmpty = !!previous.data && !previous.data.some((d) => d.details?.items?.length);
  // A failed read of last week does not block copying: the copy reads it again and reports its own error.
  const lastWeekPending = !previous.data && !previous.error;
  const copyNote = (copied: number, skipped: number) =>
    skipped
      ? t(`${copied} hari disalin · ${skipped} dilewati karena sudah lewat atau sudah diisi`, `${plural(copied, "day")} copied · ${skipped} skipped (past or already filled)`)
      : t(`${copied} hari disalin`, `${plural(copied, "day")} copied`);

  // The day on the card: the one tapped, else today, else the next delivery day of the week.
  const selectedDate = dates.includes(picked) ? picked : (dates.find((d) => d >= today) ?? dates[0] ?? "");
  const byDate = new Map((days.data ?? []).map((d) => [d.date, d] as const));
  latestDays.current = byDate;
  const selected = byDate.get(selectedDate);
  // The fresh week has landed once the saved dish carries the photo, or the day's version has moved on. A failed
  // read, or leaving that day, stops the wait so the pills can never stay off.
  const saved = awaiting && awaiting.key === `${offer?.id}:${meal}` && dates.includes(awaiting.date) ? byDate.get(awaiting.date) : undefined;
  const reflected =
    !!awaiting &&
    !!saved &&
    (saved.version > awaiting.version || saved.details?.items?.find((i) => i.id === awaiting.dishId)?.image === awaiting.url);
  const readFailed = !!awaiting?.started && !!days.error && !days.loading;
  const waitingForWeek = !!awaiting && !reflected && !!saved && !readFailed;
  useEffect(() => {
    if (awaiting && !waitingForWeek) setAwaiting(null);
    else if (awaiting && !awaiting.started && days.loading) setAwaiting({ ...awaiting, started: true });
  }, [awaiting, waitingForWeek, days.loading]);

  const [busy, copyLastWeek] = useBusy(async () => {
    if (!offer) return;
    setError("");
    setNote("");
    try {
      const source = previous.data ?? (await loadMenus(runtime, offer, meal, lastWeekDates));
      const filled = source.filter((d) => d.details?.items?.length) as { date: string; details: MealMenu }[];
      const targets = new Map(
        (days.data ?? []).map((d) => [d.date, { version: d.version, editable: d.editable, filled: !!d.details?.items?.length }] as const),
      );
      const { batches, skipped } = copyWeekBatches(filled, targets);
      let copied = 0;
      for (const batch of batches) {
        await command("menu.saveBatch", {
          catererId,
          packageId: offer.id,
          contentRevision: offer.contentRevision ?? 0,
          meal,
          dates: batch.dates,
          details: batch.details,
        });
        copied += batch.dates.length;
        setNote(copyNote(copied, skipped));
      }
      setNote(copyNote(copied, skipped));
    } catch (e) {
      setError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Menu minggu lalu belum tersalin. Coba lagi.", "Last week's menu was not copied. Try again."));
    }
  });

  function shareMenu() {
    if (!offer || !template) return;
    const lines = (days.data ?? [])
      .filter((d) => d.details?.items?.length)
      .map((d) => ({
        date: d.date,
        lines: (template.composition ?? []).map((g) => ({
          category: g.name,
          dishes: (d.details!.items ?? []).filter((i) => i.groupId === g.id).map((i) => i.name),
        })),
      }));
    void Share.share({
      message: menuShareText(lines, { caterer: ops.data?.caterer.name ?? "", packageName: offer.name }, locale),
    });
  }

  /** Pick a photo for one dish of the day, upload it, and save it on that day's menu item only. */
  async function addPhoto(day: MenuDay, dish: Dish) {
    if (!offer || photoBusyRef.current) return;
    photoBusyRef.current = true;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      let url: string;
      try {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
        if (result.canceled || !result.assets?.[0]) return;
        setUploadingDish({ key: `${offer.id}:${meal}`, date: day.date, dishId: dish.id });
        url = await uploadPhoto(runtime, result.assets[0], demo);
      } catch {
        setPhotoError(t("Foto gagal diunggah. Coba lagi.", "Photo upload failed. Try again."));
        return;
      }
      // The week may have been reloaded while the picker and the upload ran: save against its newest version.
      const current = latestDays.current.get(day.date) ?? day;
      const items = current.details?.items ?? [];
      if (!items.some((i) => i.id === dish.id)) {
        // The caterer changed this day while the photo was on its way: say so rather than drop it silently.
        setPhotoError(t("Menu sudah berubah. Coba lagi.", "The menu changed. Try again."));
        await days.reload();
        return;
      }
      try {
        await saveMenuDay(
          { command },
          { catererId, offer, meal, day: current, items: items.map((i) => (i.id === dish.id ? { ...i, image: url } : i)) },
        );
        // The save refreshes the week by itself; the pills stay off until that read carries the photo.
        setAwaiting({ key: `${offer.id}:${meal}`, date: day.date, dishId: dish.id, url, version: current.version, started: false });
      } catch (e) {
        setPhotoError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Foto belum tersimpan. Coba lagi.", "The photo was not saved. Try again."));
        // A failed save may mean the day moved on (a conflict): read it again so the next try has the right version.
        await days.reload();
      }
    } finally {
      photoBusyRef.current = false;
      setPhotoBusy(false);
      setUploadingDish(null);
    }
  }

  if ((ops.error && !ops.data) || (days.error && !days.data))
    return <MenuLoadError onRetry={() => void (ops.error && !ops.data ? ops.reload() : days.reload())} />;

  // No packages yet: the page's first block (the skeleton's controls until now) fades the empty state in.
  if (ops.data && !offers.length)
    return (
      <Screen header={<MenuTitle />}>
        <FadeSwap swapKey="empty" style={{ gap: 16 }}>
          {canEdit ? (
            <>
              <Text>{t("Buat paket dulu, lalu isi menunya di sini.", "Create a package first, then fill its menu here.")}</Text>
              <Button label={t("Buat paket", "Create a package")} onPress={() => router.push("/paket/baru" as never)} />
            </>
          ) : (
            <Text>{t("Belum ada paket.", "No packages yet.")}</Text>
          )}
        </FadeSwap>
      </Screen>
    );

  // The first read, before the packages are known. The loading and the loaded week are one tree: the header keeps its
  // rows (the week line, a 48dp title row, the day strip as blocks) and the page its two blocks (the controls, then the
  // day card), so each block enters from its skeleton once, in place. The day card waits through both reads.
  const waiting = !ops.data;
  const weekReady = !waiting && weekLoaded;
  const weekLabel =
    week === 0 ? t("Minggu ini", "This week") : week === 1 ? t("Minggu depan", "Next week") : dates[0] ? shortDate(dates[0], locale) : "";
  const step = (delta: number, icon: "chevron-back" | "chevron-forward", label: string) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="select"
      onPress={() => {
        setWeek((w) => w + delta);
        setPhotoError("");
      }}
      hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
      style={{ width: nativeLayout.control.icon, height: nativeLayout.control.icon, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={icon} size={24} color={m.headerText} />
    </PressableScale>
  );
  const items = selected?.details?.items ?? [];
  // Only the day the photo belongs to shows it on its way; the same slot on another day is just waiting its turn.
  const here = `${offer?.id}:${meal}`;
  const uploadingHere = (dishId: string) =>
    (uploadingDish?.key === here && uploadingDish.date === selectedDate && uploadingDish.dishId === dishId) ||
    (waitingForWeek && awaiting?.date === selectedDate && awaiting.dishId === dishId);
  const past = selectedDate < today;
  const onlyMeal = offer?.meal !== "both" ? offer?.meal : undefined;
  // One row for any package: the tiles share the row's width, whatever the day count (7 at 412dp are about 51 wide, at 360dp about 44).
  const tileWidth = (stripWidth - STRIP_GAP * (dates.length - 1)) / Math.max(1, dates.length);
  const hasNotes =
    (canEdit && weekLoaded && (lastWeekPending || lastWeekEmpty)) || (weekLoaded && !hasMenu) || !!note || !!error;

  return (
    <Screen
      header={
        <MoodHeader
          meta={weekLabel}
          trailing={actor?.role === "staff" ? <SettingsGear /> : undefined}
          title={
            // The step buttons' 44dp sets the row; before the packages are known the week has no dates to step
            // through, so the row holds the screen's name at that height until they arrive. The header's own 12 gap
            // above it is 8 too many for the board (the week line and the range sit 4 apart), so it pulls up by 8.
            <View
              testID="menu-title-row"
              style={{
                minHeight: nativeLayout.control.icon,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: -8,
              }}
            >
              {waiting ? null : step(-1, "chevron-back", t("Minggu sebelumnya", "Previous week"))}
              <Text variant="heroTitle" style={{ color: m.headerText, flex: 1, flexShrink: 1, textAlign: waiting ? "left" : "center" }}>
                {weekRange(dates, locale) || t("Menu", "Menu")}
              </Text>
              {waiting ? null : step(1, "chevron-forward", t("Minggu berikutnya", "Next week"))}
            </View>
          }
        >
          <View style={{ gap: 12 }}>
            {/* Siang / Malam picks the meal of a package that serves both: its own 48 frame under the week range. */}
            {offer?.meal === "both" ? (
              <View testID="menu-meal-frame" style={{ height: MEAL_FRAME, alignItems: "center", justifyContent: "center" }}>
                <MoodToggle />
              </View>
            ) : null}
            {/* The day strip enters from its blocks as one piece, in the same place on the header. */}
            <FadeSwap swapKey={waiting ? "loading" : "loaded"}>
              {waiting ? (
                <MenuStripSkeleton height={DAY_HEIGHT} gap={STRIP_GAP} />
              ) : (
                <View
                  testID="menu-strip"
                  onLayout={(e) => {
                    const width = Math.floor(e.nativeEvent.layout.width);
                    if (width > 0) setStripWidth(width);
                  }}
                  style={{ flexDirection: "row", gap: STRIP_GAP }}
                >
                  {dates.map((date) => {
                    // Until the week has been read, a day's fill is not known: say nothing about it rather than "not filled".
                    const filled = weekLoaded && !!byDate.get(date)?.details?.items?.length;
                    const isToday = date === today;
                    const isSelected = date === selectedDate;
                    // The chosen day is a selection (direction K rule 3): a forest fill with the selected segment's ink, in the
                    // mood tokens, so it stands out on every header, Malam included.
                    const ink = isSelected ? m.onToggleActive : m.headerText;
                    const fill = weekLoaded ? (filled ? t("menu terisi", "menu filled") : t("menu belum diisi", "menu not filled")) : "";
                    return (
                      <PressableScale
                        key={date}
                        testID={`menu-day-${date}`}
                        accessibilityRole="button"
                        accessibilityLabel={[shortDate(date, locale), isToday ? t("hari ini", "today") : "", fill].filter(Boolean).join(", ")}
                        accessibilityState={{ selected: isSelected }}
                        haptic="select"
                        onPress={() => {
                          setPicked(date);
                          setPhotoError("");
                        }}
                        style={{
                          // Every tile is the same width, so a short week and a full one both fill one row.
                          flexGrow: 0,
                          flexShrink: 0,
                          width: tileWidth,
                          minHeight: DAY_HEIGHT,
                          borderRadius: nativeLayout.radius.control,
                          borderCurve: "continuous",
                          borderWidth: 1.5,
                          // The ring is today; the fill is the chosen day. A day that is neither keeps a quiet outline.
                          borderColor: isToday ? m.todayRing : isSelected ? m.toggleActive : m.markerIdle,
                          backgroundColor: isSelected ? m.toggleActive : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text variant="meta" style={{ color: ink }}>
                          {weekdayShort(date, locale)}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text variant="bodyStrong" accessibilityRole="text" style={{ color: ink, fontVariant: ["tabular-nums"] }}>
                            {String(Number(date.slice(8)))}
                          </Text>
                          {/* The state mark: a 6 dot for a filled day; an empty 6 square otherwise, so the dates line up. */}
                          {filled ? (
                            <View testID={`menu-dot-${date}`} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink }} />
                          ) : (
                            <View testID={`menu-mark-${date}`} style={{ width: 6, height: 6 }} />
                          )}
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              )}
            </FadeSwap>
            {onlyMeal ? (
              // 8 under the strip on the board; the wrapper's 12 gap is pulled in by 4.
              <Text variant="meta" style={{ color: m.headerMeta, marginTop: -4 }}>
                {onlyMeal === "lunch"
                  ? t("Paket ini hanya untuk makan siang", "This package is lunch only")
                  : t("Paket ini hanya untuk makan malam", "This package is dinner only")}
              </Text>
            ) : null}
          </View>
        </MoodHeader>
      }
    >
      <FadeSwap swapKey={waiting ? "loading" : "loaded"} style={{ gap: 12 }}>
        {waiting ? (
          <MenuControlsSkeleton owner={canEdit} />
        ) : (
          <>
            {/* The chips are 34 with a 48 target: the scroller's content is a 48 frame so nothing clips the slop, and it
                bleeds to the screen's edges so the chips scroll under them. */}
            <ScrollView
              testID="menu-package-chips"
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginHorizontal: -margin }}
              contentContainerStyle={{ gap: 8, minHeight: CHIP_FRAME, alignItems: "center", paddingHorizontal: margin }}
            >
              {offers.map((o) => (
                <Chip key={o.id} label={o.name} selected={o.id === offer?.id} onPress={() => setPackageId(o.id)} />
              ))}
            </ScrollView>
            <View testID="menu-actions" style={{ flexDirection: "row", gap: 8 }}>
              {canEdit ? (
                <Button style={{ flex: 1 }} variant="secondary" busy={busy} disabled={!weekLoaded || lastWeekPending || lastWeekEmpty} label={t("Salin minggu lalu", "Copy last week")} onPress={() => void copyLastWeek()} />
              ) : null}
              <Button style={{ flex: 1 }} variant="secondary" disabled={!hasMenu} label={t("Bagikan menu", "Share menu")} onPress={shareMenu} />
            </View>
            {hasNotes ? (
              // Under the buttons, the captions and the copy result: 8 below them on the board, 4 apart.
              <View style={{ gap: 4, marginTop: -4 }}>
                {canEdit && weekLoaded && lastWeekPending ? (
                  <Text variant="meta">{t("Memuat minggu lalu…", "Loading last week…")}</Text>
                ) : null}
                {canEdit && weekLoaded && lastWeekEmpty ? (
                  <Text variant="meta">{t("Minggu lalu belum ada menu untuk disalin", "Last week has no menu to copy")}</Text>
                ) : null}
                {weekLoaded && !hasMenu ? (
                  <Text variant="meta">{t("Belum ada menu untuk dibagikan", "No menu to share yet")}</Text>
                ) : null}
                {note ? <Text variant="meta">{note}</Text> : null}
                {error ? <FormError message={error} failureKey={errorState.key} /> : null}
              </View>
            ) : null}
          </>
        )}
      </FadeSwap>
      {/* The day is its own block from the first frame: it waits behind its skeleton through the packages' read and
          the week's, and enters once. Sections sit 24 apart (the body's 16 and 8 more). */}
      <FadeSwap swapKey={weekReady ? "week" : "loading"} style={{ gap: nativeLayout.dense.sectionGap, marginTop: nativeLayout.dense.sectionGap - 16 }}>
        {!weekReady ? <MenuWeekSkeleton /> : null}
        {selected ? (
          <View testID="menu-day">
            <SectionHeader
              title={shortDate(selected.date, locale)}
              action={
                canEdit && selected.editable ? (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t("Ubah menu", "Edit menu")}
                    haptic="tap"
                    onPress={() => router.push(`/menu/${selected.date}?pkg=${offer.id}&meal=${meal}` as never)}
                    // 48 tall, and its label ends at the screen margin.
                    style={{ minHeight: 48, paddingHorizontal: 12, marginRight: -12, justifyContent: "center" }}
                  >
                    {/* forest: action (the section's link) */}
                    <Text variant="bodyStrong" style={{ color: c.forest }}>
                      {t("Ubah menu", "Edit menu")}
                    </Text>
                  </PressableScale>
                ) : undefined
              }
            />
            {items.length ? (
              <View style={{ gap: 12 }}>
                {(template?.composition ?? []).map((g) => {
                  const rows = items.filter((i) => i.groupId === g.id);
                  return rows.length ? (
                    <View key={g.id} style={{ gap: 8 }}>
                      <Text variant="meta">{componentLabel(g, locale)}</Text>
                      <ListCard inset={COMPACT_MEDIA_INSET}>
                        {rows.map((dish) => (
                          <DishRow
                            key={dish.id}
                            dish={dish}
                            canAddPhoto={canEdit && selected.editable}
                            uploading={uploadingHere(dish.id)}
                            busy={photoBusy || waitingForWeek}
                            onAdd={() => void addPhoto(selected, dish)}
                          />
                        ))}
                      </ListCard>
                    </View>
                  ) : null;
                })}
              </View>
            ) : past || !selected.editable ? (
              // An empty day nobody can fill any more: past, or past its change cutoff. It is not a to-do, so it is muted.
              <Text variant="caption" style={{ color: c.muted }}>
                {past ? t("Lewat", "Past") : t("Sudah tidak bisa diubah", "Can't be changed anymore")}
              </Text>
            ) : (
              // A status, not an error: bold charcoal, never a bare danger caption (spec 5.2).
              <Text style={{ color: c.charcoal, fontFamily: fontFor("700") }}>
                {t("Belum diisi", "Not filled")}
              </Text>
            )}
            {photoError ? (
              <View style={{ marginTop: 12 }}>
                <FormError message={photoError} failureKey={photoErrorState.key} />
              </View>
            ) : null}
          </View>
        ) : null}
        {selected && items.length ? (
          <View testID="menu-cover">
            <SectionHeader title={t("Tampilan di aplikasi pelanggan", "How customers see it")} />
            <View style={{ gap: 8 }}>
              <View style={{ alignSelf: "center" }}>
                <StoryCover
                  uri={photoUri(menuCoverImage(selected.details, offer.image || ""), runtime.apiBase)}
                  title={`${mealLabel(meal, locale)} · ${shortDate(selected.date, locale)}`}
                  // The customer story has one slide per meal of the package: lunch, and dinner when it serves both.
                  segments={offer.meal === "both" ? 2 : 1}
                  active={offer.meal === "both" && meal === "dinner" ? 2 : 1}
                  width={COVER_WIDTH}
                  height={Math.round(COVER_WIDTH * 1.25)}
                />
              </View>
              <Text variant="meta">
                {t(
                  "Foto lauk utama jadi sampul menu besok. Menu tanpa foto memakai foto paket.",
                  "The main dish photo becomes the cover of tomorrow's menu. A menu without photos uses the package photo.",
                )}
              </Text>
            </View>
          </View>
        ) : null}
      </FadeSwap>
    </Screen>
  );
}
