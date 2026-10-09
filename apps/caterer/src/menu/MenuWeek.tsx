import { useRef, useState } from "react";
import { Image, ScrollView, Share, useWindowDimensions, View } from "react-native";
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
import {
  Button,
  Card,
  Chip,
  fontFor,
  MoodHeader,
  PressableScale,
  Screen,
  StoryCover,
  Text,
  useColors,
  useMood,
  useMoodColors,
} from "@catera/mobile-ui";
import { copyWeekBatches, mealOf, saveMenuDay, weekdayShort, weekDates, weekRange } from "./logic";
import { uploadPhoto } from "../business/upload";
import { photoUri } from "../photo";
import { ReadError } from "../ReadError";

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

/** The Menu header while there is no week to show yet (loading, empty, failed): the screen keeps its mood block. */
function MenuTitle() {
  const { t } = useMobile();
  return <MoodHeader title={t("Menu", "Menu")} />;
}

/** A failed menu read: say so plainly and offer a retry, never an empty week or endless loading. */
export function MenuLoadError({ onRetry, title = true }: { onRetry: () => void; title?: boolean }) {
  const { t } = useMobile();
  return (
    <Screen header={title ? <MenuTitle /> : undefined}>
      <ReadError message={t("Menu belum bisa dimuat.", "The menu couldn't be loaded.")} onRetry={onRetry} />
    </Screen>
  );
}

const SLOT = 48;
// A day button needs about 48dp plus its gap; the strip fits as many per row as the width allows, evenly.
const STRIP_SLOT = 54;
const STRIP_GAP = 6;

/** One dish in the day card: its photo, or a dashed camera tile with a pill to add one. */
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
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: SLOT }}>
      {dish.image ? (
        <View
          testID={`menu-dish-photo-${dish.id}`}
          style={{ width: SLOT, height: SLOT, borderRadius: 12, borderCurve: "continuous", overflow: "hidden", backgroundColor: c.sage }}
        >
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: photoUri(dish.image, runtime.apiBase) }}
            resizeMode="cover"
            style={{ width: SLOT, height: SLOT }}
          />
        </View>
      ) : (
        <View
          testID={`menu-photo-tile-${dish.id}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: SLOT,
            height: SLOT,
            borderRadius: 12,
            borderCurve: "continuous",
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: c.controlRing,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="camera-outline" size={20} color={c.muted} />
        </View>
      )}
      <View style={{ flex: 1, gap: 4, alignItems: "flex-start" }}>
        <Text>{dish.name}</Text>
        {!dish.image && canAddPhoto ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${t("Tambah foto", "Add photo")}, ${dish.name}`}
            accessibilityState={{ disabled: busy, busy: uploading }}
            disabled={busy}
            haptic="tap"
            onPress={onAdd}
            style={{
              minHeight: 48,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: c.sage,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy && !uploading ? 0.45 : 1,
            }}
          >
            <Text variant="label" style={{ color: c.forest }}>
              {uploading ? t("Mengunggah…", "Uploading…") : t("Tambah foto", "Add photo")}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

/** Menu: this week's dishes per delivery day for one package. */
export function MenuWeek() {
  const { runtime, actor, demo, t, locale, command } = useMobile();
  const c = useColors();
  const m = useMoodColors();
  const { mood } = useMood();
  const { width: windowWidth } = useWindowDimensions();
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [uploadingId, setUploadingId] = useState("");
  const [photoError, setPhotoError] = useState("");
  // One photo at a time, from the tap until the reloaded menu has landed. The ref stops a double tap before a re-render.
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoBusyRef = useRef(false);
  // The newest read of the week, so a save made after a slow picker uses the day's current version, not the tapped one.
  const latestDays = useRef(new Map<string, MenuDay>());
  // The strip lays itself out from the width it is given; until it is measured, the window stands in.
  const [stripWidth, setStripWidth] = useState(Math.min(windowWidth, 760) - 40);
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

  async function copyLastWeek() {
    if (!offer) return;
    setBusy(true);
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
      setError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Belum tersimpan.", "Not saved."));
    } finally {
      setBusy(false);
    }
  }

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
        setUploadingId(dish.id);
        url = await uploadPhoto(runtime, result.assets[0], demo);
      } catch {
        setPhotoError(t("Foto gagal diunggah. Coba lagi.", "Photo upload failed. Try again."));
        return;
      }
      // The week may have been reloaded while the picker and the upload ran: save against its newest version.
      const current = latestDays.current.get(day.date) ?? day;
      const items = current.details?.items ?? [];
      if (!items.some((i) => i.id === dish.id)) return;
      try {
        await saveMenuDay(
          { command },
          { catererId, offer, meal, day: current, items: items.map((i) => (i.id === dish.id ? { ...i, image: url } : i)) },
        );
      } catch (e) {
        setPhotoError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Belum tersimpan.", "Not saved."));
      }
      // A failed save may mean the day moved on (a conflict): read it again so the next try has the right version.
      await days.reload();
    } finally {
      photoBusyRef.current = false;
      setPhotoBusy(false);
      setUploadingId("");
    }
  }

  if ((ops.error && !ops.data) || (days.error && !days.data))
    return <MenuLoadError onRetry={() => void (ops.error && !ops.data ? ops.reload() : days.reload())} />;

  if (!ops.data)
    return (
      <Screen header={<MenuTitle />}>
        <Text variant="caption">{t("Memuat…", "Loading…")}</Text>
      </Screen>
    );

  if (!offers.length)
    return (
      <Screen header={<MenuTitle />}>
        {canEdit ? (
          <>
            <Text>{t("Buat paket dulu, lalu isi menunya di sini.", "Create a package first, then fill its menu here.")}</Text>
            <Button label={t("Buat paket", "Create a package")} onPress={() => router.push("/paket/baru" as never)} />
          </>
        ) : (
          <Text>{t("Belum ada paket.", "No packages yet.")}</Text>
        )}
      </Screen>
    );

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
      style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={icon} size={24} color={m.headerText} />
    </PressableScale>
  );
  const items = selected?.details?.items ?? [];
  const past = selectedDate < today;
  const onlyMeal = offer?.meal !== "both" ? offer?.meal : undefined;
  const coverWidth = Math.min(220, Math.min(windowWidth, 760) - 40 - 34);
  // Seven 54dp slots to a row is the most that reads comfortably; the days are spread evenly over as few rows as fit.
  const stripRows = Math.max(1, Math.ceil((dates.length * STRIP_SLOT) / stripWidth));
  const perRow = Math.max(1, Math.ceil(dates.length / stripRows));
  const buttonWidth = Math.floor((stripWidth - STRIP_GAP * (perRow - 1)) / perRow);

  return (
    <Screen
      header={
        <MoodHeader
          meta={weekLabel}
          toggle={offer?.meal === "both"}
          title={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {step(-1, "chevron-back", t("Minggu sebelumnya", "Previous week"))}
              <Text variant="display" accessibilityRole="header" style={{ color: m.headerText, flexShrink: 1 }}>
                {weekRange(dates, locale) || t("Menu", "Menu")}
              </Text>
              {step(1, "chevron-forward", t("Minggu berikutnya", "Next week"))}
            </View>
          }
        >
          <View
            testID="menu-strip"
            onLayout={(e) => {
              const width = Math.floor(e.nativeEvent.layout.width);
              if (width > 0) setStripWidth(width);
            }}
            style={{ flexDirection: "row", flexWrap: "wrap", gap: STRIP_GAP }}
          >
            {dates.map((date) => {
              // Until the week has been read, a day's fill is not known: say nothing about it rather than "not filled".
              const filled = weekLoaded && !!byDate.get(date)?.details?.items?.length;
              const isToday = date === today;
              const isSelected = date === selectedDate;
              // The chosen day inverts the header (mood tokens), so it stands out on every header, Malam included.
              const ink = isSelected ? m.header : m.headerText;
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
                    // Rows are balanced by width, so the last row never stretches.
                    flexGrow: 0,
                    flexShrink: 0,
                    width: buttonWidth,
                    minHeight: 64,
                    paddingVertical: 6,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    borderWidth: 2,
                    // The ring is today; the fill is the chosen day. A day that is neither keeps a quiet outline.
                    borderColor: isToday ? m.todayRing : isSelected ? m.headerText : m.markerIdle,
                    backgroundColor: isSelected ? m.headerText : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text variant="caption" style={{ color: ink, lineHeight: 16 }}>
                    {weekdayShort(date, locale)}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Text
                      variant="heading"
                      accessibilityRole="text"
                      style={{ color: ink, fontVariant: ["tabular-nums"] }}
                    >
                      {String(Number(date.slice(8)))}
                    </Text>
                    {filled ? <Ionicons name="checkmark-circle" size={14} color={ink} /> : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
          {onlyMeal ? (
            <Text variant="caption" style={{ color: m.headerMeta }}>
              {onlyMeal === "lunch"
                ? t("Paket ini hanya untuk makan siang", "This package is lunch only")
                : t("Paket ini hanya untuk makan malam", "This package is dinner only")}
            </Text>
          ) : null}
        </MoodHeader>
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {offers.map((o) => (
          <Chip key={o.id} label={o.name} selected={o.id === offer?.id} onPress={() => setPackageId(o.id)} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {canEdit ? (
          <Button style={{ flex: 1 }} variant="secondary" disabled={busy || !weekLoaded || lastWeekPending || lastWeekEmpty} label={t("Salin minggu lalu", "Copy last week")} onPress={() => void copyLastWeek()} />
        ) : null}
        <Button style={{ flex: 1 }} variant="secondary" disabled={!hasMenu} label={t("Bagikan menu", "Share menu")} onPress={shareMenu} />
      </View>
      {canEdit && weekLoaded && lastWeekPending ? (
        <Text variant="caption">{t("Memuat minggu lalu…", "Loading last week…")}</Text>
      ) : null}
      {canEdit && weekLoaded && lastWeekEmpty ? (
        <Text variant="caption">{t("Minggu lalu belum ada menu untuk disalin", "Last week has no menu to copy")}</Text>
      ) : null}
      {weekLoaded && !hasMenu ? (
        <Text variant="caption">{t("Belum ada menu untuk dibagikan", "No menu to share yet")}</Text>
      ) : null}
      {!weekLoaded ? <Text variant="caption">{t("Memuat…", "Loading…")}</Text> : null}
      {note ? <Text variant="caption">{note}</Text> : null}
      {error ? <Text selectable style={{ color: c.danger }}>{error}</Text> : null}
      {selected ? (
        <Card>
          <Text variant="heading">{shortDate(selected.date, locale)}</Text>
          {items.length ? (
            (template?.composition ?? []).map((g) => {
              const rows = items.filter((i) => i.groupId === g.id);
              return rows.length ? (
                <View key={g.id} style={{ gap: 8 }}>
                  <Text variant="caption">{componentLabel(g, locale)}</Text>
                  {rows.map((dish) => (
                    <DishRow
                      key={dish.id}
                      dish={dish}
                      canAddPhoto={canEdit && selected.editable}
                      uploading={uploadingId === dish.id}
                      busy={photoBusy}
                      onAdd={() => void addPhoto(selected, dish)}
                    />
                  ))}
                </View>
              ) : null;
            })
          ) : past ? (
            <Text variant="caption" style={{ color: c.muted }}>
              {t("Lewat", "Past")}
            </Text>
          ) : (
            <Text style={{ color: c.sunriseInk, fontFamily: fontFor("700") }}>
              {t("Belum diisi", "Not filled")}
            </Text>
          )}
          {photoError ? <Text selectable style={{ color: c.danger }}>{photoError}</Text> : null}
          {canEdit && selected.editable ? (
            <Button
              variant="secondary"
              label={t("Ubah menu", "Edit menu")}
              onPress={() => router.push(`/menu/${selected.date}?pkg=${offer.id}&meal=${meal}` as never)}
            />
          ) : null}
        </Card>
      ) : null}
      {selected && items.length ? (
        <Card>
          <Text variant="heading">{t("Tampilan di aplikasi pelanggan", "How customers see it")}</Text>
          <View style={{ alignSelf: "center" }}>
            <StoryCover
              uri={photoUri(menuCoverImage(selected.details, offer.image || ""), runtime.apiBase)}
              title={`${mealLabel(meal, locale)} · ${shortDate(selected.date, locale)}`}
              // The customer story has one slide per meal of the package: lunch, and dinner when it serves both.
              segments={offer.meal === "both" ? 2 : 1}
              active={offer.meal === "both" && meal === "dinner" ? 2 : 1}
              width={coverWidth}
              height={Math.round(coverWidth * 1.25)}
            />
          </View>
          <Text variant="caption">
            {t(
              "Foto lauk utama jadi sampul menu besok. Menu tanpa foto memakai foto paket.",
              "The main dish photo becomes the cover of tomorrow's menu. A menu without photos uses the package photo.",
            )}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}
