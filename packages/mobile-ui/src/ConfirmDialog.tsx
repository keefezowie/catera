import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text as RNText, ScrollView, useWindowDimensions, View } from "react-native";
import { Rantang } from "./brand/Rantang";
import { PressableScale } from "./motion";
import { useSheetTitleFocus } from "./SheetHeader";
import { useConfirmRoute, type ConfirmIcon, type ConfirmInput } from "./sheets";
import { useColors } from "./theme";
import { useToastAnchor } from "./toastAnchor";
import { fonts } from "./type";

/** The iOS icon circle: 48 across, the glyph at half that. Android draws the bare glyph, as a Material dialog does. */
const CIRCLE = 48;
const GLYPH = 24;
/** The dialog's width: an alert's on iOS, Material's 280 to 560 dp on Android, 24 clear of each screen edge. */
const IOS_WIDTH = 300;
const ANDROID_MIN = 280;
const ANDROID_MAX = 560;
const EDGE = 24;
/** The scrim over the page, `overlayInk` at 45% (the alpha as a hex byte). */
const SCRIM_ALPHA = "73";

function ConfirmGlyph({ icon, color }: { icon: ConfirmIcon; color: string }) {
  if (icon === "rantang") return <Rantang size={GLYPH} color={color} testID="confirm-icon-rantang" />;
  return (
    <View testID={`confirm-icon-${icon}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name={icon === "trash" ? "trash-outline" : "flag-outline"} size={GLYPH} color={color} />
    </View>
  );
}

/**
 * The confirm dialog (canvas `Catera confirm dialog`): a centred card over a dimmed page, never a second sheet over a
 * sheet. The icon, the question as its title, the consequence, and two buttons. A confirmation before an irreversible
 * or customer-visible action, never a routine outcome (that is a toast).
 * - iOS: an alert-sized card, everything centred; Cancel and the confirm button side by side, equal width.
 * - Android: the Material 3 dialog: 28 dp corners, 24 dp padding, icon and title centred, the consequence at the start
 *   edge, a text button and a filled button at the end edge.
 * A tap on the scrim cancels. `tone: "danger"` fills the confirm button in the danger ink (cream on it measures 6.6:1 in
 * light, 5.5:1 in dark), and draws the icon in it. The screen reader starts on the title and stays in the card. `os`
 * defaults to the running platform.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone,
  icon,
  onConfirm,
  onCancel,
  os = process.env.EXPO_OS,
}: ConfirmInput & { onConfirm: () => void; onCancel: () => void; os?: string }) {
  const palette = useColors();
  const titleRef = useSheetTitleFocus();
  // Over the page: the iOS toast of whatever follows sits at the bottom, not under a header this route does not have.
  useToastAnchor({});
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const ios = os === "ios";
  const danger = tone === "danger";
  const fill = danger ? palette.danger : palette.forest;
  const room = screenWidth - EDGE * 2;
  const width = ios ? Math.min(IOS_WIDTH, room) : Math.max(Math.min(ANDROID_MAX, room), Math.min(ANDROID_MIN, room));

  const cancel = (
    <PressableScale
      key="cancel"
      accessibilityRole="button"
      accessibilityLabel={cancelLabel}
      haptic="tap"
      onPress={onCancel}
      style={
        ios
          ? {
              flex: 1,
              minHeight: 48,
              borderRadius: 10,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: palette.secondaryBorder,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 12,
            }
          : { minHeight: 48, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }
      }
    >
      {/* forest: action (the cancel label) */}
      <RNText style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.forest, textAlign: "center" }}>{cancelLabel}</RNText>
    </PressableScale>
  );
  const confirm = (
    <PressableScale
      key="confirm"
      accessibilityRole="button"
      accessibilityLabel={confirmLabel}
      haptic="tap"
      onPress={onConfirm}
      style={{
        ...(ios ? { flex: 1, minHeight: 48 } : { minHeight: 48 }),
        borderRadius: 10,
        borderCurve: "continuous",
        backgroundColor: fill,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: ios ? 12 : 20,
      }}
    >
      <RNText style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.cream, textAlign: "center" }}>{confirmLabel}</RNText>
    </PressableScale>
  );

  return (
    <View testID="confirm-dialog" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: EDGE }}>
      {/* The scrim answers Cancel; the screen reader skips it and uses the card's own Cancel. */}
      <Pressable
        testID="confirm-scrim"
        accessible={false}
        importantForAccessibility="no"
        onPress={onCancel}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: `${palette.overlayInk}${SCRIM_ALPHA}` }}
      />
      <View
        testID="confirm-card"
        accessibilityViewIsModal
        style={{
          width,
          maxHeight: screenHeight - EDGE * 4,
          backgroundColor: palette.surface,
          borderRadius: ios ? 20 : 28,
          borderCurve: "continuous",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.2)",
          // In dark the card is the same tone as a dimmed sheet under it and the shadow does not show: the edge does.
          borderWidth: 1,
          borderColor: palette.line,
          overflow: "hidden",
        }}
      >
        {/* At a larger font on a small phone the question can outgrow the screen: it scrolls, buttons included. */}
        <ScrollView
          bounces={false}
          nestedScrollEnabled
          style={{ flexGrow: 0, flexShrink: 1 }}
          contentContainerStyle={{ padding: ios ? 20 : 24, paddingTop: 24 }}
        >
          <View style={{ gap: ios ? 10 : 16, alignItems: "center" }}>
            {icon ? (
              ios ? (
                <View
                  style={{
                    width: CIRCLE,
                    height: CIRCLE,
                    borderRadius: CIRCLE / 2,
                    backgroundColor: palette.sage,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ConfirmGlyph icon={icon} color={danger ? palette.danger : palette.forest} />
                </View>
              ) : (
                <ConfirmGlyph icon={icon} color={danger ? palette.danger : palette.forest} />
              )
            ) : null}
            <RNText
              ref={titleRef}
              accessibilityRole="header"
              style={{
                fontFamily: ios ? fonts.bold : fonts.medium,
                fontSize: ios ? 18 : 22,
                lineHeight: ios ? 24 : 28,
                color: palette.charcoal,
                textAlign: "center",
                alignSelf: "stretch",
              }}
            >
              {title}
            </RNText>
            <RNText
              style={{
                fontFamily: fonts.regular,
                fontSize: 15,
                lineHeight: 22,
                color: palette.muted,
                textAlign: ios ? "center" : "left",
                alignSelf: "stretch",
              }}
            >
              {message}
            </RNText>
          </View>
          <View
            testID="confirm-actions"
            style={
              ios
                ? { flexDirection: "row", gap: 10, paddingTop: 20 }
                : { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, paddingTop: 24 }
            }
          >
            {cancel}
            {confirm}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * The `/konfirmasi` route: shows the question `useConfirm` parked under `?id=` and answers it once. The confirm button
 * answers true; Cancel, a tap on the scrim, the hardware back and an unmount answer false. The answer comes once the
 * dialog has gone (`useQuestionRoute`), so a discard that then closes the form under it never dismisses that sheet
 * while the dialog is still fading. A route with nothing waiting (restored after a reload, or opened by a stray link)
 * closes itself, to Beranda when nothing is under it (a cold OS link). `os` defaults to the running platform.
 */
export function ConfirmRoute({ os }: { os?: string } = {}) {
  const { input, close } = useConfirmRoute(os);
  if (!input) return null;
  return <ConfirmDialog {...input} onConfirm={() => close(true)} onCancel={() => close(false)} />;
}
