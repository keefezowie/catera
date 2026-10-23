import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  compositionPreview,
  currency,
  mealLabel,
  perMealPrice,
  priceUnitLabel,
  shortDate,
  startDates,
  type Offer,
} from "@catera/domain";
import { nativeLayout, nativeThemes } from "@catera/design-tokens";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  fonts,
  linkTitle,
  nativeHeaderOptions,
  PressableScale,
  ReadError,
  SaveHeart,
  Screen,
  ScreenStatusBar,
  Text,
  themedStyles,
  useColors,
  useMoodColors,
  useScreenMargin,
  useScreenNavigation,
} from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";
import { dayRange, ratingText } from "./format";
import { StatStrip } from "./NutritionCard";
import { useSaved } from "./saved";
import { goToTab } from "../nav";
import { PackageSkeleton } from "../skeletons";
import { DecorativeIcon, GLYPH_INSET, GlyphRow, ListCard, SectionHeader } from "../layout";
import { GLYPH_BARE } from "../layout/metrics";

type Review = { id: string; customer: string; rating: number; body: string };

/** The photo and its scrim are dark whatever the theme, so the bar's ink over them does not follow it (as in the story). */
const ink = nativeThemes.light;

/**
 * The bar over the photo (ruling B3: the photo is the header): transparent, with no title, so the photo runs to the top
 * edge and the platform back (iOS glass button, Material arrow) sits on the photo's scrim in light ink.
 */
const PHOTO_HEADER = {
  headerTransparent: true,
  headerLargeTitle: false,
  headerTitle: "",
  headerShadowVisible: false,
  headerStyle: { backgroundColor: "transparent" },
  headerTintColor: ink.cream,
} as const;

/** `Screen`'s body is at most this wide, so the photo is too. */
const PAGE_MAX_WIDTH = 760;
/** The 4:3 photo's whole height on a screen `width` wide, status bar included (the photo runs under it). */
const heroHeightFor = (width: number) => Math.round(Math.min(width, PAGE_MAX_WIDTH) / nativeLayout.ratio.hero);
/**
 * The bar's own height below the status bar: iOS's inline bar (large titles are off here) and the Android toolbar at
 * the theme's `actionBarSize`, measured at 56dp on the emulator.
 */
const BAR = process.env.EXPO_OS === "ios" ? 44 : 56;
/**
 * Once the photo's foot has scrolled under the bar's foot, the bar stands on the canvas instead of the photo: the
 * scroll offset at which that happens, for a screen `width` wide with a status bar `topInset` tall.
 */
export const photoPassed = (width: number, topInset: number) => heroHeightFor(width) - topInset - BAR;
/** The scrim's height from the photo's top edge. */
const SCRIM = 140;

/**
 * The back on the photo (spec 3.4): a 44 surface circle in the bar's leading slot, on the scrim. It stands in for the
 * platform's back only while the bar is over the photo; once the bar turns opaque the platform's own returns.
 */
function PhotoBack({ label }: { label: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => (router.canGoBack() ? router.back() : goToTab("jelajah"))}
      style={styles.back}
    >
      <Ionicons name={process.env.EXPO_OS === "ios" ? "chevron-back" : "arrow-back"} size={22} color={c.charcoal} />
    </PressableScale>
  );
}

/**
 * The heart in the bar (spec 3.4): a 44 surface circle in the trailing slot, on the scrim over the photo and on the
 * canvas after it. The bar renders it outside the page, so it holds its own saved state; a refusal puts the heart back
 * and says so in `useSaved`'s error toast.
 */
function PhotoHeart({ id, name }: { id: string; name: string }) {
  const { t } = useMobile();
  const saved = useSaved(`/paket/${id}`);
  const isSaved = saved.isSaved(id);
  return (
    <SaveHeart
      circle
      saved={isSaved}
      canSave={saved.signedIn}
      label={isSaved ? t(`Hapus ${name} dari simpanan`, `Remove ${name} from saved`) : t(`Simpan ${name}`, `Save ${name}`)}
      onToggle={() => void saved.toggle(id)}
    />
  );
}

/** Paket: one package in full, with the way into Pilih jadwal (or a one-day trial). */
export function PackageDetail() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const { id } = params;
  const { runtime, t, locale, demo } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const margin = useScreenMargin();
  const { width: screenWidth } = useWindowDimensions();
  const siang = useMoodColors("siang").header;
  const malam = useMoodColors("malam").header;
  const loaded = useData<{ offer: Offer | null }>(`paket:${id}`, () => runtime.api.offer(id));
  const reviews = useData<Review[]>(`reviews:${id}`, () => runtime.api.request<Review[]>(`reviews/${id}`));
  const o = loaded.data?.offer;
  const insets = useSafeAreaInsets();
  const navigation = useScreenNavigation();
  const photoHeader = !!o;
  const name = o?.name ?? "";
  const offerId = o?.id;
  const stackHeader = useMemo(() => nativeHeaderOptions({ palette: c, demo }), [c, demo]);
  // The bar's slots change with the language (and the package for the heart), not with every render: `t` is a new
  // function each render, so the labels are read from it inside and the memo keys on `locale`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headerLeft = useMemo(() => () => <PhotoBack label={t("Kembali", "Back")} />, [locale]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headerRight = useMemo(() => (offerId ? () => <PhotoHeart id={offerId} name={name} /> : undefined), [offerId, name, locale]);
  // Over the photo the bar is transparent with light ink. Once the photo has scrolled away the light ink would sit on
  // the cream page, so the bar turns opaque (the canvas on iOS, the scrolled surface-container tone on Android) with the
  // theme's tint and hands the status bar back to the theme; it takes the package name once the name line has scrolled under it, as a content title does. Scrolling back
  // up undoes each step. The bar stays transparent in layout terms throughout, so the page never jumps by its height.
  // Leaving the photo state (a failed reload) restores the stack's own bar.
  const [stage, setStage] = useState<"photo" | "canvas" | "named">("photo");
  const stageRef = useRef(stage);
  const nameBlockY = useRef(Number.POSITIVE_INFINITY);
  const nameLineEnd = useRef(0);
  const nameEnd = useRef(Number.POSITIVE_INFINITY);
  const pastPhoto = stage !== "photo";
  const photoApplied = useRef(false);
  useLayoutEffect(() => {
    if (!navigation) return;
    if (photoHeader) {
      photoApplied.current = true;
      navigation.setOptions(
        pastPhoto
          ? {
              ...PHOTO_HEADER,
              headerLeft: undefined,
              headerRight,
              headerTitle: stage === "named" ? name : "",
              // Past the photo the page has scrolled, so Android takes Material's scrolled tone like every pushed screen.
              headerStyle: { backgroundColor: process.env.EXPO_OS === "ios" ? c.canvas : c.tabBar },
              headerTintColor: stackHeader.headerTintColor,
            }
          : { ...PHOTO_HEADER, headerLeft, headerRight },
      );
      return;
    }
    if (!photoApplied.current) return;
    photoApplied.current = false;
    // A photo that comes back starts over the photo again, whatever the page was scrolled to before.
    stageRef.current = "photo";
    setStage("photo");
    scrimShift.setValue(0);
    navigation.setOptions({
      headerTransparent: stackHeader.headerTransparent ?? false,
      headerLargeTitle: stackHeader.headerLargeTitle ?? false,
      headerShadowVisible: stackHeader.headerShadowVisible,
      headerStyle: stackHeader.headerStyle,
      headerTintColor: stackHeader.headerTintColor,
      headerLeft: undefined,
      headerRight: undefined,
      // Android's content title starts the bar empty and takes it on scroll; iOS reads the route's `title`.
      headerTitle: process.env.EXPO_OS === "ios" ? undefined : "",
    });
  }, [navigation, photoHeader, pastPhoto, stage, name, c.canvas, c.tabBar, stackHeader, headerLeft, headerRight]);
  // The scrim stays under the bar while the photo scrolls beneath it, so the light back arrow never lands on a bright
  // part of the photo; it stops at the photo's foot.
  const topInset = demo ? 0 : insets.top;
  const heroHeight = heroHeightFor(screenWidth);
  const scrimShift = useRef(new Animated.Value(0)).current;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrimShift.setValue(Math.min(Math.max(y, 0), heroHeight - SCRIM));
    // The bar's foot in content terms is the scroll offset plus the bar (and the status bar it covers).
    const next = y < heroHeight - topInset - BAR ? "photo" : y + topInset + BAR >= nameEnd.current ? "named" : "canvas";
    if (next === stageRef.current) return;
    stageRef.current = next;
    setStage(next);
  };

  if (!o) {
    const loading = loaded.loading && !loaded.data;
    return (
      // No photo to lead with yet, so the page opens under the plain native header, named after the link's package
      // while it loads when the link carried one. A failed read or a missing package names it "Paket": the carried
      // name was never checked against a record.
      <Screen nativeTitle={loading ? (linkTitle(params) ?? t("Paket", "Package")) : t("Paket", "Package")}>
        {/* The same FadeSwap as the loaded page below, so the package fades in from its skeleton as one block. */}
        <FadeSwap swapKey={loading ? "loading" : "missing"} style={{ gap: 16 }}>
          {loading ? (
            <PackageSkeleton />
          ) : (
            <View style={{ gap: 10 }}>
              {/* A failed read leads with the puzzled mascot; a package that is gone is not a failure and has none. */}
              {loaded.error ? (
                <ReadError art message={loaded.error} onRetry={() => void loaded.reload()} />
              ) : (
                <>
                  <Text variant="heading" style={{ color: c.charcoal }}>
                    {t("Paket tidak ditemukan.", "Package not found.")}
                  </Text>
                  <Button label={t("Jelajah paket", "Browse packages")} onPress={() => goToTab("jelajah")} />
                </>
              )}
            </View>
          )}
        </FadeSwap>
      </Screen>
    );
  }

  const open = `/beli/${encodeURIComponent(o.id)}`;
  const windows = (o.meal === "both" ? [o.windows.lunch, o.windows.dinner] : [o.windows[o.meal]]).join(" · ");
  const shown = (reviews.data ?? []).slice(0, 3);
  const { note } = priceUnitLabel(o, locale);
  const earliest = startDates(o, new Date(), 1)[0];
  const cutoff = o.cutoff.slice(0, 5);
  return (
    <Screen
      bleed
      onScroll={onScroll}
      footer={
        // One row when the price and both buttons fit; otherwise the buttons wrap under the price (and, at the largest
        // text, under each other) instead of drawing over it. Nothing in the row shrinks below its own text.
        <View testID="paket-footer" style={styles.footer}>
          <View testID="paket-price" style={styles.price}>
            <Text
              variant="section"
              accessibilityRole="text"
              style={{ fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] }}
            >
              {currency(perMealPrice(o), locale)}
            </Text>
            <Text variant="meta">{[t("Per sekali makan", "Per meal"), note].filter(Boolean).join(" · ")}</Text>
          </View>
          <View testID="paket-actions" style={styles.actions}>
            {o.trialPrice ? (
              <Button
                variant="secondary"
                label={t("Coba 1 hari", "Try 1 day")}
                onPress={() => router.push(`${open}?trial=1` as never)}
                style={styles.action}
              />
            ) : null}
            <Button
              label={t("Pilih jadwal", "Choose schedule")}
              onPress={() => router.push(open as never)}
              style={styles.action}
            />
          </View>
        </View>
      }
    >
      {/* One block that fades in from the skeleton (the loading page's FadeSwap). It covers the body's whole box (its top,
          by the body's 16, and both sides, by the margin) and carries the margin as padding, so the photo's side pull and
          the name block's measured offset are what they are in the body. The photo itself has no vertical margin: Yoga
          sizes a stretched aspect-ratio box from its outer height, so a negative marginTop on it makes it 16 taller and,
          the width following the height, 21 wider than the screen. */}
      <FadeSwap
        swapKey="ready"
        style={{ gap: 16, marginTop: -16, marginHorizontal: -margin, paddingHorizontal: margin }}
      >
        {/* The photo runs under the status bar too: 4:3 over the page's whole width. */}
        <View testID="paket-hero" style={[styles.hero, { marginHorizontal: -margin }]}>
          {o.image ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: photoUri(o.image, runtime.apiBase) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
          {/* Under the transparent bar: the status bar and the back read on the photo whatever it shows. */}
          <Animated.View
            testID="paket-photo-scrim"
            pointerEvents="none"
            style={[styles.scrim, { transform: [{ translateY: scrimShift }] }]}
          />
          {/* Light glyphs on the scrim; with the demo strip above, the strip's own fill keeps the theme's glyphs, and
              once the photo has scrolled away the canvas bar takes the theme's glyphs back. */}
          {demo || pastPhoto ? null : <ScreenStatusBar style="light" />}
        </View>

        {/* The name block starts at the page's top in content terms (the photo and this block share one parent), so its
            frame plus the name line's foot is where the bar takes the name. */}
        <View
          style={{ gap: nativeLayout.space.xs }}
          onLayout={(e) => {
            nameBlockY.current = e.nativeEvent.layout.y;
            nameEnd.current = nameBlockY.current + nameLineEnd.current;
          }}
        >
          <View
            testID="paket-name"
            onLayout={(e) => {
              nameLineEnd.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
              nameEnd.current = nameBlockY.current + nameLineEnd.current;
            }}
          >
            <Text variant="heroTitle">{o.name}</Text>
          </View>
          <Text variant="meta">
            {`${[o.caterer, o.areas[0]].filter(Boolean).join(", ")}. ${ratingText(o, locale, t)}`}
          </Text>
        </View>

        <StatStrip offer={o} />
        {o.description ? <Text variant="bodyL">{o.description}</Text> : null}

        {/* Each section sits 32 below the one above: the body's 16 gap plus this 16. */}
        <View testID="paket-isi" style={styles.section}>
          <SectionHeader title={t("Isi paket", "What is included")} />
          <ListCard inset={GLYPH_INSET}>
            {o.menus.map((m) => (
              <GlyphRow
                key={m.meal}
                testID={`paket-meal-${m.meal}`}
                minHeight={nativeLayout.row.media}
                tone={m.meal === "dinner" ? malam : siang}
                glyph={<DecorativeIcon name={m.meal === "dinner" ? "moon-outline" : "sunny-outline"} size={GLYPH_BARE} color={c.charcoal} />}
                title={mealLabel(m.meal, locale)}
                meta={compositionPreview(m, o.packageType, locale)}
              />
            ))}
          </ListCard>
        </View>

        <View testID="paket-antar" style={styles.section}>
          <SectionHeader title={t("Pengantaran", "Delivery")} />
          <View style={styles.infoRows}>
            <InfoRow icon="bicycle-outline" text={`${dayRange(o.weekdays, locale)}, ${windows}`} />
            <InfoRow
              icon="time-outline"
              text={t(
                `Ubah hari sampai ${cutoff.replace(":", ".")}, sehari sebelumnya`,
                `Change a day until ${cutoff} the day before`,
              )}
            />
            <InfoRow icon="pricetag-outline" text={t("Ongkir sudah termasuk", "Delivery included")} />
            {earliest ? (
              <InfoRow
                icon="calendar-outline"
                text={`${t("Mulai paling cepat", "Earliest start")} ${shortDate(earliest, locale)}`}
              />
            ) : null}
          </View>
        </View>

        {shown.length ? (
          <View testID="paket-reviews" style={styles.section}>
            <SectionHeader title={t("Ulasan", "Reviews")} />
            <ListCard inset={0}>
              {shown.map((r) => (
                <View key={r.id} testID="paket-review" style={styles.review}>
                  <Text variant="bodyStrong">
                    {r.customer} · {r.rating}/5
                  </Text>
                  {r.body ? <Text variant="bodyL">{r.body}</Text> : null}
                </View>
              ))}
            </ListCard>
          </View>
        ) : null}
      </FadeSwap>
    </Screen>
  );
}

/** A 48 info row: the bare 20 glyph and a `bodyL` line that wraps rather than truncates. */
function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View testID="paket-info" style={styles.info}>
      <View testID="paket-info-glyph" style={styles.infoGlyph}>
        <DecorativeIcon name={icon} size={GLYPH_BARE} color={c.muted} />
      </View>
      <Text variant="bodyL" style={styles.infoText}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  hero: {
    aspectRatio: nativeLayout.ratio.hero,
    backgroundColor: c.sage,
  },
  // The scrim's ink is the story's (TomorrowStory), from the darkest Malam tone.
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCRIM,
    experimental_backgroundImage: "linear-gradient(rgba(27,27,26,0.6), rgba(27,27,26,0))",
  },
  back: {
    width: nativeLayout.control.icon,
    height: nativeLayout.control.icon,
    borderRadius: nativeLayout.control.icon / 2,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { marginTop: nativeLayout.space.lg },
  review: { gap: nativeLayout.space.xs, paddingVertical: nativeLayout.space.md },
  infoRows: { gap: nativeLayout.space.xs },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    minHeight: nativeLayout.row.info,
    paddingVertical: nativeLayout.space.sm,
  },
  infoGlyph: { width: GLYPH_BARE, height: GLYPH_BARE, alignItems: "center", justifyContent: "center" },
  infoText: { flex: 1, minWidth: 0 },
  // A wrapping row: price first, then the buttons, "Pilih jadwal" last at the trailing edge on whichever line it lands.
  // Yoga breaks a line on each child's own width, measured at most the row's width, so a child that cannot shrink moves
  // to the next line instead of drawing over its neighbour; `maxWidth` keeps a very long one inside the row.
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 10,
  },
  price: { flexShrink: 0, maxWidth: "100%" },
  // Grows to fill its line, so the buttons sit at its trailing edge; they wrap under each other when a line of their own
  // cannot hold both.
  actions: {
    flexGrow: 1,
    flexShrink: 0,
    maxWidth: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  action: { paddingHorizontal: nativeLayout.space.lg },
}));
