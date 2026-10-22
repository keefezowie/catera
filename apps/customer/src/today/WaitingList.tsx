import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  addDays,
  changeDeadline,
  currency,
  jakartaDay,
  shortDate,
  waitingItems,
  type CustomerActionItem,
  type CustomerState,
  type Subscription,
  type WaitingItem,
} from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile, useTrack } from "@catera/mobile-core";
import { PressableRow, Text, themedStyles, useColors, useRowMotion, useStackedLayout } from "@catera/mobile-ui";
import { customerLink } from "../links";
import { openLink, pushSheet } from "../nav";
import { packageHref } from "../hrefs";
import { DecorativeIcon, GLYPH_INSET, ListCard } from "../layout";
import { GLYPH_CIRCLE } from "../layout/metrics";
import { weekdayName } from "../schedule/dates";
import { onReviewMarked } from "./reviewMark";

type Translate = (id: string, en: string) => string;
type IconName = ComponentProps<typeof Ionicons>["name"];

/** "Pilih menu Selasa 13 Okt", "Pilih menu Rabu dan Kamis", "Pilih menu 3 hari". */
function menuTitle(dates: string[], t: Translate): string {
  if (dates.length === 1)
    return t(`Pilih menu ${shortDate(dates[0], "id")}`, `Choose the menu for ${shortDate(dates[0], "en")}`);
  if (dates.length === 2)
    return t(
      `Pilih menu ${weekdayName(dates[0], "id")} dan ${weekdayName(dates[1], "id")}`,
      `Choose menus for ${weekdayName(dates[0], "en")} and ${weekdayName(dates[1], "en")}`,
    );
  return t(`Pilih menu ${dates.length} hari`, `Choose menus for ${dates.length} days`);
}

/** "Coba Bento selesai besok": when a trial ends, from today's point of view. */
function trialTitle(s: Subscription, today: string, t: Translate): string {
  const name = s.snapshot.offer.name;
  if (s.ends_on < today) return t(`${name} sudah selesai`, `${name} has ended`);
  if (s.ends_on === today) return t(`${name} selesai hari ini`, `${name} ends today`);
  if (s.ends_on === addDays(today, 1)) return t(`${name} selesai besok`, `${name} ends tomorrow`);
  return t(`${name} selesai ${shortDate(s.ends_on, "id")}`, `${name} ends on ${shortDate(s.ends_on, "en")}`);
}

/** One thing that waits on the customer: the words, the one action it offers and what that does. */
export type WaitingRow = {
  key: string;
  icon: IconName;
  title: string;
  detail: string;
  action: string;
  /** Only the renewal is urgent: it is the one thing on the screen that needs the customer now, so its action is charcoal. */
  urgent?: boolean;
  onPress: () => void;
};

/**
 * Everything that waits on the customer as rows, in the domain's order (menus to choose, plans to renew, trials ending,
 * then the review). The saved offline copy gives no menu rows (they come from the action read) and no review (it cannot
 * be sent), and a review row stays away until its dismissal mark has been read. Beranda's live slot takes the first row
 * and counts the rest; the full list shows them all.
 */
export function useWaitingRows({
  state,
  actions,
  offline,
  now,
}: {
  state: CustomerState;
  /** The action read; null while it failed, never loaded, or the screen shows the saved copy. */
  actions: CustomerActionItem[] | null;
  offline: boolean;
  now: Date;
}): WaitingRow[] {
  const { runtime, t, locale } = useMobile();
  const track = useTrack();
  const items = waitingItems(state, offline ? null : actions, now);
  const review = offline ? undefined : items.find((i) => i.kind === "review")?.subscription;
  const reviewKey = review ? runtime.storageKey(`review.${review.id}`) : "";
  const [reviewShown, setReviewShown] = useState<Record<string, boolean>>({});

  // The review sheet (`/ulasan/{id}`) marks the review dealt with; its row leaves at once, under the closing sheet.
  useEffect(() => onReviewMarked((key) => setReviewShown((s) => ({ ...s, [key]: false }))), []);

  useEffect(() => {
    if (!reviewKey) return;
    let live = true;
    void SecureStore.getItemAsync(reviewKey)
      .catch(() => null)
      .then((v) => {
        // Until the mark is read the row stays away, so a review already given or put off never flashes.
        if (live) setReviewShown((s) => ({ ...s, [reviewKey]: !v }));
      });
    return () => {
      live = false;
    };
  }, [reviewKey]);

  const today = jakartaDay(now);

  function rowFor(item: WaitingItem): WaitingRow | null {
    switch (item.kind) {
      case "menu": {
        const deadline = item.deadline ? changeDeadline(item.deadline, now, locale) : null;
        return {
          key: `menu:${item.subscriptionId}`,
          icon: "reorder-three-outline",
          title: menuTitle(item.dates, t),
          detail: deadline ? `${item.packageName} · ${t("sebelum", "before")} ${deadline}` : item.packageName,
          action: t("Pilih", "Choose"),
          onPress: () => openLink(customerLink(item.href)),
        };
      }
      case "renew": {
        const s = item.subscription;
        const offer = s.snapshot.offer;
        return {
          key: `renew:${s.id}`,
          icon: "refresh-outline",
          title: t(
            `${offer.name}, sisa ${s.remaining} hari`,
            `${offer.name}, ${s.remaining === 1 ? "1 day" : `${s.remaining} days`} left`,
          ),
          // The snapshot price is what the last plan cost; the server quotes the renewal at today's price, so the
          // row never lets this number pass for the renewal's.
          detail: t(
            `${offer.caterer} · harga terakhir ${currency(offer.price, locale)} per porsi`,
            `${offer.caterer} · last price ${currency(offer.price, locale)} per portion`,
          ),
          action: t("Perpanjang", "Renew"),
          urgent: true,
          onPress: () => {
            // Every way into a renewal counts, as Lanjutkan paket does on the recap and the plan page.
            track("renew_started");
            router.push(`/renew/${encodeURIComponent(s.id)}` as never);
          },
        };
      }
      case "trial": {
        const s = item.subscription;
        return {
          key: `trial:${s.id}`,
          // The full plan is another package to take, so the row carries the packages bag, not the renewal's arrow.
          icon: "bag-handle-outline",
          title: trialTitle(s, today, t),
          detail: `${s.snapshot.offer.caterer} · ${t("paket coba", "trial")}`,
          action: t("Beli paket", "Buy package"),
          onPress: () => router.push(packageHref(s.package_id, s.snapshot.offer.name) as never),
        };
      }
      case "review": {
        if (offline || !reviewShown[reviewKey]) return null;
        const caterer = item.subscription.snapshot.offer.caterer;
        return {
          key: `review:${item.subscription.id}`,
          icon: "star-outline",
          title: t(`Bagaimana ${caterer} selama ini?`, `How has ${caterer} been so far?`),
          detail: t("Bintang saja cukup, ulasan tertulis boleh dilewati", "Stars are enough; words are optional"),
          action: t("Nilai", "Rate"),
          onPress: () => pushSheet(`/ulasan/${encodeURIComponent(item.subscription.id)}` as never),
        };
      }
    }
  }

  const rows: WaitingRow[] = [];
  for (const item of items) {
    const row = rowFor(item);
    if (row) rows.push(row);
  }
  return rows;
}

/** The soft tone circle that names a row's kind; the action word, not the glyph, carries the weight. */
export function WaitingGlyph({ icon }: { icon: IconName }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.glyph}>
      <DecorativeIcon name={icon} size={20} color={c.forest} />
    </View>
  );
}

/**
 * A row's one action word. It sits beside the text, or under it (`stacked`: large text or a narrow phone) so the package
 * name keeps whole-word lines.
 */
export function WaitingAction({ row, stacked }: { row: WaitingRow; stacked: boolean }) {
  const c = useColors();
  return (
    <Text
      testID="waiting-action"
      variant="bodyStrong"
      /* forest: action (the row's action word) */
      style={[{ color: row.urgent ? c.charcoal : c.forest }, stacked && { marginTop: nativeLayout.space.xs }]}
    >
      {row.action}
    </Text>
  );
}

/**
 * "Perlu kamu urus", the whole list (the pushed screen behind Beranda's "n hal lainnya"): every waiting row in one card
 * of 72 rows with one action word each. When nothing waits it shows `empty`, if given.
 */
export function WaitingList({
  state,
  actions,
  offline,
  now,
  empty = null,
}: {
  state: CustomerState;
  /** The action read; null while it failed, never loaded, or the screen shows the saved copy. */
  actions: CustomerActionItem[] | null;
  offline: boolean;
  now: Date;
  /** What stands where the list would be when nothing waits (the full list says so; Beranda shows nothing). */
  empty?: ReactNode;
}) {
  const styles = useStyles();
  // Large text or a narrow phone: the action word drops under the text so the package name keeps whole-word lines.
  const stacked = useStackedLayout(340);
  // A row leaves after its action (a menu chosen, a plan renewed, a review given) and the rest move up. Rows never
  // enter on their own, and the saved offline copy never animates (Decision A).
  const motion = useRowMotion();
  const rowMotion = offline ? {} : { exiting: motion.exiting, layout: motion.layout };
  const rows = useWaitingRows({ state, actions, offline, now });
  if (!rows.length) return <>{empty}</>;

  return (
    <View testID="waiting-list">
      <ListCard inset={GLYPH_INSET}>
        {rows.map((row) => (
          <Animated.View key={row.key} testID="waiting-row-motion" {...rowMotion}>
            <PressableRow
              testID="waiting-row"
              accessibilityRole="button"
              accessibilityLabel={`${row.title}, ${row.detail}, ${row.action}`}
              onPress={row.onPress}
              style={styles.row}
            >
              <WaitingGlyph icon={row.icon} />
              <View testID="waiting-text" style={styles.text}>
                {/* Titles carry counts ("sisa 3 hari", "Pilih menu 2 hari"), so their digits are tabular like the detail's. */}
                <Text testID="waiting-title" variant="rowTitle" style={styles.figures}>
                  {row.title}
                </Text>
                <Text variant="meta" style={styles.figures}>
                  {row.detail}
                </Text>
                {stacked ? <WaitingAction row={row} stacked /> : null}
              </View>
              {stacked ? null : <WaitingAction row={row} stacked={false} />}
            </PressableRow>
          </Animated.View>
        ))}
      </ListCard>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: {
    minHeight: nativeLayout.row.media,
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    paddingVertical: nativeLayout.space.sm,
  },
  text: { flex: 1, minWidth: 0 },
  figures: { fontVariant: ["tabular-nums"] },
  glyph: {
    width: GLYPH_CIRCLE,
    height: GLYPH_CIRCLE,
    borderRadius: GLYPH_CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.sage,
  },
}));
