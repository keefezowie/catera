import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "./components";
import { useReduced } from "./motion";
import { themedStyles } from "./theme";
import { fonts } from "./type";

/** The space between two cards. */
const GAP = 12;
/** Each card is the pager's width minus this, so the next card peeks in at the trailing edge. */
const INSET = 64;
/** Room under the cards for the hero shadow, which a scroll view would otherwise clip. */
const SHADOW_ROOM = 32;
/** Room above the cards, where the shadow is short. */
const TOP_ROOM = 12;

/**
 * Equal cards side by side that snap one at a time, the next one peeking in, with dots and "{i} dari {n}" under them.
 * The pager reaches `bleed` past its parent's side padding on both sides, so the cards line up with the content and
 * peek at the screen edge. It uses the platform's own scroll physics (`snapToInterval`, `decelerationRate="fast"`).
 *
 * Screen readers get one adjustable control under the cards: it speaks `accessibilityLabelFor(index)` ("Makan siang
 * 1 dari 2, Dapur Senja"), its increment and decrement actions move the pager, and every page change is announced.
 * With `count` below 2 it renders its only child and nothing else.
 */
export function HeroPager({
  count,
  children,
  accessibilityLabelFor,
  counterLabel,
  onIndexChange,
  bleed = 20,
  style,
  testID = "hero-pager",
}: {
  count: number;
  children: ReactNode;
  /** What a screen reader hears for the card at `index`. */
  accessibilityLabelFor: (index: number) => string;
  /** The visible counter for the card at `index`, "1 dari 2" ("1 of 2"). */
  counterLabel: (index: number) => string;
  /** Called when another card becomes the one in view. */
  onIndexChange?: (index: number) => void;
  /** The parent's side padding the pager reaches past. */
  bleed?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const styles = useStyles();
  const reduced = useReduced();
  const { width: windowWidth } = useWindowDimensions();
  const [frame, setFrame] = useState(0);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const shown = useRef(0);
  const announced = useRef(false);
  const pages = Children.toArray(children);
  const last = Math.max(0, Math.min(count, pages.length) - 1);
  // Until the pager has measured itself, the window stands in for its width (the body caps at 760 plus its padding).
  const width = frame || Math.min(windowWidth, 760 + bleed * 2);
  const page = Math.max(0, width - INSET);
  const interval = page + GAP;

  const show = (next: number) => {
    const clamped = Math.max(0, Math.min(last, next));
    if (clamped === shown.current) return;
    shown.current = clamped;
    setIndex(clamped);
  };

  useEffect(() => {
    onIndexChange?.(index);
    // The first card is not announced: the screen reader is already reading the screen.
    if (announced.current) AccessibilityInfo.announceForAccessibility(accessibilityLabelFor(index));
    announced.current = true;
    // Only a change of card speaks; a new label for the same card (a status update) does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (count < 2 || pages.length < 2) return <>{pages[0] ?? null}</>;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (interval > 0) show(Math.round(e.nativeEvent.contentOffset.x / interval));
  };
  const move = (next: number) => {
    const clamped = Math.max(0, Math.min(last, next));
    scroller.current?.scrollTo({ x: clamped * interval, y: 0, animated: !reduced });
    show(clamped);
  };

  return (
    <View testID={testID} style={style}>
      <View
        style={{ marginHorizontal: -bleed }}
        onLayout={(e) => setFrame(Math.round(e.nativeEvent.layout.width))}
      >
        <ScrollView
          testID={`${testID}-scroll`}
          ref={scroller}
          horizontal
          snapToInterval={interval}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={onScroll}
          onMomentumScrollEnd={onScroll}
          style={{ marginTop: -TOP_ROOM, marginBottom: -SHADOW_ROOM }}
          contentContainerStyle={{
            paddingHorizontal: bleed,
            paddingTop: TOP_ROOM,
            paddingBottom: SHADOW_ROOM,
            gap: GAP,
          }}
        >
          {pages.slice(0, last + 1).map((child, i) => (
            <View key={i} testID="hero-page" style={{ width: page }}>
              {child}
            </View>
          ))}
        </ScrollView>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabelFor(index)}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => move(index + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
        style={styles.indicator}
      >
        <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {pages.slice(0, last + 1).map((_, i) => (
            <View key={i} testID={`hero-dot-${i}`} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>
        <Text style={styles.counter}>{counterLabel(index)}</Text>
      </View>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  indicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 32,
    marginTop: 12,
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  // The active dot is wider as well as darker, so the place reads without colour.
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.secondaryBorder },
  dotActive: { width: 20, backgroundColor: c.forest },
  counter: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.bold,
    color: c.forest,
    fontVariant: ["tabular-nums"],
  },
}));
