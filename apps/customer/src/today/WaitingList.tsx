import { useEffect, useState, type ComponentProps } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  addDays,
  changeDeadline,
  currency,
  errorLabel,
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
  Button,
  Field,
  fonts,
  PressableRow,
  PressableScale,
  Sheet,
  Text,
  themedStyles,
  useColors,
} from "@catera/mobile-ui";
import { customerLink } from "../links";
import { openLink } from "../nav";
import { packageHref } from "../hrefs";
import { weekdayName } from "../schedule/dates";

type Translate = (id: string, en: string) => string;
type IconName = ComponentProps<typeof Ionicons>["name"];

/** An 18pt forest section title on Beranda ("Menunggu Anda", "Berikutnya"). */
export function SectionTitle({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}

/** The plan a menu action links to (`/subscriptions/{id}/menu`), as the domain groups menu rows by it. */
function planOf(item: CustomerActionItem): string {
  const m = /^\/subscriptions\/([^/?#]+)/.exec(item.href);
  if (!m) return item.id;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
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
  /** Only the renewal takes the sunrise ink: it is the one thing on the screen that needs the customer now. */
  sunrise?: boolean;
  onPress: () => void;
};

/**
 * "Menunggu Anda": everything that waits on the customer, as one bordered list with one action word per row, in the
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
  const items = waitingItems(state, offline ? null : actions, now);
  const review = offline ? undefined : items.find((i) => i.kind === "review")?.subscription;
  const reviewKey = review ? runtime.storageKey(`review.${review.id}`) : "";
  const [reviewShown, setReviewShown] = useState<Record<string, boolean>>({});
  const [sheetOpen, setSheetOpen] = useState(false);

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
        const link = (actions ?? []).find(
          (a) =>
            a.kind === "menu_choice_due" &&
            a.status === "selection_due" &&
            a.serviceDate === item.dates[0] &&
            planOf(a) === item.subscriptionId,
        );
        return {
          key: `menu:${item.subscriptionId}`,
          icon: "reorder-three-outline",
          title: menuTitle(item.dates, t),
          detail: deadline ? `${item.packageName} · ${t("sebelum", "before")} ${deadline}` : item.packageName,
          action: t("Pilih", "Choose"),
          onPress: () => {
            if (link) openLink(customerLink(link.href));
          },
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
          detail: `${offer.caterer} · ${currency(offer.price, locale)} ${t("per porsi", "per portion")}`,
          action: t("Perpanjang", "Renew"),
          sunrise: true,
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
          icon: "refresh-outline",
          title: trialTitle(s, today, t),
          detail: `${s.snapshot.offer.caterer} · ${t("paket coba", "trial")}`,
          action: t("Paket penuh", "Full plan"),
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
          detail: t("Ulasan singkat, 1 menit", "A short review, 1 minute"),
          action: t("Nilai", "Rate"),
          onPress: () => setSheetOpen(true),
        };
      }
    }
  }

  function hideReview(value: "dismissed" | "done") {
    setSheetOpen(false);
    setReviewShown((s) => ({ ...s, [reviewKey]: false }));
    void SecureStore.setItemAsync(reviewKey, value).catch(() => undefined);
  }

  return (
    <View style={{ gap: 10 }}>
      <SectionTitle>{t("Menunggu Anda", "Waiting on you")}</SectionTitle>
      <View testID="waiting-list" style={styles.card}>
        {rows.map((row, i) => (
          <PressableRow
            key={row.key}
            testID="waiting-row"
            accessibilityRole="button"
            accessibilityLabel={`${row.title}, ${row.detail}, ${row.action}`}
            onPress={row.onPress}
            style={[styles.row, i > 0 && styles.divider]}
          >
            <View style={styles.icon}>
              <Ionicons name={row.icon} size={18} color={c.forest} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text testID="waiting-title" style={styles.title}>
                {row.title}
              </Text>
              <Text variant="caption" style={styles.detail}>
                {row.detail}
              </Text>
            </View>
            <Text testID="waiting-action" style={[styles.action, { color: row.sunrise ? c.sunriseInk : c.forest }]}>
              {row.action}
            </Text>
          </PressableRow>
        ))}
      </View>
      {review && reviewShown[reviewKey] ? (
        <ReviewSheet
          subscription={review}
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onDone={hideReview}
        />
      ) : null}
    </View>
  );
}

/** The review form, in a sheet: the stars, a few words and "Kirim ulasan", with "Nanti saja" to put it off for good. */
function ReviewSheet({
  subscription,
  visible,
  onClose,
  onDone,
}: {
  subscription: Subscription;
  visible: boolean;
  onClose: () => void;
  onDone: (value: "dismissed" | "done") => void;
}) {
  const { command, t, locale } = useMobile();
  const palette = useColors();
  const styles = useStyles();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const caterer = subscription.snapshot.offer.caterer;

  async function send() {
    setBusy(true);
    setError("");
    try {
      await command("review.save", {
        subscriptionId: subscription.id,
        rating,
        food: rating,
        delivery: rating,
        value: rating,
        body,
      });
      onDone("done");
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t(`Ulasan untuk ${caterer}`, `Your review of ${caterer}`)}
      closeLabel={t("Tutup", "Close")}
    >
      <View testID="review-sheet" style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <PressableScale
              key={n}
              accessibilityRole="button"
              accessibilityLabel={t(`${n} bintang`, `${n} stars`)}
              accessibilityState={{ selected: n <= rating }}
              haptic="select"
              onPress={() => setRating(n)}
              style={styles.star}
            >
              {/* Outline + muted (5.8:1) for unselected, filled + ink for selected: shape and colour both carry the state. */}
              <Ionicons
                name={n <= rating ? "star" : "star-outline"}
                size={28}
                color={n <= rating ? palette.sunriseInk : palette.muted}
              />
            </PressableScale>
          ))}
        </View>
        <Field
          label={t("Cerita singkat (opsional)", "A few words (optional)")}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={1000}
        />
        {error ? (
          <Text selectable style={{ color: palette.danger }}>
            {error}
          </Text>
        ) : null}
        <Button label={t("Kirim ulasan", "Send review")} disabled={busy} onPress={() => void send()} />
        <Button variant="text" label={t("Nanti saja", "Not now")} disabled={busy} onPress={() => onDone("dismissed")} />
      </View>
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  sectionTitle: { fontSize: 18, lineHeight: 24, fontFamily: fonts.bold, color: c.forest },
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
  title: { fontSize: 15, lineHeight: 20, fontFamily: fonts.bold, color: c.charcoal },
  detail: { fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
  action: { fontSize: 13, lineHeight: 18, fontFamily: fonts.bold },
  star: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
}));
