import Ionicons from "@expo/vector-icons/Ionicons";
import { Text as RNText, View } from "react-native";
import { Rantang } from "./brand/Rantang";
import { PressableScale } from "./motion";
import { SheetFitBody, SheetHandle, useSheetTitleFocus } from "./SheetHeader";
import { useConfirmRoute, type ConfirmIcon, type ConfirmInput } from "./sheets";
import { useColors } from "./theme";
import { useToastAnchor } from "./toastAnchor";
import { fonts } from "./type";

/** The icon circle: 56 across, the glyph at half that. */
const CIRCLE = 56;
const GLYPH = 28;

function ConfirmGlyph({ icon, color }: { icon: ConfirmIcon; color: string }) {
  if (icon === "rantang") return <Rantang size={GLYPH} color={color} testID="confirm-icon-rantang" />;
  return (
    <View testID={`confirm-icon-${icon}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name={icon === "trash" ? "trash-outline" : "flag-outline"} size={GLYPH} color={color} />
    </View>
  );
}

/**
 * The confirm sheet (canvas `ConfirmSheet`): an icon circle, the question as its title, the consequence, and two
 * buttons. A confirmation before an irreversible or customer-visible action, never a routine outcome (that is a toast).
 * - iOS: everything centred under the system grabber; Cancel and the confirm button side by side, equal width.
 * - Android: the Material drag handle, everything at the start edge; a text button and a filled button at the end edge.
 * `tone: "danger"` fills the confirm button in the danger ink (cream on it measures 6.6:1 in light, 5.5:1 in dark),
 * and draws the icon in it. The screen reader starts on the title. `os` defaults to the running platform.
 */
export function ConfirmSheet({
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
  // A sheet: the iOS toast of whatever follows sits at the bottom, not under a header this screen does not have.
  useToastAnchor({});
  const ios = os === "ios";
  const danger = tone === "danger";
  const fill = danger ? palette.danger : palette.forest;
  const align = ios ? "center" : "flex-start";

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
              minHeight: 50,
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
        ...(ios ? { flex: 1, minHeight: 50 } : { minHeight: 48 }),
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
    // At a larger font on a small phone the question can outgrow the screen: it scrolls, buttons included, under the
    // grabber or the drag handle.
    <SheetFitBody testID="confirm-sheet" header={ios ? <View style={{ height: 24 }} /> : <SheetHandle />}>
      <View style={{ paddingHorizontal: 24, gap: 12, alignItems: align }}>
        {icon ? (
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
        ) : null}
        <RNText
          ref={titleRef}
          accessibilityRole="header"
          style={{
            fontFamily: fonts.bold,
            fontSize: ios ? 20 : 22,
            lineHeight: 28,
            color: palette.charcoal,
            textAlign: ios ? "center" : "left",
          }}
        >
          {title}
        </RNText>
        <RNText
          style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: palette.muted, textAlign: ios ? "center" : "left" }}
        >
          {message}
        </RNText>
      </View>
      <View
        testID="confirm-actions"
        style={
          ios
            ? { flexDirection: "row", gap: 12, paddingHorizontal: 24, paddingTop: 24 }
            : { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, paddingHorizontal: 24, paddingTop: 24 }
        }
      >
        {cancel}
        {confirm}
      </View>
    </SheetFitBody>
  );
}

/**
 * The `/konfirmasi` route: shows the question `useConfirm` parked under `?id=` and answers it once. The confirm button
 * answers true; Cancel, the hardware back, a swipe down and an unmount answer false. The answer comes once the sheet
 * has gone (`useQuestionRoute`), so a discard that then closes the form under it never dismisses that sheet while this
 * one is still sliding away. A route with nothing waiting (restored after a reload, or opened by a stray link) closes
 * itself, to Beranda when nothing is under it (a cold OS link). `os` defaults to the running platform.
 */
export function ConfirmRoute({ os }: { os?: string } = {}) {
  const { input, close } = useConfirmRoute(os);
  if (!input) return null;
  return <ConfirmSheet {...input} onConfirm={() => close(true)} onCancel={() => close(false)} />;
}
