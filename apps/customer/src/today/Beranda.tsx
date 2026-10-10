import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  activePlans,
  dayLabel,
  jakartaDay,
  mealPlates,
  recapCandidates,
  todayPlates,
  upcomingDays,
  type CustomerState,
  type Plate as PlateData,
} from "@catera/domain";
import { useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import {
  Button,
  fontFor,
  HeroPager,
  MoodHeader,
  PhotoRing,
  PressableScale,
  Screen,
  Text,
  themedStyles,
  useColors,
  useMood,
  useMoodColors,
} from "@catera/mobile-ui";
import { EmptyHome } from "./EmptyHome";
import { HERO_OVERLAP, jakartaClock, photoUri, Plate, sentences } from "./Plate";
import { RecapCard } from "./RecapCard";
import { WaitingList } from "./WaitingList";
import { UpcomingDays } from "./UpcomingDays";
import { PlansRow } from "./PlansRow";
import { TomorrowEntry } from "../tomorrow/TomorrowRow";
import { loadCachedCustomer, saveCachedCustomer } from "./offline";

type LoadedCustomer = { data: CustomerState; savedAt: string | null };

async function loadCustomer(runtime: MobileRuntime, key: string): Promise<LoadedCustomer> {
  try {
    const data = await runtime.api.customer();
    await saveCachedCustomer(key, { savedAt: new Date().toISOString(), data });
    return { data, savedAt: null };
  } catch (e) {
    const cached = await loadCachedCustomer(key);
    if (cached) return { data: cached.data, savedAt: cached.savedAt };
    throw e;
  }
}

/** Beranda: today's plate (or plates), what waits on the customer, the next days and the running plans. */
export function Beranda() {
  const { actor, ready } = useMobile();
  const c = useColors();
  const styles = useStyles();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.forest} />
      </View>
    );
  if (!actor) return <EmptyHome />;
  return <SignedInHome actorId={actor.id} />;
}

type Translate = (id: string, en: string) => string;

/**
 * The second line of the headline for the chosen meal's plates today: the main dish of one plate (lowercased; the
 * package name, in its own casing, while the menu is not set, so an unset menu never shows a dish), the count of
 * several, or that none comes.
 */
function headlineFor(plates: PlateData[], t: Translate): string {
  if (plates.length > 1) return t(`${plates.length} antaran.`, `${plates.length} deliveries.`);
  const plate = plates[0];
  if (!plate) return t("tidak ada antaran.", "no delivery.");
  return `${plate.lead?.toLowerCase() ?? plate.packageName}.`;
}

/**
 * The line under one end of the day arc: when the meal's one delivery today comes (its window start, "11.00"), how
 * many come when there are several, or that none does. A window that does not start with a time falls back to the
 * count, so the line never shows a time the caterer did not set.
 */
function arcDetail(plates: PlateData[], t: Translate): string {
  if (!plates.length) return t("Tidak ada", "None");
  const start = plates.length === 1 ? windowStart(plates[0].window) : null;
  return start ?? t(`${plates.length} antaran`, plates.length === 1 ? "1 delivery" : `${plates.length} deliveries`);
}

/** "11.00" from a window such as "11.00–13.00"; null when the window does not start with a time. */
function windowStart(window: string): string | null {
  const m = /^\s*(\d{1,2})[.:](\d{2})\s*[–-]/.exec(window);
  return m ? `${m[1].padStart(2, "0")}.${m[2]}` : null;
}

/** Plates that need the customer now. The mood must not hide them behind the other meal's hero. */
const NEEDS_YOU: PlateData["state"][] = ["due", "on_the_way", "failed"];

/**
 * The compact row for the meal the mood is not on: its ring, when it comes ("Malam ini · 17.00–19.00") or how many
 * come ("Siang ini · 2 antaran"), and the first plate's main dish (the package name while its menu is not set, the
 * headline's rule). One tap switches to it. When a plate of that meal needs the customer (it should have arrived, is on
 * the way, or failed), its status sentence shows here too, so "needs you now" stays visible; the actions are one tap
 * away, on the hero.
 */
function OtherMealRow({ plates, apiBase, onPress }: { plates: PlateData[]; apiBase: string; onPress: () => void }) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const plate = plates[0];
  const dinner = plate.meal === "dinner";
  const label = dinner ? t("Malam ini", "Dinner tonight") : t("Siang ini", "Lunch today");
  const when =
    plates.length > 1 ? t(`${plates.length} antaran`, `${plates.length} deliveries`) : plate.window || "";
  const dish = plate.lead ?? plate.packageName;
  const waiting = plates.find((p) => NEEDS_YOU.includes(p.state));
  const status = waiting ? sentences(waiting, t)[0] : "";
  return (
    <PressableScale
      testID="other-meal-row"
      accessibilityRole="button"
      haptic="select"
      onPress={onPress}
      style={styles.otherMeal}
    >
      {/* The row is the button and speaks for the ring. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <PhotoRing
          uri={photoUri(plate.image, apiBase)}
          size={54}
          ring={dinner ? "forest" : "sunrise"}
          accessibilityLabel={dish}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" style={{ lineHeight: 18, fontVariant: ["tabular-nums"] }}>
          {when ? `${label} · ${when}` : label}
        </Text>
        <Text style={{ fontFamily: fontFor("700") }}>{dish}</Text>
        {status ? (
          <Text testID="other-meal-status" style={{ fontFamily: fontFor("700"), color: c.sunriseInk }}>
            {status}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

function SignedInHome({ actorId }: { actorId: string }) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const { mood, setMood } = useMood();
  const palette = useMoodColors();
  const home = useData(`home:customer`, () => loadCustomer(runtime, actorId));
  // Menu choices that are due; Beranda still shows without them (offline or a failed feed).
  const actions = useData("home:actions", () => runtime.api.customerActions(20).catch(() => null));
  // The pager's card in view, per meal, so a mood switch never counts the other meal's card as seen.
  const [page, setPage] = useState<{ meal: string; index: number }>({ meal: "", index: 0 });
  const state = home.data?.data;
  const now = new Date();

  if (!state)
    return (
      <Screen header={<MoodHeader title={t("Beranda", "Home")} />}>
        {home.loading ? (
          <ActivityIndicator color={c.forest} />
        ) : (
          <View style={{ gap: 4, alignItems: "flex-start" }}>
            <Text selectable testID="home-error" style={{ color: c.danger }}>
              {home.error}
            </Text>
            <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void home.reload()} />
          </View>
        )}
      </Screen>
    );

  const plates = todayPlates(state, now);
  const days = upcomingDays(state, now, 3, locale);
  const plans = activePlans(state);
  // Plans that ended lately and were not renewed; the card itself checks whether its recap was already seen.
  const recaps = recapCandidates(state, now);
  const recap = recaps.length ? <RecapCard candidates={recaps} /> : null;
  if (!plates.length && !days.length && !plans.count) return <EmptyHome lead={recap} />;
  const savedAt = home.data?.savedAt;

  const today = jakartaDay(now);
  const meal = mood === "siang" ? "lunch" : "dinner";
  const byMeal = mealPlates(plates);
  const heroPlates = byMeal[meal];
  const otherPlates = byMeal[meal === "lunch" ? "dinner" : "lunch"];
  const opening = mood === "siang" ? t("Siang ini,", "Lunch today,") : t("Malam ini,", "Dinner tonight,");
  const headline = `${opening}\n${headlineFor(heroPlates, t)}`;
  const arc = {
    siang: { title: t("Siang", "Lunch"), label: t("Makan siang", "Lunch"), detail: arcDetail(byMeal.lunch, t) },
    malam: { title: t("Malam", "Dinner"), label: t("Makan malam", "Dinner"), detail: arcDetail(byMeal.dinner, t) },
  };
  const next = days[0];
  const nextLabel = next?.label ?? "";
  // "Berikutnya" names a later day, so it is only true when nothing else is left today.
  const laterToday = otherPlates.some((p) => !["arrived", "failed", "reported"].includes(p.state));
  const meta =
    !heroPlates.length && !laterToday && next
      ? t(`Berikutnya ${nextLabel}`, `Next ${nextLabel}`)
      : dayLabel(today, today, locale);
  const mealName = meal === "lunch" ? t("Makan siang", "Lunch") : t("Makan malam", "Dinner");
  const inView = page.meal === meal ? page.index : 0;

  return (
    <Screen
      header={
        <MoodHeader
          meta={meta}
          arc={arc}
          overlap={heroPlates.length ? 58 : 0}
          title={
            <Text
              testID="home-title"
              variant="title"
              accessibilityRole="header"
              style={{ color: palette.headerText }}
            >
              {headline}
            </Text>
          }
        />
      }
    >
      {heroPlates.length > 1 ? (
        // Several deliveries of the chosen meal: equal heroes, one at a time, the next one peeking.
        <HeroPager
          key={`pager:${meal}`}
          count={heroPlates.length}
          style={{ marginTop: HERO_OVERLAP }}
          // TalkBack reads "Makan siang, 1 dari 2, Dapur Senja": the meal names the control, and the position with the
          // card's kitchen is its value, which the platform speaks again after each move.
          accessibilityLabelFor={() => mealName}
          accessibilityValueFor={(i) =>
            t(
              `${i + 1} dari ${heroPlates.length}, ${heroPlates[i]?.catererName ?? ""}`,
              `${i + 1} of ${heroPlates.length}, ${heroPlates[i]?.catererName ?? ""}`,
            )
          }
          counterLabel={(i) => t(`${i + 1} dari ${heroPlates.length}`, `${i + 1} of ${heroPlates.length}`)}
          onIndexChange={(index) => setPage({ meal, index })}
        >
          {heroPlates.map((p, i) => (
            <Plate
              key={`${p.deliveryId}:${p.meal}`}
              variant="hero"
              paged
              counted={i === inView}
              plate={p}
              apiBase={runtime.apiBase}
              offline={!!savedAt}
            />
          ))}
        </HeroPager>
      ) : heroPlates.length ? (
        // One frame for the hero whichever meal it shows, so its fill cross-fades when the mood switches.
        <Plate key="hero" variant="hero" plate={heroPlates[0]} apiBase={runtime.apiBase} offline={!!savedAt} />
      ) : null}
      {savedAt ? (
        <Text variant="caption" style={{ color: c.sunriseInk, fontVariant: ["tabular-nums"] }}>
          {t("Terakhir diperbarui", "Last updated")} {jakartaClock(savedAt)} ·{" "}
          {t("tidak ada koneksi", "no connection")}
        </Text>
      ) : home.error ? (
        <Text selectable variant="caption" style={{ color: c.danger }}>
          {home.error}
        </Text>
      ) : null}
      {otherPlates.length ? (
        <OtherMealRow
          plates={otherPlates}
          apiBase={runtime.apiBase}
          onPress={() => setMood(mood === "siang" ? "malam" : "siang")}
        />
      ) : null}
      {recap}
      <WaitingList state={state} actions={actions.data?.items ?? null} offline={!!savedAt} now={now} />
      <TomorrowEntry state={state} now={now} />
      <UpcomingDays days={days} apiBase={runtime.apiBase} />
      <PlansRow count={plans.count} caterers={plans.caterers} images={plans.images} apiBase={runtime.apiBase} />
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.canvas },
  otherMeal: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 },
}));
