import { useEffect, useRef } from "react";
import { Text as RNText, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile, usePushPrimer } from "@catera/mobile-core";
import { Button, fontFor, PolishArt, SheetFitBody, SheetHandle, Text, useColors, useSheetTitleFocus, useToast } from "@catera/mobile-ui";
import { pushSheet } from "../nav";

/** The route the primer opens as (a fit-detent native sheet, `sheetOptions({ detents: "fit" })` in the root layout). */
export const PUSH_PRIMER_HREF = "/notifikasi-primer";
/** The art's tallest box; on a short phone it takes a fifth of the window instead (expo-native-ui: size by height). */
const ART_MAX = 200;
const ART_SHARE = 0.2;
/** The art's frame is 5:4 (300 by 240 on the canvas). */
const ART_RATIO = 1.25;
/** The paid moment settles first (PaidOutcome's art and words, about 700ms), then the sheet comes up. */
const PRIMER_AFTER_MS = 900;

const channel = (t: (id: string, en: string) => string) => t("Pengantaran & bantuan", "Deliveries & support");

/**
 * Opens the push primer over the paid screen once `usePushPrimer` says so (the first paid plan, a phone never asked, at
 * most once per phone), after the paid moment has settled. Draws nothing itself.
 */
export function PushPrimerTrigger({ eligible }: { eligible: boolean }) {
  const { t } = useMobile();
  const primer = usePushPrimer(channel(t), eligible);
  const opened = useRef(false);
  useEffect(() => {
    if (!primer.shown || opened.current) return;
    opened.current = true;
    const timer = setTimeout(() => pushSheet(PUSH_PRIMER_HREF), PRIMER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [primer.shown]);
  return null;
}

/**
 * `/notifikasi-primer` (canvas PrimerNotif): the primer-notifikasi art, what Catera tells you (cooking, on the way,
 * arrived; never promos, ruling 4), "Nyalakan notifikasi" and "Nanti saja", as a native fit sheet. Swiping it away is
 * "Nanti saja". The accept goes through the same registration as Pengaturan's switch; a refusal just closes, a failure
 * says so. The content scrolls when a large font outgrows the sheet.
 */
export function PushPrimerRoute() {
  const { t } = useMobile();
  const primer = usePushPrimer(channel(t), false);
  const toast = useToast();
  const c = useColors();
  const titleRef = useSheetTitleFocus();
  const { height } = useWindowDimensions();
  const artHeight = Math.round(Math.min(ART_MAX, height * ART_SHARE));
  const ios = process.env.EXPO_OS === "ios";

  const accept = () => {
    router.back();
    void primer.accept().catch(() =>
      toast.show({
        message: t("Notifikasi belum bisa dinyalakan. Coba lagi di Pengaturan.", "Couldn't turn on notifications. Try again in Settings."),
        tone: "error",
      }),
    );
  };

  return (
    <SheetFitBody testID="push-primer" header={ios ? <View style={{ height: nativeLayout.space.xl }} /> : <SheetHandle />}>
      <View style={{ paddingHorizontal: nativeLayout.space.xl, gap: nativeLayout.space.lg }}>
        <View style={{ alignItems: "center" }}>
          <PolishArt name="primer-notifikasi" width={Math.round(artHeight * ART_RATIO)} height={artHeight} />
        </View>
        <View style={{ gap: nativeLayout.space.sm }}>
          {/* The outcome step (26/32 bold), on React Native's Text so the screen reader can start on it. */}
          <RNText
            ref={titleRef}
            accessibilityRole="header"
            style={{ fontFamily: fontFor("700"), fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: c.charcoal }}
          >
            {t("Tahu kapan makananmu jalan", "Know when your food is on its way")}
          </RNText>
          <Text variant="bodyL">
            {t(
              "Kami kabari saat rantangmu dimasak, diantar dan sampai. Bisa dimatikan kapan saja di Pengaturan.",
              "We'll tell you when your rantang is cooking, on its way and delivered. You can turn this off any time in Settings.",
            )}
          </Text>
        </View>
        <View style={{ gap: nativeLayout.space.xs }}>
          <Button label={t("Nyalakan notifikasi", "Turn on notifications")} onPress={accept} />
          <Button variant="text" label={t("Nanti saja", "Not now")} onPress={() => router.back()} />
        </View>
      </View>
    </SheetFitBody>
  );
}
