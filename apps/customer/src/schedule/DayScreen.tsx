import type { ReactNode } from "react";
import { Image, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { pushSheet } from "../nav";
import {
  canChangeDay,
  changeDeadline,
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
  SheetHeader,
  Text,
  themedStyles,
  useColors,
} from "@catera/mobile-ui";
import { signInSentence } from "../account/SignInFirst";
import { catererPhoneOf, openCatererChat } from "../help/ChatKatering";
import { packageHref } from "../hrefs";
import { photoUri } from "../today/Plate";
import { DaySkeleton } from "../skeletons";
import { DayActions, type DayAction } from "./DayActionRow";
import { dayClosed, dayVisibleActions } from "./dayActions";
import { DAY_DOT, DAY_PHOTO_RADIUS, DAY_PHOTO_RATIO, DAY_WELL_MIN, DAY_WELL_RADIUS } from "./dayMetrics";

/**
 * One delivery day, a form sheet over the page that opened it: the day under the handle, the meal's photo, what it is,
 * where it stands, where it goes, and the day's actions as visible circles.
 */
export function DayScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const { id } = params;
  const { actor, ready, t } = useMobile();
  const c = useColors();
  // The title row keeps the day the link carried while the session is read; only the day itself waits.
  const carried = linkTitle(params);
  if (!ready)
    return (
      <Sheet title={carried ?? t("Hari", "Day")} swapKey="loading" context={null}>
        <DaySkeleton />
      </Sheet>
    );
  // Signed out, the sheet keeps the day its link carried as its title ("Senin 12 Okt").
  if (!actor)
    return (
      <Sheet title={carried ?? t("Hari", "Day")} swapKey="signin">
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
 * The sheet's frame: the title row (the day, the package under it once known) over the scrolling body. The body sits in
 * one FadeSwap keyed by `swapKey`, so the day fades in from its skeleton as one block. The context line is held to one
 * line (`holdContextLine`) while the day is read, so the header keeps its height when the package lands.
 */
function Sheet({
  title,
  context,
  swapKey,
  children,
}: {
  title: string;
  context?: string | null;
  swapKey: string;
  children: ReactNode;
}) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader title={title} context={context} holdContextLine closeLabel={t("Tutup", "Close")} />
      <SheetBody>
        <FadeSwap swapKey={swapKey} style={{ gap: 24 }}>
          {children}
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

  // While the day loads the title row keeps the day its link carried. A failed read or a day that is not there names the
  // sheet "Hari": the carried day was never checked against a record.
  if (!d)
    return state.loading ? (
      <Sheet title={carried ?? t("Hari", "Day")} swapKey="loading" context={null}>
        <DaySkeleton />
      </Sheet>
    ) : (
      <Sheet title={t("Hari", "Day")} swapKey="missing">
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
    menu: (meal) =>
      router.push(
        (picks
          ? `/subscriptions/${d.subscription_id}/menu?date=${d.service_date}&meal=${meal}`
          : packageHref(d.offer.id, d.offer.name)) as never,
      ),
  };
  const actions: DayAction[] = dayVisibleActions(d, now, t).map(({ key, label, meal }) => ({
    key,
    label,
    onPress: () => press[key](meal),
  }));

  return (
    <Sheet title={shortDate(d.service_date, locale)} context={d.offer.name} swapKey="ready">
      {photo ? (
        <Image
          testID="day-photo"
          source={{ uri: photoUri(photo, runtime.apiBase) }}
          style={styles.photo}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {meals.map((m) => {
        const menu = d.offer.menus?.find((x) => x.meal === m.meal);
        const dishes = menu && menuIsSet(menu) ? storyDishes(menu) : null;
        const status = statusLabel(mealJourney(m).stage === "arrived" ? "arrived" : m.status, locale);
        const line = [`${status} ${d.offer.windows?.[m.meal] ?? ""}`.trim(), change].filter(Boolean).join(" · ");
        return (
          <View key={m.meal} style={{ gap: 4 }}>
            <Text variant="meta">
              {mealLabel(m.meal, locale)} · {d.offer.caterer}
            </Text>
            <Text variant="heroTitle">{dishes?.title || t("Menu belum diisi", "Menu not set yet")}</Text>
            {dishes?.sides.length ? <Text variant="bodyL">{dishes.sides.join(", ")}</Text> : null}
            <View style={styles.state}>
              <View
                testID={`day-state-dot-${m.meal}`}
                style={[styles.dot, { backgroundColor: m.status === "issue" ? c.danger : c.muted }]}
              />
              <Text variant="meta" testID={`day-state-${m.meal}`} style={[styles.stateText, { fontVariant: ["tabular-nums"] }]}>
                {line}
              </Text>
            </View>
          </View>
        );
      })}
      <View testID="day-address" style={styles.well}>
        <Ionicons name="location-outline" size={20} color={c.charcoal} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="meta">{t("Diantar ke", "Delivered to")}</Text>
          <Text variant="bodyL">{[d.address.label, d.address.line, d.address.area].filter(Boolean).join(" · ")}</Text>
          {d.address.instructions ? <Text variant="meta">{d.address.instructions}</Text> : null}
        </View>
      </View>
      <DayActions actions={actions} />
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
