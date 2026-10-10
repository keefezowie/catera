import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shortDate, tomorrowStory, type CustomerState, type StoryPart } from "@catera/domain";
import { nativeThemes } from "@catera/design-tokens";
import { useData, useMobile, useTrack, type MobileRuntime } from "@catera/mobile-core";
import {
  Button,
  PressableScale,
  statusBarStyle,
  StoryViewer,
  Text,
  useMood,
  useThemePreference,
  useTopInsetOwned,
} from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";
import { loadCachedCustomer } from "../today/offline";
import { useViewedParts } from "./viewed";
import { goToTab, leaveFor } from "../nav";

// A story sits on a photo and on black whatever the theme, so its inks do not follow it (as in StoryCover and Plate).
const ink = nativeThemes.light;

/** The same read Beranda makes, without writing the offline copy: a failed read falls back to the last good one. */
async function loadTomorrow(runtime: MobileRuntime, key: string): Promise<CustomerState | null> {
  if (!key) return null;
  try {
    return await runtime.api.customer();
  } catch (e) {
    const cached = await loadCachedCustomer(key);
    if (cached) return cached.data;
    throw e;
  }
}

/** Closes the story; a story opened from a link with nothing behind it goes home instead of stranding the user. */
function leave() {
  if (router.canGoBack?.() === false) goToTab("index");
  else router.back();
}

const EMPTY: StoryPart[] = [];

/**
 * Whether the demo strip sits under the status bar above the story. `owned` is the root's `TopInsetOwner` signal (the
 * strip is shown and owns the top inset). On Android this full-screen modal is drawn inside the stack, below the strip,
 * so the strip stays on top of the story. On iOS a full-screen modal is presented over the whole window, strip
 * included, so nothing sits above the story (reasoned from the presentation, not checked on an iOS device). `os`
 * defaults to the running platform.
 */
export function storyStripUnder({ owned, os = process.env.EXPO_OS }: { owned: boolean; os?: string }): boolean {
  return owned && os !== "ios";
}

/**
 * The story's top, from the one `storyStripUnder` check. Status bar: on its own the story is black up to the top edge,
 * so the glyphs are light; with the strip above it, the strip's theme fill decides through the same `statusBarStyle`
 * rule every other screen uses with the strip shown (dark glyphs on the light theme's sage, light on the dark theme's).
 * Top inset: the strip already covers the status bar, so the story starts right below it and adds no inset of its own.
 */
function useStoryTop(): { statusBar: "light" | "dark"; topInset: number } {
  const stripUnder = storyStripUnder({ owned: useTopInsetOwned() });
  const insets = useSafeAreaInsets();
  const { scheme } = useThemePreference();
  const { mood } = useMood();
  return {
    statusBar: stripUnder ? statusBarStyle({ scheme, mood, demo: true }) : "light",
    topInset: stripUnder ? 0 : insets.top,
  };
}

/**
 * Menu besok: tomorrow's meals as a full-screen story, one part per delivery and meal, lunch first. Nothing advances by
 * itself. Opening a part marks it seen on this phone, which is what uncovers its plate on Beranda after the cutoff.
 */
export function TomorrowStoryScreen() {
  const { runtime, actor, t, locale } = useMobile();
  const params = useLocalSearchParams<{ part?: string }>();
  const track = useTrack();
  // Its own key: this screen reloads on the same revision as Beranda but does not share its state.
  const home = useData("tomorrow:customer", () => loadTomorrow(runtime, actor?.id ?? ""));
  const state = home.data;
  const story = useMemo(() => (state ? tomorrowStory(state, new Date(), locale) : null), [state, locale]);
  const parts = story?.parts ?? EMPTY;
  const { markViewed } = useViewedParts(parts);

  const [asked] = useState(() => Number.parseInt(String(params.part ?? "0"), 10));
  const [at, setAt] = useState(Number.isFinite(asked) && asked > 0 ? asked : 0);
  const index = Math.min(at, Math.max(parts.length - 1, 0));
  const part = story ? story.parts[index] : undefined;

  // Once per open, however many parts are shown or times the read comes round again.
  const counted = useRef(false);
  useEffect(() => {
    if (!story || counted.current) return;
    counted.current = true;
    track("tomorrow_story_viewed");
  }, [story, track]);
  useEffect(() => {
    if (part) markViewed(part);
  }, [part, markViewed]);

  const { statusBar, topInset } = useStoryTop();
  const close = t("Tutup", "Close");
  let body: ReactNode;
  if (!state && home.loading) {
    body = (
      <StoryMessage
        text={t("Memuat menu besok…", "Loading tomorrow's menu…")}
        closeLabel={close}
        onClose={leave}
        topInset={topInset}
      />
    );
  } else if (!state && home.error) {
    body = (
      <StoryMessage
        text={t("Belum bisa memuat", "Could not load yet")}
        closeLabel={close}
        onClose={leave}
        topInset={topInset}
        selectable
      >
        <Button
          variant="secondary"
          label={t("Coba lagi", "Try again")}
          ink={ink.cream}
          edge={ink.cream}
          onPress={() => void home.reload()}
        />
      </StoryMessage>
    );
  } else if (!story || !part) {
    body = (
      <StoryMessage
        text={t("Belum ada antaran besok.", "No delivery tomorrow.")}
        closeLabel={close}
        onClose={leave}
        topInset={topInset}
      />
    );
  } else {
    const last = index === story.parts.length - 1;
    const next = story.parts[index + 1];
    const label = last
      ? t("Selesai", "Done")
      : next?.meal === "dinner"
        ? t("Lihat menu malam", "See dinner menu")
        : t("Lihat menu siang", "See lunch menu");
    body = (
      <StoryViewer
        count={story.parts.length}
        index={index}
        onIndexChange={setAt}
        onClose={leave}
        closeLabel={close}
        topInset={topInset}
        header={t(
          `Menu besok · ${shortDate(story.date, "id")} · ${index + 1} dari ${story.parts.length}`,
          `Tomorrow's menu · ${shortDate(story.date, "en")} · ${index + 1} of ${story.parts.length}`,
        )}
      >
        <StoryPage
          part={part}
          apiBase={runtime.apiBase}
          actionLabel={label}
          onAction={last ? leave : () => setAt(index + 1)}
        />
      </StoryViewer>
    );
  }

  return (
    <View testID="tomorrow-screen" style={{ flex: 1, backgroundColor: "black" }}>
      <StatusBar style={statusBar} />
      {body}
    </View>
  );
}

/**
 * One part: the photo, a short blend under the header, and a scrim that is solid enough where the text sits (0.9 from
 * 48dp up, so cream text clears 4.5:1 over any photo). It fills StoryViewer's content region (`flex: 1`) and holds no
 * ScrollView: long text wraps and the photo takes the rest.
 */
function StoryPage({
  part,
  apiBase,
  actionLabel,
  onAction,
}: {
  part: StoryPart;
  apiBase: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const { t } = useMobile();
  const uri = photoUri(part.image, apiBase);
  const meal = part.meal === "dinner" ? t("Makan malam", "Dinner") : t("Makan siang", "Lunch");
  const title =
    part.menuSet && part.title
      ? part.title
      : t(`Menu belum diisi oleh ${part.catererName}`, `${part.catererName} has not set this menu yet`);
  // A plan whose days cannot move, still before its cutoff, has nothing to say about a deadline.
  const deadline = part.changeable
    ? part.until
      ? t(`Bisa diubah sampai ${part.until}`, `Can be changed until ${part.until}`)
      : t("Masih bisa diubah", "Can still be changed")
    : part.closed
      ? t("Sudah lewat batas ubah", "Change window closed")
      : null;
  return (
    <View testID="tomorrow-part" style={{ flex: 1, backgroundColor: ink.forest, justifyContent: "flex-end" }}>
      {/* A dish without a photo leaves the forest ground, which the text still reads on. */}
      {uri ? <Image accessibilityIgnoresInvertColors source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      {/* Softens the join between the black header and the photo's top edge. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          experimental_backgroundImage: "linear-gradient(rgba(11,31,22,0.7), rgba(11,31,22,0))",
        }}
      />
      <View
        testID="tomorrow-scrim"
        style={{
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: 24,
          gap: 12,
          experimental_backgroundImage:
            "linear-gradient(rgba(11,31,22,0), rgba(11,31,22,0.9) 48px, rgba(11,31,22,0.92) 100%)",
        }}
      >
        {/* The one fact on the screen, and the only accent. */}
        <View
          testID="tomorrow-sticker"
          style={{
            alignSelf: "flex-start",
            backgroundColor: ink.cream,
            borderWidth: 1.5,
            borderColor: ink.sunriseInk,
            borderRadius: 8,
            borderCurve: "continuous",
            paddingHorizontal: 12,
            paddingVertical: 4,
            transform: [{ rotate: "-2deg" }],
          }}
        >
          <Text variant="label" style={{ color: ink.forest, fontVariant: ["tabular-nums"] }}>
            {part.window ? `${meal} · ${part.window}` : meal}
          </Text>
        </View>
        <Text variant="display" accessibilityRole="header" style={{ color: ink.cream }}>
          {title}
        </Text>
        {part.menuSet ? (
          <Text style={{ color: ink.cream }}>
            {part.sides.length ? `${part.catererName} · ${part.sides.join(", ")}` : part.catererName}
          </Text>
        ) : null}
        {deadline ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ flex: 1, color: ink.cream, fontVariant: ["tabular-nums"] }}>{deadline}</Text>
            {part.changeable ? (
              <Button
                variant="secondary"
                label={t("Ubah hari", "Change day")}
                ink={ink.cream}
                edge={ink.cream}
                onPress={() => leaveFor(`/hari/${encodeURIComponent(part.deliveryId)}`)}
              />
            ) : null}
          </View>
        ) : null}
        <Button label={actionLabel} ink={ink.forest} style={{ backgroundColor: ink.cream }} onPress={onAction} />
      </View>
    </View>
  );
}

/**
 * Loading, error and empty: a line on the black ground with the same close button, so there is always a way out. Its
 * top matches the viewer's: 8dp below `topInset`.
 */
function StoryMessage({
  text,
  closeLabel,
  onClose,
  topInset,
  selectable,
  children,
}: {
  text: string;
  closeLabel: string;
  onClose: () => void;
  topInset: number;
  selectable?: boolean;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="tomorrow-message"
      style={{ flex: 1, paddingTop: topInset + 8, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
    >
      <View style={{ alignItems: "flex-end" }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          haptic="tap"
          onPress={onClose}
          style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={26} color={ink.cream} />
        </PressableScale>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Text variant="heading" selectable={selectable} style={{ color: ink.cream, textAlign: "center" }}>
          {text}
        </Text>
        {children}
      </View>
    </View>
  );
}
