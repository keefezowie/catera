import { useEffect, useState, type ComponentProps } from "react";
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
import { useMobile, useTrack } from "@catera/mobile-core";
import {
  fonts,
  PressableRow,
  Text,
  themedStyles,
  useColors,
  useRowMotion,
  useStackedLayout,
} from "@catera/mobile-ui";
import { customerLink } from "../links";
import { openLink, pushSheet } from "../nav";
import { packageHref } from "../hrefs";
import { weekdayName } from "../schedule/dates";
import { onReviewMarked } from "./reviewMark";

type Translate = (id: string, en: string) => string;
type IconName = ComponentProps<typeof Ionicons>["name"];

/** An 18pt forest section title on Beranda ("Perlu kamu urus", "Berikutnya"). */
export function SectionTitle({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}

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

type Row = {
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
 * "Perlu kamu urus": everything that waits on the customer, as one bordered list with one action word per row, in the
 * domain's order (menus to choose, plans to renew, trials ending, then the review). Hidden when nothing waits. The
 * saved offline copy gives no menu rows (they come from the action read) and no review (it cannot be sent).
 */
export function WaitingList({
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
}) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const track = useTrack();
  // Large text or a narrow phone: the action word drops under the text so the package name keeps whole-word lines.
  const stacked = useStackedLayout(340);
  // A row leaves after its action (a menu chosen, a plan renewed, a review given) and the rest move up. Rows never
  // enter on their own, and the saved offline copy never animates (Decision A).
  const motion = useRowMotion();
  const rowMotion = offline ? {} : { exiting: motion.exiting, layout: motion.layout };
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
  const rows: Row[] = [];
  for (const item of items) {
    const row = rowFor(item);
    if (row) rows.push(row);
  }
  if (!rows.length) return null;

  function rowFor(item: WaitingItem): Row | null {
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

  const action = (row: Row) => (
    <Text
      testID="waiting-action"
      /* forest: action (the row's action word) */
      style={[styles.action, { color: row.urgent ? c.charcoal : c.forest }, stacked && { marginTop: 4 }]}
    >
      {row.action}
    </Text>
  );

  return (
    <View style={{ gap: 10 }}>
      <SectionTitle>{t("Perlu kamu urus", "Needs you")}</SectionTitle>
      <View testID="waiting-list" style={styles.card}>
        {rows.map((row, i) => (
          <Animated.View key={row.key} testID="waiting-row-motion" {...rowMotion}>
            <PressableRow
              testID="waiting-row"
              accessibilityRole="button"
              accessibilityLabel={`${row.title}, ${row.detail}, ${row.action}`}
              onPress={row.onPress}
              style={[styles.row, i > 0 && styles.divider]}
            >
              <View style={styles.icon}>
                <Ionicons name={row.icon} size={18} color={c.forest} />
              </View>
              <View testID="waiting-text" style={{ flex: 1, gap: 2 }}>
                <Text testID="waiting-title" style={styles.title}>
                  {row.title}
                </Text>
                <Text variant="caption" style={styles.detail}>
                  {row.detail}
                </Text>
                {stacked ? action(row) : null}
              </View>
              {stacked ? null : action(row)}
            </PressableRow>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  sectionTitle: { fontSize: 18, lineHeight: 24, fontFamily: fonts.bold, color: c.charcoal },
  // A body card on theme colours: a border, no shadow (the hero is the screen's one raised surface).
  card: {
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  // A soft tonal circle, not a filled badge: the icon names the kind of row, the action word carries the weight.
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.sage,
  },
  // Titles carry counts ("sisa 3 hari", "Pilih menu 2 hari"), so their digits are tabular like the detail's.
  title: { fontSize: 15, lineHeight: 20, fontFamily: fonts.bold, color: c.charcoal, fontVariant: ["tabular-nums"] },
  detail: { fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
  action: { fontSize: 13, lineHeight: 18, fontFamily: fonts.bold },
}));
