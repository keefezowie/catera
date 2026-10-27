import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { Text as RNText, TextInput, useWindowDimensions, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Button } from "../components";
import { useHaptic } from "../motion/useHaptic";
import { useReduced } from "../motion/useReduced";
import { themedStyles, useColors } from "../theme";
import { fontFor } from "../type";
import { useT } from "../useT";

/** An SMS code is six digits. */
export const CODE_LENGTH = 6;
const GAP = 8;
/** The page's side margins, 16 each. */
const MARGINS = 32;

/** One slot's width: 48 where it fits, narrower on a phone where six of them and their gaps would not. */
export function codeSlotWidth(width: number): number {
  return Math.min(48, Math.floor((width - MARGINS - (CODE_LENGTH - 1) * GAP) / CODE_LENGTH));
}

/** "0812 3456 7890" -> "0812 •••• 7890": the first 4 and last 4 digits, so the person sees which number it went to. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length <= 8) return digits;
  return `${digits.slice(0, 4)} •••• ${digits.slice(-4)}`;
}

const SHAKE_DP = 8;
const SHAKE_MS = 300;
const RING_MS = 400;

/**
 * The SMS code as six boxes. One hidden `TextInput` (digits only, `oneTimeCode` / `sms-otp` so the keyboard can offer
 * the code from the SMS) lies over the boxes and takes every tap; the boxes only draw what it holds. The box the next
 * digit goes into carries the forest selection ring. `onFilled` runs once each time the sixth digit arrives.
 *
 * `sentTo` writes the masked number above the boxes. `error` puts the danger outline on the boxes and the message under
 * them, shakes the boxes once and fires the warning haptic once per `errorKey` (the message itself when no key is given).
 * `verified` draws a forest ring with a check over the boxes.
 */
export function CodeInput({
  label,
  value,
  onChangeText,
  onFilled,
  invalid = false,
  editable = true,
  inputRef,
  sentTo,
  error,
  errorKey,
  verified = false,
}: {
  label: string;
  value: string;
  onChangeText: (digits: string) => void;
  onFilled: (code: string) => void;
  invalid?: boolean;
  editable?: boolean;
  inputRef?: Ref<TextInput>;
  /** The phone number the code went to, shown masked above the boxes. */
  sentTo?: string;
  /** The wrong-code message. */
  error?: string;
  /** Changes on every wrong code, so the same message shakes and buzzes again. */
  errorKey?: number;
  verified?: boolean;
}) {
  const c = useColors();
  const styles = useStyles();
  const t = useT();
  const haptic = useHaptic();
  const reduced = useReduced();
  const shake = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOpacity.value }));
  const failure = error ? (errorKey ?? error) : undefined;
  useEffect(() => {
    if (failure === undefined) return;
    haptic.warning();
    if (reduced) return;
    const step = SHAKE_MS / 6;
    shake.value = withSequence(
      ...[1, -1, 1, -1, 1, -1].map((dir) => withTiming(dir * SHAKE_DP, { duration: step, easing: Easing.linear })),
      withTiming(0, { duration: 0 }),
    );
  }, [failure, haptic, reduced, shake]);
  useEffect(() => {
    if (!verified) {
      ringOpacity.value = 0;
      return;
    }
    ringOpacity.value = reduced ? 1 : withTiming(1, { duration: RING_MS });
  }, [verified, reduced, ringOpacity]);
  const danger = invalid || !!error;
  const { width } = useWindowDimensions();
  const slot = codeSlotWidth(width);
  const current = Math.min(value.length, CODE_LENGTH - 1);
  // The length the boxes last held, so a repeated change to the same full code does not submit it again.
  const last = useRef(value.length);
  useEffect(() => {
    last.current = value.length;
  }, [value]);

  const change = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    const was = last.current;
    last.current = digits.length;
    onChangeText(digits);
    if (digits.length === CODE_LENGTH && was < CODE_LENGTH) onFilled(digits);
  };

  return (
    <View style={{ gap: 6 }}>
      {sentTo ? (
        <RNText style={{ fontFamily: fontFor("400"), fontSize: 15, lineHeight: 22, color: c.charcoal }}>
          {t("Kode dikirim ke", "Code sent to")} {maskPhone(sentTo)}
        </RNText>
      ) : null}
      {/* The input below carries the label, so a screen reader hears it once. */}
      <RNText
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={{ fontFamily: fontFor("700"), fontSize: 13, color: c.charcoal }}
      >
        {label}
      </RNText>
      <View>
        <Animated.View
          style={[{ flexDirection: "row", gap: GAP }, shakeStyle]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const ring = editable && i === current && !danger;
            return (
              <View
                key={i}
                testID={`code-slot-${i}`}
                style={{
                  width: slot,
                  minHeight: 56,
                  paddingVertical: 8,
                  borderRadius: 9,
                  borderCurve: "continuous",
                  borderWidth: 2,
                  borderColor: danger ? c.danger : ring ? c.forest : c.fieldBorder,
                  backgroundColor: c.inputFill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {value[i] ? (
                  <RNText
                    style={{ fontFamily: fontFor("700"), fontSize: 22, lineHeight: 28, color: c.charcoal, fontVariant: ["tabular-nums"] }}
                  >
                    {value[i]}
                  </RNText>
                ) : null}
              </View>
            );
          })}
        </Animated.View>
        {verified ? (
          <Animated.View
            testID="code-verified"
            pointerEvents="none"
            importantForAccessibility="no"
            style={[styles.ring, ringStyle]}
          >
            <View style={styles.badge}>
              <Ionicons name="checkmark" size={16} color={c.cream} />
            </View>
          </Animated.View>
        ) : null}
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          value={value}
          onChangeText={change}
          editable={editable && !verified}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={CODE_LENGTH}
          autoFocus
          caretHidden
          selectTextOnFocus={false}
          // Nearly transparent rather than 0, so iOS still offers the code from the SMS above the keyboard.
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: "transparent" }}
        />
      </View>
      {error ? (
        <View testID="code-error" accessibilityLiveRegion="polite" style={styles.error}>
          <Ionicons name="alert-circle" size={20} color={c.danger} accessible={false} importantForAccessibility="no-hide-descendants" />
          <RNText selectable style={{ flex: 1, fontFamily: fontFor("400"), fontSize: 14, lineHeight: 20, color: c.danger }}>
            {error}
          </RNText>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  ring: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 2,
    borderColor: c.forest,
    borderRadius: 13,
    borderCurve: "continuous",
  },
  badge: {
    position: "absolute",
    top: -12,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
}));

/** "1:00", "0:42". */
export function countdownText(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Seconds left before a resend is allowed, counting down once a second; `restart` sets it back to the full wait. */
export function useResendTimer(seconds = 60, running = false) {
  const [left, setLeft] = useState(running ? seconds : 0);
  const counting = left > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [counting]);
  const restart = useCallback(() => setLeft(seconds), [seconds]);
  return { left, restart };
}

/** A resend as a text button: muted "Kirim ulang dalam 0:42" while it waits, then `ready` in the action colour. */
export function ResendButton({
  left,
  ready,
  waiting,
  busy = false,
  onPress,
}: {
  left: number;
  ready: string;
  /** The waiting label for a given "0:42". */
  waiting: (time: string) => string;
  busy?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const counting = left > 0;
  return (
    <Button
      variant="text"
      label={counting ? waiting(countdownText(left)) : ready}
      ink={counting ? c.muted : undefined}
      disabled={counting}
      busy={busy}
      style={{ alignSelf: "flex-start" }}
      onPress={onPress}
    />
  );
}
