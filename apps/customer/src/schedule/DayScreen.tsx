import { Fragment, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AccessibilityInfo, type Text as RNText, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { closeSheetFor, pushSheet } from "../nav";
import {
  canChangeDay,
  changeDeadline,
  dayLabel,
  jakartaDay,
  mealJourney,
  mealLabel,
  menuIsSet,
  shortDate,
  statusLabel,
  storyDishes,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  linkTitle,
  ReadError,
  SheetBody,
  SheetHandle,
  Text,
  themedStyles,
  useColors,
  useSheetTitleFocus,
  useToastAnchor,
  Photo,
} from "@catera/mobile-ui";
import { signInSentence } from "../account/SignInFirst";
import { catererPhoneOf, openCatererChat } from "../help/ChatKatering";
import { packageHref } from "../hrefs";
import { photoUri } from "../today/Plate";
import { DaySkeleton } from "../skeletons";
import { DayActions, type DayAction } from "./DayActionRow";
import { dayClosed, dayVisibleActions } from "./dayActions";
import {
  DAY_DOT,
  DAY_GAP,
  DAY_MEAL_GAP,
  DAY_PHOTO_RADIUS,
  DAY_PHOTO_RATIO,
  DAY_WELL_MIN,
  DAY_WELL_RADIUS,
} from "./dayMetrics";
import { DecorativeIcon } from "../layout";

/**
 * One delivery day, a form sheet over the page that opened it. Under the handle the first text is the day's own line
 * ("Jumat 23 Okt · Makan siang · caterer"); then the photo, the dish, where the day stands, where it goes, and the
 * day's actions as visible circles. There is no title row: the sheet has no bar of its own.
 */
export function DayScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const { id } = params;
  const { actor, ready, t } = useMobile();
  const c = useColors();
  // The day the link carried ("Senin 12 Okt") names the loading sheet to a screen reader, never the sheet's look.
  const carried = linkTitle(params);
  if (!ready) return <Sheet swapKey="loading">{loadingBody(carried, t)}</Sheet>;
  if (!actor)
    return (
      <Sheet swapKey="signin">
        <Text style={{ color: c.muted }}>{signInSentence(t)}</Text>
        <Button
          label={t("Masuk", "Sign in")}
          onPress={() => router.push({ pathname: "/login", params: { next: `/hari/${id}` } } as never)}
        />
      </Sheet>
    );
  return <Day key={`${actor.id}:${id}`} id={id} carried={carried} />;
}

/**
 * The body while the session or the day is read: the skeleton, with a header for the screen reader from the first frame
 * (the day the link carried, else "Hari"). It is a body of the one `Sheet` the loaded day uses, not a sheet of its own,
 * so the day swaps in as fresh content of the same sheet and the focus follows it (`Sheet` re-sends it on a swap).
 */
const loadingBody = (carried: string | undefined, t: (id: string, en: string) => string) =>
  function Loading(focus: RefObject<RNText | null>) {
    return <DaySkeleton header={carried ?? t("Hari", "Day")} focus={focus as unknown as RefObject<View>} />;
  };

/**
 * The sheet's frame: Android's drag handle (iOS draws the system grabber), then the scrolling body. The body sits in one
 * FadeSwap keyed by `swapKey`, so the day fades in from its skeleton as one block. The screen reader starts on the
 * element that takes `focus` when the sheet has risen (`useSheetTitleFocus`: the skeleton's header while the day is
 * read, then the day's line), and the toast knows it sits over a sheet, as a sheet header would tell it. That focus is
 * sent once, when the sheet rises; a day read slower than that lands its header after it, so the focus is sent again
 * whenever the body swaps to fresh content.
 */
function Sheet({
  swapKey,
  children,
}: {
  swapKey: string;
  children: ReactNode | ((focus: RefObject<RNText | null>) => ReactNode);
}) {
  const focus = useSheetTitleFocus();
  useToastAnchor({});
  const first = useRef(swapKey);
  useEffect(() => {
    // The first key's focus is the sheet's own (on present); only a swap to later content moves it again.
    if (swapKey === first.current) return;
    if (focus.current) AccessibilityInfo.sendAccessibilityEvent(focus.current, "focus");
  }, [swapKey, focus]);
  const ios = process.env.EXPO_OS === "ios";
  return (
    <View style={{ flex: 1 }}>
      {ios ? <View style={{ height: 12 }} /> : <SheetHandle />}
      <SheetBody>
        <FadeSwap swapKey={swapKey} style={{ gap: DAY_GAP }}>
          {typeof children === "function" ? children(focus) : children}
        </FadeSwap>
      </SheetBody>
    </View>
  );
}

function Day({ id, carried }: { id: string; carried: string | undefined }) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const state = useData(`day:${id}`, () => runtime.api.customer(`?deliveryId=${encodeURIComponent(id)}`));
  const d = state.data?.deliveries.find((x) => x.id === id);

  if (!d)
    return state.loading ? (
      <Sheet swapKey="loading">{loadingBody(carried, t)}</Sheet>
    ) : (
      <Sheet swapKey="missing">
        {/* A failed read leads with the puzzled mascot; a day that is not there is not a failure and has none. */}
        {state.error ? (
          <ReadError art message={state.error} onRetry={() => void state.reload()} />
        ) : (
          <Text style={{ color: c.muted }}>{t("Pengantaran tidak ditemukan.", "Delivery not found.")}</Text>
        )}
      </Sheet>
    );

  const now = new Date();
  const meals = (d.meals ?? []).filter((m) => m.status !== "cancelled");
  const photo = d.offer.menus?.find((m) => m.meal === meals[0]?.meal)?.image || d.offer.image;
  const closed = dayClosed(d);
  const can = canChangeDay(d, now);
  // One cut-off for the whole day: until when it can change, or that it no longer can. A closed day says neither.
  const deadline = can.date || can.address ? changeDeadline(d.cutoff_at, now, locale) : null;
  const change = closed
    ? ""
    : deadline
      ? t(`bisa diubah sampai ${deadline}`, `can be changed until ${deadline}`)
      : t("sudah tidak bisa diubah", "can no longer be changed");
  const id64 = encodeURIComponent(d.id);
  const picks = d.offer.menuSelectionMode === "customer";
  const press: Record<DayAction["key"], (meal: "lunch" | "dinner") => void> = {
    change: () => pushSheet(`/ubah-hari/${id64}` as never),
    address: () => pushSheet(`/ubah-hari/${id64}?mode=address` as never),
    chat: () => openCatererChat(catererPhoneOf(d)),
    report: (meal) => pushSheet(`/masalah/${id64}?meal=${meal}` as never),
    // The menu is a page of the tab under this sheet: the sheet closes and the page opens there (`closeSheetFor`), so it is
    // never opened behind a sheet that stays up.
    menu: (meal) =>
      closeSheetFor(
        picks
          ? `/subscriptions/${d.subscription_id}/menu?date=${d.service_date}&meal=${meal}`
          : packageHref(d.offer.id, d.offer.name),
      ),
  };
  const actions: DayAction[] = dayVisibleActions(d, now, t).map(({ key, label, meal }) => ({
    key,
    label,
    onPress: () => press[key](meal),
  }));

  const date = shortDate(d.service_date, locale);
  const spoken = dayLabel(d.service_date, jakartaDay(now), locale);
  // A day with no meal still on (cancelled, or the read lists none) is drawn as one block named by its package.
  const blocks: { meal: "lunch" | "dinner" | null; status: string }[] = meals.length
    ? meals.map((m) => ({ meal: m.meal, status: m.status }))
    : [{ meal: null, status: d.status }];
  return (
    <Sheet swapKey="ready">
      {(focus) => (
        <>
          {photo ? (
            <Photo testID="day-photo" uri={photoUri(photo, runtime.apiBase)} style={styles.photo} />
          ) : null}
          {blocks.map((block, i) => {
            const m = meals.find((x) => x.meal === block.meal);
            const menu = d.offer.menus?.find((x) => x.meal === block.meal);
            const dishes = menu && menuIsSet(menu) ? storyDishes(menu) : null;
            const status = m
              ? statusLabel(mealJourney(m).stage === "arrived" ? "arrived" : m.status, locale)
              : block.status === "cancelled"
                ? statusLabel("cancelled", locale)
                : "";
            const window = block.meal ? (d.offer.windows?.[block.meal] ?? "") : "";
            const line = [`${status} ${window}`.trim(), change].filter(Boolean).join(" · ");
            const mealName = block.meal ? mealLabel(block.meal, locale) : null;
            const meta = [date, mealName, d.offer.caterer].filter(Boolean).join(" · ");
            const first = i === 0;
            const key = block.meal ?? "day";
            return (
              <Fragment key={key}>
                <View style={{ gap: DAY_MEAL_GAP }}>
                  {/* The first block's line names the sheet to a screen reader: the full day, then the meal. */}
                  <View
                    ref={first ? (focus as unknown as RefObject<View>) : undefined}
                    accessible={first}
                    accessibilityRole={first ? "header" : undefined}
                    accessibilityLabel={first ? [spoken, mealName, d.offer.caterer].filter(Boolean).join(", ") : undefined}
                  >
                    <Text variant="meta">{meta}</Text>
                  </View>
                  <Text variant="heroTitle">
                    {block.meal ? dishes?.title || t("Menu belum diisi", "Menu not set yet") : d.offer.name}
                  </Text>
                  {dishes?.sides.length ? <Text variant="bodyL">{dishes.sides.join(", ")}</Text> : null}
                  {line ? (
                    <View style={styles.state}>
                      <View
                        testID={`day-state-dot-${key}`}
                        style={[styles.dot, { backgroundColor: block.status === "issue" ? c.danger : c.muted }]}
                      />
                      <Text variant="meta" testID={`day-state-${key}`} style={[styles.stateText, { fontVariant: ["tabular-nums"] }]}>
                        {line}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {/* The day's actions sit directly under the first meal's state line, before the address and any further meal, so
                    they are in view at the sheet's first detent (a second meal or the address would push them off it). */}
                {first ? <DayActions actions={actions} /> : null}
              </Fragment>
            );
          })}
          <View testID="day-address" style={styles.well}>
            <DecorativeIcon name="location-outline" size={20} color={c.charcoal} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="meta">{t("Diantar ke", "Delivered to")}</Text>
              <Text variant="bodyL">{[d.address.label, d.address.line, d.address.area].filter(Boolean).join(" · ")}</Text>
              {d.address.instructions ? <Text variant="meta">{d.address.instructions}</Text> : null}
            </View>
          </View>
        </>
      )}
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  photo: { width: "100%", aspectRatio: DAY_PHOTO_RATIO, borderRadius: DAY_PHOTO_RADIUS, backgroundColor: c.sage },
  state: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  stateText: { flex: 1 },
  dot: { width: DAY_DOT, height: DAY_DOT, borderRadius: DAY_DOT / 2, marginTop: 5 },
  well: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: DAY_WELL_MIN,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: DAY_WELL_RADIUS,
    backgroundColor: c.canvas,
  },
}));
