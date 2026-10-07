import { useState } from "react";
import { Image, Pressable, StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { router } from "expo-router";
import { errorLabel, type Plate as PlateData } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, colors, FONT, Text } from "@catera/mobile-ui";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** HH.MM in Asia/Jakarta, or "" for an unreadable timestamp. */
export function jakartaClock(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? "");
  if (Number.isNaN(t)) return "";
  const d = new Date(t + JAKARTA_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Photos from the API may be site-relative ("/food/…"). */
export function photoUri(src: string, apiBase: string): string {
  return src.startsWith("/") && !src.startsWith("//") ? apiBase + src : src;
}

/** Sunrise is reserved for "needs you now": Sudah sampai and Perpanjang. */
export function SunriseButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.sunrise, disabled && { opacity: 0.6 }, pressed && { opacity: 0.85 }, style]}
    >
      <RNText style={styles.sunriseLabel}>{label}</RNText>
    </Pressable>
  );
}

/** Plain-language messages for the confirm/react codes errorLabel does not cover. */
export function commandError(e: unknown, locale: "id" | "en", t: (id: string, en: string) => string) {
  const code = (e as { code?: string }).code || (e as Error).message;
  if (code === "NOT_ALLOWED")
    return t(
      "Belum bisa sekarang. Tunggu jam antar dimulai, atau tunggu balasan atas laporan Anda.",
      "Not yet. Wait until the delivery window starts, or for a reply to your report.",
    );
  if (code === "NOT_AVAILABLE")
    return t("Pengantaran ini sudah tidak bisa diubah.", "This delivery can no longer be changed.");
  return errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again.");
}

type Reaction = "enak" | "biasa" | "kurang";

function Face({ kind, color }: { kind: Reaction; color: string }) {
  const mouth =
    kind === "enak" ? "M8 14c1.2 1.6 2.5 2.3 4 2.3s2.8-.7 4-2.3" : kind === "biasa" ? "M8.5 15h7" : "M8 16.2c1.2-1.5 2.5-2.2 4-2.2s2.8.7 4 2.2";
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={9} cy={10} r={0.6} fill={color} />
      <Circle cx={15} cy={10} r={0.6} fill={color} />
      <Path d={mouth} />
    </Svg>
  );
}

const sentences = (p: PlateData, t: (id: string, en: string) => string): [string, string] => {
  switch (p.state) {
    case "cooking":
      return [
        t("Sedang dimasak", "Being cooked"),
        t(`diantar ${p.window} ke ${p.addressLabel}`, `delivered ${p.window} to ${p.addressLabel}`),
      ];
    case "on_the_way":
      return [t("Sedang diantar", "On the way"), t(`tiba sekitar ${p.window}`, `arriving around ${p.window}`)];
    case "due":
      return [t("Seharusnya sudah tiba", "Should have arrived"), p.window];
    case "arrived": {
      const at = jakartaClock(p.confirmedAt);
      return [t("Sudah sampai", "Arrived"), at ? t(`pukul ${at}`, `at ${at}`) : ""];
    }
    case "reported": {
      const status = p.issue?.status;
      return [
        t("Laporan terkirim", "Report sent"),
        status === "responded"
          ? t("Dibalas katering", "The caterer replied")
          : status === "escalated"
            ? t("Ditinjau Catera", "Catera is reviewing")
            : t("Menunggu balasan katering", "Waiting for the caterer"),
      ];
    }
    default:
      return [p.packageName, p.window];
  }
};

/** Today's plate: the photo with one status sentence, the dishes and one action. */
export function Plate({ plate, apiBase, offline }: { plate: PlateData; apiBase: string; offline?: boolean }) {
  const { command, t, locale } = useMobile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentence, second] = sentences(plate, t);
  const departed = plate.state === "on_the_way" ? jakartaClock(plate.departedAt) : "";
  const meal = plate.meal === "dinner" ? t("Makan malam", "Dinner") : t("Makan siang", "Lunch");

  async function run(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await command(action, { deliveryId: plate.deliveryId, meal: plate.meal, ...payload });
    } catch (e) {
      setError(commandError(e, locale, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.photo}>
        {plate.image ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: photoUri(plate.image, apiBase) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.scrimSoft} />
        {departed ? (
          <View style={styles.chip}>
            <RNText style={styles.chipLabel}>{t(`Berangkat ${departed}`, `Left at ${departed}`)}</RNText>
          </View>
        ) : null}
        {/* The overlay carries its own dark ground, so every wrapped line sits on it. */}
        <View style={styles.overlay} testID="plate-overlay">
          <RNText style={styles.meal}>
            {meal} · {plate.catererName}
          </RNText>
          <RNText style={styles.sentence} accessibilityRole="header">
            {sentence}
          </RNText>
          {second ? <RNText style={styles.second}>{second}</RNText> : null}
        </View>
      </View>
      <View style={styles.body}>
        {plate.dishes.length ? <Text>{plate.dishes.join(" · ")}</Text> : <Text variant="caption">{plate.packageName}</Text>}
        {!offline && (plate.state === "on_the_way" || plate.state === "due") ? (
          <View style={styles.row}>
            <SunriseButton
              label={t("Sudah sampai", "It's here")}
              disabled={busy}
              onPress={() => void run("delivery.confirm", {})}
              style={{ flex: 2 }}
            />
            <Button
              variant="secondary"
              label={t("Belum", "Not yet")}
              disabled={busy}
              style={{ flex: 1 }}
              onPress={() =>
                router.push(`/masalah/${encodeURIComponent(plate.deliveryId)}?meal=${plate.meal}&jenis=belum` as never)
              }
            />
          </View>
        ) : null}
        {!offline && plate.state === "arrived" ? (
          <View style={{ gap: 8 }}>
            <Text variant="caption">
              {t("Bagaimana rasanya? Hanya katering yang melihat.", "How was it? Only the caterer sees this.")}
            </Text>
            <View style={styles.row}>
              {(
                [
                  ["enak", t("Enak", "Tasty")],
                  ["biasa", t("Biasa", "Okay")],
                  ["kurang", t("Kurang", "Not great")],
                ] as const
              ).map(([value, label]) => {
                const selected = plate.reaction === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected, disabled: busy }}
                    disabled={busy}
                    onPress={() => void run("delivery.react", { reaction: value })}
                    style={[styles.reaction, selected && styles.reactionOn]}
                  >
                    <Face kind={value} color={selected ? colors.cream : colors.forest} />
                    <RNText style={[styles.reactionLabel, { color: selected ? colors.cream : colors.forest }]}>
                      {label}
                    </RNText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {plate.state === "reported" ? (
          <Button variant="secondary" label={t("Lihat laporan", "View report")} onPress={() => router.push("/bantuan" as never)} />
        ) : null}
        {error ? (
          <Text style={{ color: colors.danger }} testID="plate-error">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  photo: { height: 268, backgroundColor: colors.forest, justifyContent: "flex-end" },
  scrimSoft: { position: "absolute", left: 0, right: 0, bottom: 0, height: "75%", backgroundColor: "rgba(12,30,22,0.22)" },
  chip: {
    position: "absolute",
    top: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,247,233,0.94)",
  },
  chipLabel: { fontFamily: FONT, fontSize: 13, fontWeight: "700", color: colors.forest, fontVariant: ["tabular-nums"] },
  // 66% forest-black over a pure white photo still gives cream text about 5.3:1.
  overlay: { padding: 18, paddingTop: 14, gap: 4, backgroundColor: "rgba(12,30,22,0.66)" },
  meal: { fontFamily: FONT, fontSize: 13, fontWeight: "700", color: colors.cream },
  sentence: { fontFamily: FONT, fontSize: 28, lineHeight: 33, fontWeight: "800", letterSpacing: -0.5, color: colors.cream },
  second: { fontFamily: FONT, fontSize: 17, fontWeight: "600", color: colors.cream, fontVariant: ["tabular-nums"] },
  body: { padding: 16, gap: 12 },
  row: { flexDirection: "row", gap: 8 },
  sunrise: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sunrise,
  },
  sunriseLabel: { fontFamily: FONT, fontSize: 15, fontWeight: "800", color: colors.charcoal },
  reaction: {
    flex: 1,
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CDD4C4",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
  },
  reactionOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  reactionLabel: { fontFamily: FONT, fontSize: 13, fontWeight: "700" },
});
