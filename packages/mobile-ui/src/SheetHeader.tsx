import { Children, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { AccessibilityInfo, AppState, Keyboard, ScrollView, StyleSheet, Text as RNText, useWindowDimensions, View } from "react-native";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./components";
import { HeaderIconButton } from "./HeaderIconButton";
import { Skeleton, SkeletonGroup } from "./Skeleton";
import { useScreenNavigation } from "./navigation";
import { measureWindowEdge } from "./windowEdge";
import { SHEET_FOCUS_FALLBACK_MS, SHEET_FOCUS_SETTLE_MS, useSheetPresence } from "./sheets";
import { useColors } from "./theme";
import { androidTabBarHeight, insideTabs, useToastAnchor } from "./toastAnchor";
import { fonts } from "./type";

/** iOS reserves this much on each side of the centred title: the 44pt Close and its mirror. */
const IOS_SIDE = 44;
/** The context line's height (14/20), held while it is read. */
const CONTEXT_LINE = 20;

/**
 * Puts the screen reader on a sheet's title once the sheet has risen, so TalkBack and VoiceOver start on what the sheet
 * is, not on the page under it or the first button. It sends the focus on the stack's `transitionEnd` (the sheet's own
 * present, never its close) and once more `SHEET_FOCUS_SETTLE_MS` later, because TalkBack re-asserts its focus on the
 * window under the sheet after react-native-screens hides the page there. A present that has not reported after
 * `SHEET_FOCUS_FALLBACK_MS` (outside a navigator) is replaced by the fallback, which settles the same way. While the
 * sheet's screen is focused it counts as on top (`useSheetPresence`), so the demo strip and the tab bar leave the
 * accessibility tree and cannot catch the focus. Returns the ref for the title text.
 */
export function useSheetTitleFocus() {
  const ref = useRef<RNText>(null);
  const navigation = useScreenNavigation();
  useSheetPresence();
  useEffect(() => {
    let settle: ReturnType<typeof setTimeout> | undefined;
    const focus = () => {
      if (ref.current) AccessibilityInfo.sendAccessibilityEvent(ref.current, "focus");
    };
    const land = () => {
      focus();
      clearTimeout(settle);
      settle = setTimeout(focus, SHEET_FOCUS_SETTLE_MS);
    };
    const fallback = setTimeout(land, SHEET_FOCUS_FALLBACK_MS);
    const presented = navigation?.addListener("transitionEnd" as never, (e: { data?: { closing?: boolean } }) => {
      if (e.data?.closing) return;
      clearTimeout(fallback);
      land();
    });
    return () => {
      clearTimeout(fallback);
      clearTimeout(settle);
      presented?.();
    };
  }, [navigation]);
  return ref;
}

/**
 * Android's Material drag handle (32×4 in a 36dp band), which react-native-screens does not draw. Hidden from screen
 * readers: back and a swipe down close the sheet.
 */
export function SheetHandle() {
  const palette = useColors();
  return (
    <View
      testID="sheet-handle-band"
      style={{ height: 36, alignItems: "center", justifyContent: "center" }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View testID="sheet-handle" style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: palette.fieldBorder }} />
    </View>
  );
}

/**
 * Whether the on-screen keyboard is up, and its height (0 while it is down). An Android form sheet does not resize for the keyboard, so
 * the keyboard covers its lower part: the body gives that much up so a focused field and the action under it stay above it.
 */
function useKeyboard(): { up: boolean; height: number } {
  const [state, setState] = useState({ up: false, height: 0 });
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (e?: { endCoordinates?: { height?: number } }) =>
      setState({ up: true, height: Math.max(0, Math.round(e?.endCoordinates?.height ?? 0)) }),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () => setState({ up: false, height: 0 }));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return state;
}

/**
 * How much of an Android form sheet's bottom the tab bar draws over: in a tab's stack the bottom sheet sits inside the
 * tab host, under the Material 3 navigation bar (80dp, `ANDROID_TAB_BAR`) and the system inset it pays. iOS presents
 * every sheet above the tab bar, a root-stack sheet has no bar under it, and react-native-screens 4.26 gives JS no reading of the bar's laid-out height, so this is the bar's Material
 * height, grown with the font scale's label line (`androidTabBarHeight`), plus the inset measured on the phone.
 */
function useTabBarOverSheet(os: string | undefined): number {
  const insets = useSafeAreaInsets();
  const navigation = useScreenNavigation();
  const { fontScale } = useWindowDimensions();
  if (os === "ios" || !insideTabs(navigation as Parameters<typeof insideTabs>[0])) return 0;
  return androidTabBarHeight(fontScale) + insets.bottom;
}

/** How long after a sheet's present the body measures itself, for a present that never reports. */
const SHEET_MEASURE_FALLBACK_MS = 700;

/**
 * How much of a sheet body's bottom lies under the screen's edge. react-native-screens 4.26 lays an Android form sheet
 * out at its tallest detent and slides it down to the lower one, so at the 0.6 detent the lower 40% of the scroll view,
 * and the foot padding with the last button in it, sit below the window and no scrolling brings them back. `top` and
 * `height` are the scroll view's window position and size now, `margin` the bottom margin already given to it (its
 * `height` is that much shorter), `windowHeight` the screen's. Once the sheet is expanded the answer falls to 0.
 */
export function sheetHiddenBelow({
  top,
  height,
  margin,
  windowHeight,
}: {
  top: number;
  height: number;
  margin: number;
  windowHeight: number;
}): number {
  const hidden = top + height + margin - windowHeight;
  return hidden > 1 ? Math.round(hidden) : 0;
}

/**
 * The bottom margin an Android root-stack form sheet's scroll view needs so that it ends at the screen's edge (see
 * `sheetHiddenBelow`). It measures after the sheet has risen, each time it settles on a detent and each time the window
 * changes size (rotation, split screen), against the root frame's height; 0 when inactive.
 */
function useSheetHiddenBelow(
  active: boolean,
  ref: RefObject<{ measureInWindow?: unknown } | null>,
  keyboard = 0,
  footerHeight = 0,
  tabBar = 0,
  barShown: { current: number } = { current: 0 },
): { below: number; short: boolean; barFit: number | null } {
  const navigation = useScreenNavigation();
  // What the last settled measure found: the part of the frame below the edge, the frame's height without margin, and the keyboard lift
  // it was measured with.
  const [measured, setMeasured] = useState<{ below: number; frame: number; keyboard: number; barFit: number | null }>({
    below: 0,
    frame: 0,
    keyboard: 0,
    barFit: null,
  });
  // The detent is moving (react-native-screens reported an unstable state): what is measured now is a frame of the move.
  const [moving, setMoving] = useState(false);
  // The last settled reading with the keyboard up and with it down, so a keyboard change does not carry the other's.
  const lastBelow = useRef({ up: 0, down: 0 });
  const keyboardRef = useRef(keyboard);
  keyboardRef.current = keyboard;
  // A reading is trusted when the sheet is not moving and it was taken with the keyboard the sheet has now. Until then
  // (the keyboard just came or left, the sheet is still sliding to its other detent) the last settled reading for this
  // keyboard state stands in, never the other state's: the form detent's hidden-below added to a full keyboard lift
  // lifted the footer about 285dp too high for 300ms while the sheet rose.
  const trusted = !moving && measured.keyboard === keyboard;
  // The stand-in is the smaller of that and the latest settled reading, which knows the detent the sheet is at: the
  // remembered value alone brought back the form detent's 200dp after the sheet had risen. Under-lifting is the safe side.
  const remembered = keyboard > 0 ? lastBelow.current.up : lastBelow.current.down;
  const below = trusted ? measured.below : Math.min(remembered, measured.below);
  // Inside the tabs there is no hidden-below to find, but the room above the keyboard is still read.
  const track = active || keyboard > 0 || tabBar > 0;
  // A tab sheet keeps the bar's own height until its first reading, then follows what is measured (the bar margin fit).
  const marginRef = useRef(0);
  // Kept equal to what is rendered, so a measure never works from a margin the scroll view no longer has.
  marginRef.current = below + keyboard;
  // The root view's frame is the one `measureInWindow` reports in. `useWindowDimensions` can differ from it by the
  // navigation bar on Android 14 and older, which would count that bar twice.
  const { width, height: windowHeight } = useSafeAreaFrame();
  const measuredSize = useRef<string>("");
  const keyboardChanged = useRef(0);
  const movingRef = useRef(false);
  // The sheet has had a settled reading, and has been left (blurred) since: only then does a focus mean "back to the tab".
  // The opening focus comes while the sheet still slides in, and measuring then reads a frame of the slide.
  const settledOnce = useRef(false);
  const blurred = useRef(false);
  const recoveries = useRef(0);
  useEffect(() => {
    if (!track) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stuck: ReturnType<typeof setTimeout> | undefined;
    const measure = (fromDetent: boolean) => {
      const view = ref.current;
      const host = view as unknown as Partial<Pick<View, "measureInWindow">> | null;
      if (!host?.measureInWindow) return;
      host.measureInWindow((_x: number, top: number, _w: number, height: number) => {
        if (!Number.isFinite(top) || !Number.isFinite(height)) return;
        if (height <= 0) {
          // The margin left the scroll view no height: it was read mid-slide and is oversized. Drop it and read again (a
          // few times at most: the scroll view only shows the smaller margin once it has rendered).
          if ((marginRef.current > keyboardRef.current || recoveries.current > 0) && recoveries.current < 3) {
            recoveries.current += 1;
            lastBelow.current = { up: 0, down: 0 };
            marginRef.current = keyboardRef.current;
            setMeasured((was) => (was.below === 0 ? was : { ...was, below: 0 }));
            later(fromDetent);
          }
          return;
        }
        // The screen's edge in the same window space as `top`; the frame's height only while no root reference exists.
        measureWindowEdge((edge) => {
          // A move that is still going on is settled by its own stable event, not by a timer that ran in the middle of it.
          if (movingRef.current && !fromDetent) return;
          const edgeBottom = edge ?? windowHeight;
          const next = active ? sheetHiddenBelow({ top, height, margin: marginRef.current, windowHeight: edgeBottom }) : 0;
          const lifted = keyboardRef.current;
          // The frame's height with no margin, so it is the same whatever margin it was read under.
          const full = height + marginRef.current;
          lastBelow.current[lifted > 0 ? "up" : "down"] = next;
          clearTimeout(stuck);
          movingRef.current = false;
          settledOnce.current = true;
          recoveries.current = 0;
          setMoving(false);
          // A tab sheet's frame should end at the bar's top. At the large detent, after a tab switch or a keyboard, the native
          // frame can sit shifted up by the bar, which the bar margin then doubles: the margin only fills the gap that is
          // really there. Read in every state, not only after a keyboard (g-c-10).
          let barFit: number | null = null;
          if (!active && tabBar > 0 && barShown.current >= 0) {
            const unmargined = top + height + Math.max(0, barShown.current) + marginRef.current;
            barFit = Math.min(tabBar, Math.max(0, Math.round(unmargined - edgeBottom + tabBar)));
          }
          setMeasured((was) =>
            was.below === next && was.frame === full && was.keyboard === lifted && was.barFit === barFit
              ? was
              : { below: next, frame: full, keyboard: lifted, barFit },
          );
        });
      });
    };
    let settled: ReturnType<typeof setTimeout> | undefined;
    let settledLate: ReturnType<typeof setTimeout> | undefined;
    const later = (fromDetent = false) => {
      clearTimeout(timer);
      timer = setTimeout(() => measure(fromDetent), 50);
    };
    const fallback = setTimeout(() => measure(true), SHEET_MEASURE_FALLBACK_MS);
    // A new window size moves the sheet and its scroll view: measure again once the layout has followed.
    // The keyboard rising or leaving moves the sheet too (it expands to its top detent): measure again after it settles.
    if (keyboardChanged.current !== keyboard) {
      keyboardChanged.current = keyboard;
      later();
      // A tab sheet's native shift can land after the first reading: read once more when the keyboard's slide is over.
      if (!active) settled = setTimeout(() => measure(false), 450);
    }
    const size = `${width}x${windowHeight}`;
    if (measuredSize.current && measuredSize.current !== size) later();
    measuredSize.current = size;
    // Coming back to the tab: the native sheet is laid out again, possibly shifted up by the bar, and no other event says
    // so. Read again, and twice more as the shift can land late.
    const remeasure = () => {
      later();
      clearTimeout(settled);
      clearTimeout(settledLate);
      settled = setTimeout(() => measure(false), 450);
      settledLate = setTimeout(() => measure(false), 1200);
    };
    const away = navigation?.addListener("blur" as never, () => {
      blurred.current = true;
    });
    const back = navigation?.addListener("focus" as never, () => {
      if (!settledOnce.current || !blurred.current) return;
      blurred.current = false;
      remeasure();
    });
    // The app resumed from the background: the native shift can have changed with no event to say so.
    const resumed =
      !active && tabBar > 0
        ? AppState.addEventListener("change", (state) => {
            if (state === "active" && settledOnce.current) remeasure();
          })
        : undefined;
    const done = navigation?.addListener("transitionEnd" as never, () => later());
    const detent = navigation?.addListener("sheetDetentChange" as never, (e: { data?: { stable?: boolean } }) => {
      if (e.data?.stable === false) {
        // The sheet is sliding to another detent: hold the last settled reading until it stops. A stop that is never
        // reported is read after a second.
        movingRef.current = true;
        setMoving(true);
        clearTimeout(stuck);
        stuck = setTimeout(() => measure(true), 1000);
      } else later(true);
    });
    return () => {
      clearTimeout(fallback);
      clearTimeout(timer);
      clearTimeout(settled);
      clearTimeout(settledLate);
      clearTimeout(stuck);
      back?.();
      away?.();
      resumed?.remove();
      done?.();
      detent?.();
    };
  }, [active, track, navigation, ref, width, windowHeight, keyboard, tabBar]);
  // With the keyboard up the frame ends at its top. When the sheet stays at its form detent that leaves less than a
  // body and a pinned footer need, so the footer joins the scroll content instead and the field keeps its room.
  const short = keyboard > 0 && trusted && measured.frame > 0 && measured.frame - (below + keyboard) < footerHeight + SHEET_MIN_BODY;
  return { below: active ? below : 0, short, barFit: keyboard > 0 || measured.keyboard > 0 ? null : measured.barFit };
}

/**
 * A cheap fingerprint of a footer's content: its elements and the text in them. It changes when an error line appears,
 * changes its words or goes, and not when only the layout around the footer moves.
 */
function footerKey(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(footerKey).join("|");
  if (!isValidElement(node)) return "";
  const props = node.props as { children?: ReactNode; message?: unknown };
  const type = typeof node.type === "string" ? node.type : (node.type as { name?: string }).name ?? "";
  const own = typeof props.message === "string" ? props.message : "";
  return `<${type}:${own}>${Children.toArray(props.children).map(footerKey).join("|")}`;
}

/** The least height a scroll view is worth beside a pinned footer: a field with its label. */
const SHEET_MIN_BODY = 120;
/** A pinned footer's height before it has been laid out: a 52 button, the 12 and 16 padding. */
const SHEET_FOOTER_GUESS = 96;

/** The side padding of a `SheetBody`: 20 on iOS, 24 on Android. */
export const sheetSidePadding = (os = process.env.EXPO_OS) => (os === "ios" ? 20 : 24);

/**
 * The scrolling content of a form sheet (`sheetOptions({ detents: "form" })`), under its `SheetHeader`. Keyboard: on
 * iOS the scroll view insets itself so the focused field stays above the keyboard (`automaticallyAdjustKeyboardInsets`);
 * on Android a two-detent sheet expands to its top detent while the keyboard is up (react-native-screens'
 * `SheetDelegate`), and the scroll view keeps taps on its buttons while it is up. The foot clears the home indicator or
 * the gesture bar. In a tab's stack on Android the scroll view ends above the tab bar, which draws over the sheet's
 * bottom (spec 4.2): the last button scrolls fully clear of it at the 0.6 detent, and TalkBack's scroll-into-view stops
 * above it too. `os` defaults to the running platform.
 */
export function SheetBody({
  children,
  footer,
  os = process.env.EXPO_OS,
}: {
  children: ReactNode;
  /**
   * The sheet's primary action (and the error above it), pinned under the scroll view instead of scrolling with it. It is
   * lifted by the same amounts as the body (the part of an Android root-stack sheet below the screen's edge, the keyboard,
   * the tab bar), so it is visible and tappable at the form detent at any font size, above the gesture bar or home
   * indicator. It follows the content in the tree, so a screen reader reaches it last. A component deep in the content
   * that owns the action's state can pin it with `SheetFooter` instead.
   */
  footer?: ReactNode;
  os?: string;
}) {
  const insets = useSafeAreaInsets();
  const palette = useColors();
  const ios = os === "ios";
  const { up, height: keyboard } = useKeyboard();
  const tabBar = useTabBarOverSheet(os);
  const frame = useRef<View>(null);
  const [slot, setSlot] = useState<ReactNode>(null);
  const pinned = footer ?? slot;
  const hasFooter = pinned != null && pinned !== false;
  const navigation = useScreenNavigation();
  // A root-stack Android sheet (no bar under it) is laid out at its tallest detent: its frame must end at the edge.
  // Inside the tabs the bar's share is 0 only while the keyboard is up, and the sheet is not a root one then.
  // The reported height stops at the navigation bar (ime.bottom minus the system bars) while the sheet reaches the
  // window bottom, so the bar's inset is added to end at the keyboard's top.
  // In a tab's stack the bar's share is taken off the lift. This is an empirical fit for the keyboard-up case: g-c-8
  // measured the frame ending 104dp (the bar plus its inset) above the keyboard's top. Without the keyboard the sheet
  // reaches the window bottom and the JS bar margin lifts it; why the keyboard-up frame ends higher is unexplained. The
  // fit depends on `androidTabBarHeight(fontScale)` plus the inset matching the real bar. g-c-9 found the shift can outlast the
  // keyboard, and g-c-10 that it is not keyboard-specific (at the large detent after a tab switch the frame ends a bar
  // above the window bottom), so the tab sheet is always measured, after the keyboard, a detent move, a window change and
  // a return to the tab, and the bar margin is trimmed to the gap that is really there (`barFit`).
  const keyboardLift = os === "android" && keyboard > 0 ? Math.max(0, keyboard + insets.bottom - tabBar) : 0;
  // The frame holds the scroll view and the footer, so both are lifted by what is measured.
  const [footerHeight, setFooterHeight] = useState(SHEET_FOOTER_GUESS);
  const scroller = useRef<ScrollView>(null);
  // The footer's content changed (an error came or went) and no keyboard change has come since: only then is an inline
  // footer worth a scroll. A keyboard that flips the footer inline lays it out too, and the focused field must stay.
  const contentChanged = useRef(false);
  const lastKey = useRef(footerKey(pinned));
  const lastKeyboard = useRef(keyboard);
  useLayoutEffect(() => {
    if (lastKeyboard.current !== keyboard) {
      lastKeyboard.current = keyboard;
      contentChanged.current = false;
    }
    const key = footerKey(pinned);
    if (lastKey.current !== key) {
      lastKey.current = key;
      contentChanged.current = true;
    }
  });
  const bodyHeight = useRef(0);
  const barShown = useRef(0);
  const { below, short, barFit } = useSheetHiddenBelow(
    os === "android" && !insideTabs(navigation as Parameters<typeof insideTabs>[0]),
    frame,
    keyboardLift,
    footerHeight,
    tabBar,
    barShown,
  );
  // While the keyboard is up it covers the bar, so the frame no longer gives it room as a margin ...
  // ... and after it hid, the bar's margin is what a measure of the frame found missing (see `useSheetHiddenBelow`).
  const bar = up ? 0 : barFit ?? tabBar;
  // The bar's share is still "there" when it measured 0: only the keyboard hides it. -1 tells a measure the keyboard is up.
  const barThere = tabBar > 0 && !up;
  barShown.current = up ? -1 : bar;
  // While the keyboard is up an Android frame ends at its top, so the focused field scrolls into view above it.
  // `below` is how far the frame's unlifted bottom still lies under the screen's edge (measured with the keyboard's
  // lift counted), and the keyboard sits above that edge, so the two add: a sheet that reaches 50dp past the edge with
  // the keyboard up (the Dapur import row, a sheet over a modal) needs the keyboard's lift plus those 50dp.
  const lift = below + keyboardLift;
  // iOS: a sheet is not resized for the keyboard, so a pinned footer rides on it (the scroll view then needs no inset of its own).
  const iosLift = ios && hasFooter ? keyboard : 0;
  // The sheet stayed at its form detent under the keyboard: the footer scrolls after the content instead of being pinned.
  const inline = hasFooter && short;
  const footerView = hasFooter ? (
    <View
      testID="sheet-footer"
      onLayout={(e) => {
        const { y, height: h } = e.nativeEvent.layout;
        if (!(h > 0)) return;
        if (!inline) setFooterHeight((was) => (was === h ? was : h));
        // Inline, a footer that grows (an error above the action) is scrolled to: its top, where the error sits, goes to the
        // top of the body, or, when the body is taller than the footer, the whole footer is brought in at the bottom.
        // An error that flipped a pinned footer inline lands scrolled the same way: the first inline layout after the
        // footer's content changed. A keyboard that flipped it (no content change) never scrolls: the field stays in view.
        if (inline && contentChanged.current) {
          contentChanged.current = false;
          scroller.current?.scrollTo({ y: Math.max(0, bodyHeight.current > h ? y + h - bodyHeight.current : y), animated: true });
        }
      }}
      style={{
        paddingHorizontal: sheetSidePadding(os),
        paddingTop: 12,
        // The tab bar and the keyboard already clear the system inset; the screen's edge does not, so the footer pays it there.
        paddingBottom: (barThere || (os === "android" && keyboard > 0) || iosLift > 0 ? 0 : insets.bottom) + 16,
        gap: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.line,
        backgroundColor: palette.surface,
        // Inside the scroll content it spans the padded width.
        ...(inline ? { marginHorizontal: -sheetSidePadding(os), marginTop: 4 } : null),
      }}
    >
      {pinned}
    </View>
  ) : null;
  return (
    <SheetFooterContext.Provider value={setSlot}>
      {/* The bar pays the system inset itself, so a sheet that ends above it keeps only the 24 foot. */}
      <View ref={frame} testID="sheet-frame" style={{ flex: 1, marginBottom: bar + lift + iosLift }}>
        <ScrollView
          ref={scroller}
          testID="sheet-body"
          style={{ flex: 1 }}
          onLayout={(e) => {
            bodyHeight.current = e.nativeEvent.layout.height;
          }}
          automaticallyAdjustKeyboardInsets={ios && !hasFooter}
          keyboardShouldPersistTaps="handled"
          // Android: a drag on the form scrolls it, rather than dragging the bottom sheet.
          nestedScrollEnabled
          contentContainerStyle={{
            paddingHorizontal: sheetSidePadding(os),
            paddingTop: 4,
            paddingBottom: hasFooter ? (inline ? 0 : 16) : (barThere ? 0 : insets.bottom) + 24,
            gap: 16,
          }}
        >
          {children}
          {inline ? footerView : null}
        </ScrollView>
        {inline ? null : footerView}
      </View>
    </SheetFooterContext.Provider>
  );
}

const SheetFooterContext = createContext<((node: ReactNode) => void) | null>(null);

/**
 * Pins its children as the footer of the `SheetBody` it sits in, for an action whose state lives in a component inside
 * the content (the calendar's "Pindah ke …"). It draws nothing where it stands. Outside a `SheetBody` it draws its
 * children in place.
 */
export function SheetFooter({ children }: { children: ReactNode }) {
  const set = useContext(SheetFooterContext);
  // Every render hands over the current children; the body re-renders, this does not (its element is unchanged).
  useLayoutEffect(() => {
    set?.(children);
  });
  useLayoutEffect(() => () => set?.(null), [set]);
  return set ? null : <>{children}</>;
}

/** The gap a fit sheet keeps under the top safe area at its tallest: the iOS large detent's and the status bar's. */
const FIT_TOP_GAP = 24;

/**
 * A fit sheet (`sheetOptions({ detents: "fit" })`): its `header` (the `SheetHeader`) fixed on top and its content under
 * it. The sheet sizes to the content while it fits; content that outgrows the screen (a long address book, a larger
 * font) stops the sheet at its tallest and scrolls under the fixed title row, so the last row and the button under it
 * stay reachable. The foot clears the home indicator or the gesture bar, plus `foot` (16 by default). Every fit sheet
 * draws its body through this, so none can hide its last button behind the screen's edge.
 */
export function SheetFitBody({
  header,
  children,
  foot = 16,
  testID,
}: {
  header: ReactNode;
  children: ReactNode;
  /** The space under the content, above the home indicator or the gesture bar. */
  foot?: number;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <View testID={testID} style={{ maxHeight: height - insets.top - FIT_TOP_GAP }}>
      {header}
      <ScrollView
        testID="sheet-fit-body"
        style={{ flexGrow: 0, flexShrink: 1 }}
        alwaysBounceVertical={false}
        // Android: a drag on a long list scrolls it, rather than dragging the bottom sheet.
        nestedScrollEnabled
        contentContainerStyle={{ paddingBottom: insets.bottom + foot }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * The title row of a native sheet (`sheetOptions`), drawn by the sheet itself because its stack header is hidden.
 * - iOS: a 44pt Close at the leading edge (spoken `closeLabel`, "Tutup" by default) and the title 17 bold, centred,
 *   under the system grabber.
 * - Android: the Material drag handle (32×4 in a 36dp band) and the title 22 bold at the start edge, the M3 sheet title.
 *   There is no Close: back and a swipe down close the sheet.
 * `context` is an optional line under the title (the day, the package). By default it wraps, so at a larger font it
 * grows with its text and nothing is cut; a null or missing `context` draws no line.
 * A sheet whose header must keep one height from loading to ready opts in with `holdContextLine`: the context is then
 * one line, ending in "…" when it is longer, with the whole text given to screen readers, and a `context` of null is a
 * line still being read: its 20 is held by a skeleton line (breathing with the sheet body's own skeleton), so the
 * header keeps its height when the line lands.
 * Close calls `onClose`, else goes back.
 * The screen reader starts on the title (`useSheetTitleFocus`).
 * In a sheet it also tells the toast so (`useToastAnchor`), so on iOS a sheet without a `Screen` still shows its
 * toasts at the bottom. `os` defaults to the running platform.
 */
export function SheetHeader({
  title,
  context,
  holdContextLine = false,
  onClose,
  closeLabel = "Tutup",
  os = process.env.EXPO_OS,
}: {
  title: string;
  context?: string | null;
  /** Holds the context to one line, and a null context to a skeleton line, so the header keeps its height. */
  holdContextLine?: boolean;
  onClose?: () => void;
  /** The translated spoken name of Close; this package has no i18n. */
  closeLabel?: string;
  os?: string;
}) {
  const palette = useColors();
  const navigation = useScreenNavigation();
  const titleRef = useSheetTitleFocus();
  useToastAnchor({});
  const ios = os === "ios";
  const close = onClose ?? (() => navigation?.goBack());
  const contextLine =
    holdContextLine && context === null ? (
      <SkeletonGroup>
        <View
          testID="sheet-context"
          style={{ height: CONTEXT_LINE, justifyContent: "center", alignItems: ios ? "center" : "flex-start" }}
        >
          <Skeleton width="60%" height={12} radius={6} />
        </View>
      </SkeletonGroup>
    ) : context ? (
      <Text
        testID="sheet-context"
        // A selectable TextView on Android does not ellipsize: a held line wraps inside its one-line height.
        selectable={!holdContextLine}
        numberOfLines={holdContextLine ? 1 : undefined}
        accessibilityLabel={holdContextLine ? context : undefined}
        style={{ color: palette.muted, fontSize: 14, lineHeight: CONTEXT_LINE, textAlign: ios ? "center" : "left" }}
      >
        {context}
      </Text>
    ) : null;

  if (ios)
    return (
      <View style={{ paddingTop: 12, paddingHorizontal: 8, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", minHeight: IOS_SIDE }}>
          <HeaderIconButton icon="close" label={closeLabel} onPress={close} os="ios" />
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <RNText
              ref={titleRef}
              accessibilityRole="header"
              style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: palette.charcoal, textAlign: "center" }}
            >
              {title}
            </RNText>
          </View>
          <View style={{ width: IOS_SIDE }} />
        </View>
        {contextLine ? <View style={{ paddingHorizontal: IOS_SIDE + 4 }}>{contextLine}</View> : null}
      </View>
    );

  return (
    <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
      <SheetHandle />
      <RNText
        ref={titleRef}
        accessibilityRole="header"
        style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: palette.charcoal, textAlign: "left" }}
      >
        {title}
      </RNText>
      {contextLine}
    </View>
  );
}
