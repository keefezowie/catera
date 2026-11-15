import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useIsFocused } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { nativeLayout } from "@catera/design-tokens";
import { jakartaDay, shortDate, type Locale, type Subscription } from "@catera/domain";
import { plural, useMobile, useTrack } from "@catera/mobile-core";
import { Button, fontFor, Photo, Text, themedStyles, useColors, cardEdge } from "@catera/mobile-ui";
import { photoUri } from "./Plate";

/** Whole days from one Jakarta calendar day to another (negative when `to` is earlier). */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** How near the end is, from the plan's own end date: "Habis besok", "Habis 3 hari lagi · Kamis 19 Nov", "Sudah selesai Kamis 12 Nov". */
export function endNote(endsOn: string, today: string, locale: Locale, t: (id: string, en: string) => string): string {
  const left = daysBetween(today, endsOn);
  const day = shortDate(endsOn, locale);
  if (left < 0) return t(`Sudah selesai ${day}`, `Finished ${day}`);
  if (left === 0) return t("Habis hari ini", "Ends today");
  if (left === 1) return t("Habis besok", "Ends tomorrow");
  return t(`Habis ${left} hari lagi · ${day}`, `Ends in ${plural(left, "day")} · ${day}`);
}

/**
 * "Paket selesai": a one-time look back at a full plan that ended in the last 14 days, leading to its renewal.
 * `candidates` come from `recapCandidates`, newest first. One card per visit: the newest plan whose seen mark
 * (`recap.{id}`) is not stored yet. Nothing renders until those marks are read, so a seen recap never flashes.
 * The mark is written when the card first shows with Beranda in front; the card then stays for the rest of this
 * Beranda visit.
 */
export function RecapCard({
  candidates,
  onShownChange,
}: {
  candidates: Subscription[];
  /**
   * Hears whether the card is on the page: undefined while the seen marks are read, then true or false. An empty
   * Beranda leaves its mascot out while the card's food photo leads.
   */
  onShownChange?: (shown: boolean | undefined) => void;
}) {
  const { runtime, t, locale } = useMobile();
  const track = useTrack();
  const c = useColors();
  const styles = useStyles();
  const ids = candidates.map((s) => s.id).join(",");
  // undefined until the marks are read; null when every candidate was already seen.
  const [shownId, setShownId] = useState<string | null | undefined>(undefined);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    // Decided once per visit: a later read of the customer never swaps the card for another plan.
    if (shownId !== undefined || !ids) return;
    const list = ids.split(",");
    let live = true;
    void Promise.all(
      list.map((id) => SecureStore.getItemAsync(runtime.storageKey(`recap.${id}`)).catch(() => null)),
    ).then((marks) => {
      if (!live) return;
      const i = marks.findIndex((m) => !m);
      setShownId(i >= 0 ? list[i] : null);
    });
    return () => {
      live = false;
    };
  }, [ids, shownId, runtime]);

  // A renewed plan drops out of the candidates while Beranda is open, and its card goes with it.
  const sub = candidates.find((s) => s.id === shownId);
  // Beranda stays mounted under a pushed screen or the sign-in modal, where the card renders unseen. The mark waits
  // until Beranda is in front with the card on it, and is written once.
  const focused = useIsFocused();
  const visible = !!sub && !closed && focused;
  const marked = useRef(false);
  useEffect(() => {
    if (!visible || !shownId || marked.current) return;
    marked.current = true;
    void SecureStore.setItemAsync(runtime.storageKey(`recap.${shownId}`), "seen").catch(() => undefined);
  }, [visible, shownId, runtime]);

  const shown = shownId === undefined ? undefined : !!sub && !closed;
  useEffect(() => {
    onShownChange?.(shown);
  }, [shown, onShownChange]);

  if (!sub || closed) return null;
  const offer = sub.snapshot.offer;
  const span = daysBetween(sub.starts_on, sub.ends_on) + 1;
  const image = offer.image ? photoUri(offer.image, runtime.apiBase) : "";

  return (
    <View testID="recap-card" style={styles.card}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        {image ? (
          <View style={styles.photo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Photo testID="recap-photo" uri={image} style={StyleSheet.absoluteFill} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{t("Paket selesai", "Plan finished")}</Text>
          <Text style={{ fontFamily: fontFor("700") }}>
            {offer.name} · {offer.caterer}
          </Text>
          <Text selectable style={{ color: c.muted, fontVariant: ["tabular-nums"] }}>
            {/* A one-day plan names its day once. */}
            {sub.starts_on === sub.ends_on
              ? shortDate(sub.starts_on, locale)
              : t(`${shortDate(sub.starts_on, locale)} sampai ${shortDate(sub.ends_on, locale)}`, `${shortDate(sub.starts_on, locale)} to ${shortDate(sub.ends_on, locale)}`)}
          </Text>
          <Text testID="recap-end" style={{ color: c.muted }}>
            {endNote(sub.ends_on, jakartaDay(new Date()), locale, t)}
          </Text>
          {/* Only the plan's own span: the read cannot count an old plan's meals (Ruling D5). */}
          {sub.ends_on < jakartaDay(new Date()) ? (
            <Text testID="recap-span" style={{ color: c.muted }}>
              {t(`${span} hari bersama ${offer.caterer}`, `${plural(span, "day")} with ${offer.caterer}`)}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Button
          label={t("Perpanjang", "Renew")}
          onPress={() => {
            track("renew_started");
            router.push(`/renew/${encodeURIComponent(sub.id)}` as never);
          }}
        />
        <Button variant="text" label={t("Tutup", "Close")} onPress={() => setClosed(true)} />
      </View>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  // A body card on theme colours, never a mood surface: the hero stays the one raised, mood-coloured card.
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    padding: 16,
    gap: 12,
    ...cardEdge(c),
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: c.sage,
  },
}));
