import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { router, useIsFocused } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { shortDate, type Subscription } from "@catera/domain";
import { useMobile, useTrack } from "@catera/mobile-core";
import { Button, fontFor, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { photoUri } from "./Plate";

/**
 * "Paket selesai": a one-time look back at a full plan that ended in the last 14 days, leading to its renewal.
 * `candidates` come from `recapCandidates`, newest first. One card per visit: the newest plan whose seen mark
 * (`recap.{id}`) is not stored yet. Nothing renders until those marks are read, so a seen recap never flashes.
 * The mark is written when the card first shows with Beranda in front; the card then stays for the rest of this
 * Beranda visit.
 */
export function RecapCard({ candidates }: { candidates: Subscription[] }) {
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

  if (!sub || closed) return null;
  const offer = sub.snapshot.offer;
  const image = offer.image ? photoUri(offer.image, runtime.apiBase) : "";

  return (
    <View testID="recap-card" style={styles.card}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        {image ? (
          <View style={styles.photo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Image
              testID="recap-photo"
              accessibilityIgnoresInvertColors
              source={{ uri: image }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
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
              : `${shortDate(sub.starts_on, locale)} – ${shortDate(sub.ends_on, locale)}`}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Button
          label={t("Lanjutkan paket", "Continue this plan")}
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
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 16,
    gap: 12,
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
