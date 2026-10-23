import { useEffect, useRef, useState, type Ref } from "react";
import { Text as RNText, TextInput, useWindowDimensions, View } from "react-native";
import { Button, fontFor, useColors } from "@catera/mobile-ui";

/** An SMS code is six digits. */
export const CODE_LENGTH = 6;
const GAP = 8;
/** The page's side margins, 16 each. */
const MARGINS = 32;

/** One slot's width: 48 where it fits, narrower on a phone where six of them and their gaps would not. */
export function codeSlotWidth(width: number): number {
  return Math.min(48, Math.floor((width - MARGINS - (CODE_LENGTH - 1) * GAP) / CODE_LENGTH));
}

/**
 * The SMS code as six boxes. One hidden `TextInput` (digits only, `oneTimeCode` / `sms-otp` so the keyboard can offer
 * the code from the SMS) lies over the boxes and takes every tap; the boxes only draw what it holds. The box the next
 * digit goes into carries the forest selection ring. `onFilled` runs once each time the sixth digit arrives.
 */
export function CodeInput({
  label,
  value,
  onChangeText,
  onFilled,
  invalid = false,
  editable = true,
  inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (digits: string) => void;
  onFilled: (code: string) => void;
  invalid?: boolean;
  editable?: boolean;
  inputRef?: Ref<TextInput>;
}) {
  const c = useColors();
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
      <RNText style={{ fontFamily: fontFor("700"), fontSize: 13, color: c.charcoal }}>{label}</RNText>
      <View>
        <View
          style={{ flexDirection: "row", gap: GAP }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const ring = editable && i === current && !invalid;
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
                  borderColor: invalid ? c.danger : ring ? c.forest : c.fieldBorder,
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
        </View>
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          value={value}
          onChangeText={change}
          editable={editable}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={CODE_LENGTH}
          autoFocus
          caretHidden
          contextMenuHidden={false}
          // Nearly transparent rather than 0, so iOS still offers the code from the SMS above the keyboard.
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: "transparent" }}
        />
      </View>
    </View>
  );
}

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
  return { left, restart: () => setLeft(seconds) };
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
