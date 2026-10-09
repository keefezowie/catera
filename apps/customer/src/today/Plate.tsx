import { useEffect, useState } from "react";
import { Image, Linking, StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { router } from "expo-router";
import { nativeThemes } from "@catera/design-tokens";
import { errorLabel, journeyCaption, whatsappUrl, type Plate as PlateData } from "@catera/domain";
import { useMobile, useTrack } from "@catera/mobile-core";
import {
  Button,
  fontFor,
  MoodFill,
  PressableScale,
  RantangTrack,
  Text,
  themedStyles,
  useColors,
  useMood,
  useMoodColors,
  useThemePreference,
} from "@catera/mobile-ui";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

// The photo scrim and the Sunrise fill look the same in light and dark, so their ink is the light palette on
// purpose: the themed tokens swap roles in dark and would put dark text on the dark scrim and light text on orange.
const fixedInk = nativeThemes.light;

/**
 * journey_viewed is counted once per delivery, meal and stage for the life of the app process (ruling C12). The hero is
 * remounted when the mood swaps meals, so the memory has to live outside the component.
 */
const viewedJourneys = new Set<string>();

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
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      haptic={disabled ? "none" : "tap"}
      onPress={onPress}
      style={[styles.sunrise, disabled && { opacity: 0.6 }, style]}
    >
      <RNText style={styles.sunriseLabel}>{label}</RNText>
    </PressableScale>
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

/** The plate's status as two lines: what is happening, and when or where. The hero, a card and the other-meal row all say it this way. */
export const sentences = (p: PlateData, t: (id: string, en: string) => string): [string, string] => {
  switch (p.state) {
    case "scheduled":
      return [
        t("Terjadwal", "Scheduled"),
        t(`diantar ${p.window} ke ${p.addressLabel}`, `delivered ${p.window} to ${p.addressLabel}`),
      ];
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
      // Nobody tapped: the system recorded the arrival, and the track says so in the same words.
      const first =
        p.journey.arrivedBy === "auto" ? t("Tercatat sampai", "Recorded as arrived") : t("Sudah sampai", "Arrived");
      return [first, at ? t(`pukul ${at}`, `at ${at}`) : ""];
    }
    case "failed":
      return [t("Tidak bisa diantar hari ini", "Couldn't be delivered today"), ""];
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

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The hero's two status lines. The track under the dishes already says where the meal is, so the hero never says it
 * twice: a scheduled meal ("Terjadwal") and an on-the-way meal without a departure time ("Sedang diantar") are said
 * by the track alone, and the second line becomes the header. A meal past its window that the kitchen never tapped
 * says so instead of leaving the bare window. An arrival the system recorded is the same: the track caption reads
 * "Tercatat sampai", so the header becomes the time ("Pukul 11.48"); with no time kept it still reads "Tercatat sampai". Cards, the
 * other-meal row and Beranda keep `sentences`.
 */
export function heroSentences(
  p: PlateData,
  t: (id: string, en: string) => string,
  trackShown: boolean,
): [string, string] {
  const [first, second] = sentences(p, t);
  // An offer can carry no window, and a delivery no address label: promoting then would leave "Tiba sekitar " or
  // "Diantar  ke X" as the header, so both original lines stay (the same guard as the due line below).
  const promotes =
    (p.state === "scheduled" && !!p.window && !!p.addressLabel) ||
    (p.state === "on_the_way" && !!p.window && !jakartaClock(p.journey.departedAt));
  if (trackShown && promotes) return [capitalise(second), ""];
  // With no time to promote the header keeps the truthful state, even though the caption says it too: data written
  // by the app always carries `confirmed_at`, so this only shows on malformed data.
  if (trackShown && p.state === "arrived" && p.journey.arrivedBy === "auto")
    return second ? [capitalise(second), ""] : [first, ""];
  if (p.state === "due" && p.journey.stage === "scheduled")
    return [
      first,
      p.window
        ? t(`${p.window} · belum ada catatan dari dapur`, `${p.window} · no update from the kitchen yet`)
        : t("Belum ada catatan dari dapur", "No update from the kitchen yet"),
    ];
  return [first, second];
}

const HERO_RADIUS = 28;

/**
 * Today's plate: the photo with one status sentence, the dishes and one action. As the `hero` it is the Beranda's
 * raised card: a `MoodFill` (Siang, and Malam fading over it) riding up over the header. The frame stays mounted when
 * the mood switches, so the fills cross-fade; only its content is keyed to the plate. The shadow sits on the base fill
 * and switches with the mood. A `card` plate has no mood of its own and reads the theme.
 */
export function Plate({
  plate,
  apiBase,
  offline,
  variant = "card",
}: {
  plate: PlateData;
  apiBase: string;
  offline?: boolean;
  variant?: "card" | "hero";
}) {
  const styles = useStyles();
  const content = (
    <PlateContent
      key={`${plate.deliveryId}:${plate.meal}`}
      plate={plate}
      apiBase={apiBase}
      offline={offline}
      variant={variant}
    />
  );
  if (variant !== "hero") return <View style={styles.card}>{content}</View>;
  return (
    <View
      testID="plate-hero"
      // Not clipped: the shadow of each fill falls outside the frame.
      style={{ padding: 10, marginTop: -74, borderRadius: HERO_RADIUS, borderCurve: "continuous" }}
    >
      <MoodFill surface="hero" testID="plate-hero-fill" radius={HERO_RADIUS} heroShadow />
      {content}
    </View>
  );
}

function PlateContent({
  plate,
  apiBase,
  offline,
  variant,
}: {
  plate: PlateData;
  apiBase: string;
  offline?: boolean;
  variant: "card" | "hero";
}) {
  const { command, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const { mood } = useMood();
  const moodColors = useMoodColors();
  const { scheme } = useThemePreference();
  const hero = variant === "hero";
  // The hero's inks come from the mood, a card's from the theme. Light Malam puts a dark fill under the light theme's
  // dark inks, so the error text takes the dark theme's danger there.
  const ink = hero ? moodColors.heroText : c.forest;
  const quiet = hero ? moodColors.heroMeta : c.muted;
  const edge = hero ? moodColors.heroMeta : c.secondaryBorder;
  const onInk = hero ? moodColors.hero : c.cream;
  const danger = hero && (mood === "malam" || scheme === "dark") ? nativeThemes.dark.danger : c.danger;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const track = useTrack();
  // The track tells where a meal is on its way. A meal marked as a problem has no honest place on it, so a failed or
  // reported plate keeps its message alone.
  const caption =
    hero && plate.state !== "failed" && plate.state !== "reported" ? journeyCaption(plate.journey, locale) : null;
  const [sentence, second] = hero ? heroSentences(plate, t, !!caption) : sentences(plate, t);
  const { deliveryId, meal: mealKey, journey } = plate;
  // A meal nobody tapped has no journey to look at yet, and stale offline data is not a view of today.
  const watched = !!caption && !offline && journey.stage !== "scheduled";
  useEffect(() => {
    if (!watched) return;
    const key = `${deliveryId}:${mealKey}:${journey.stage}`;
    if (viewedJourneys.has(key)) return;
    viewedJourneys.add(key);
    track("journey_viewed");
  }, [watched, deliveryId, mealKey, journey.stage, track]);
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
    <>
      <View
        testID="plate-photo"
        style={[
          styles.photo,
          hero
            ? { minHeight: 168, borderRadius: 20, borderCurve: "continuous", overflow: "hidden" }
            : { height: 268 },
        ]}
      >
        {plate.image ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: photoUri(plate.image, apiBase) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.scrimSoft} />
        {/* The overlay carries its own dark ground, so every wrapped line sits on it. */}
        <View style={styles.overlay} testID="plate-overlay">
          <RNText style={styles.meal}>
            {meal} · {plate.catererName}
          </RNText>
          <RNText testID="plate-sentence" style={styles.sentence} accessibilityRole="header">
            {sentence}
          </RNText>
          {second ? <RNText style={styles.second}>{second}</RNText> : null}
        </View>
      </View>
      <View style={[styles.body, hero && { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8 }]}>
        {plate.dishes.length ? (
          <Text
            testID="plate-dishes"
            variant={hero ? "heading" : "body"}
            style={hero ? { color: moodColors.heroText } : undefined}
          >
            {plate.dishes.join(" · ")}
          </Text>
        ) : (
          <Text testID="plate-dishes" variant="caption" style={hero ? { color: quiet } : undefined}>
            {plate.packageName}
          </Text>
        )}
        {caption ? (
          <RantangTrack
            stage={journey.stage}
            caption={caption}
            labels={[t("Dimasak", "Cooking"), t("Diantar", "On the way"), t("Sampai", "Arrived")]}
          />
        ) : null}
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
              ink={ink}
              edge={edge}
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
            <Text variant="caption" style={hero ? { color: quiet } : undefined}>
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
                  <PressableScale
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected, disabled: busy }}
                    disabled={busy}
                    haptic={busy ? "none" : "select"}
                    onPress={() => void run("delivery.react", { reaction: value })}
                    style={[
                      styles.reaction,
                      { borderColor: edge },
                      selected && { backgroundColor: ink, borderColor: ink },
                    ]}
                  >
                    <Face kind={value} color={selected ? onInk : ink} />
                    <RNText style={[styles.reactionLabel, { color: selected ? onInk : ink }]}>{label}</RNText>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ) : null}
        {plate.state === "failed" ? (
          <View style={{ gap: 4 }}>
            {plate.catererPhone ? (
              <Button
                variant="secondary"
                label={t("Chat katering", "Chat caterer")}
                ink={ink}
                edge={edge}
                onPress={() => void Linking.openURL(whatsappUrl("", plate.catererPhone ?? "")).catch(() => undefined)}
              />
            ) : null}
            {!offline ? (
              <Button
                variant="text"
                label={t("Ada masalah", "Report a problem")}
                ink={ink}
                edge={edge}
                onPress={() =>
                  router.push(`/masalah/${encodeURIComponent(plate.deliveryId)}?meal=${plate.meal}` as never)
                }
              />
            ) : null}
          </View>
        ) : null}
        {plate.state === "reported" ? (
          <Button
            variant="secondary"
            label={t("Lihat laporan", "View report")}
            ink={ink}
            edge={edge}
            onPress={() => router.push("/bantuan" as never)}
          />
        ) : null}
        {error ? (
          <Text selectable style={{ color: danger }} testID="plate-error">
            {error}
          </Text>
        ) : null}
      </View>
    </>
  );
}

const useStyles = themedStyles((c) => ({
  card: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  photo: { backgroundColor: fixedInk.forest, justifyContent: "flex-end" },
  scrimSoft: { position: "absolute", left: 0, right: 0, bottom: 0, height: "75%", backgroundColor: "rgba(12,30,22,0.22)" },
  // 66% forest-black over a pure white photo still gives cream text about 5.3:1.
  overlay: { padding: 18, paddingTop: 14, gap: 4, backgroundColor: "rgba(12,30,22,0.66)" },
  meal: { fontSize: 13, fontFamily: fontFor("700"), color: fixedInk.cream },
  // Tabular: the promoted header carries the delivery window.
  sentence: {
    fontSize: 28,
    lineHeight: 33,
    fontFamily: fontFor("800"),
    letterSpacing: -0.5,
    color: fixedInk.cream,
    fontVariant: ["tabular-nums"],
  },
  second: { fontSize: 17, fontFamily: fontFor("600"), color: fixedInk.cream, fontVariant: ["tabular-nums"] },
  body: { padding: 16, gap: 12 },
  row: { flexDirection: "row", gap: 8 },
  sunrise: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.sunrise,
  },
  sunriseLabel: { fontSize: 15, fontFamily: fontFor("800"), color: fixedInk.charcoal },
  reaction: {
    flex: 1,
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
  },
  reactionLabel: { fontSize: 13, fontFamily: fontFor("700") },
}));
