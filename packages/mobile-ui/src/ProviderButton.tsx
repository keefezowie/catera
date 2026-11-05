import { useEffect, useState } from "react";
import { ActivityIndicator, Text as RNText, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { providerMarks } from "@catera/design-tokens";
import { BUSY_DELAY_MS } from "./components";
import { PressableScale } from "./motion";
import { themedStyles, useColors, useThemePreference } from "./theme";
import { fontFor } from "./type";

export type SignInProvider = "apple" | "google" | "email";

// Brand marks are fixed inks from design-tokens `providerMarks`, not theme tones.
const APPLE_BLACK = providerMarks.appleBlack;
const APPLE_WHITE = providerMarks.appleWhite;
const APPLE_PATH =
  "M14.2 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.7 4.8 2.1 5.8 1.2 7.3c-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.7-1-2.7-4.2zM11.6 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z";
const GOOGLE_G = [
  { fill: providerMarks.googleRed, d: "M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" },
  { fill: providerMarks.googleBlue, d: "M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" },
  { fill: providerMarks.googleYellow, d: "M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.9-6.2z" },
  { fill: providerMarks.googleGreen, d: "M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.6 42.6 14.6 48 24 48z" },
];

function Mark({ provider, ink }: { provider: SignInProvider; ink: string }) {
  if (provider === "apple")
    return (
      <Svg testID="provider-mark-apple" width={18} height={20} viewBox="0 0 17 20">
        <Path fill={ink} d={APPLE_PATH} />
      </Svg>
    );
  if (provider === "google")
    return (
      <Svg testID="provider-mark-google" width={18} height={18} viewBox="0 0 48 48">
        {GOOGLE_G.map((p) => (
          <Path key={p.fill} fill={p.fill} d={p.d} />
        ))}
      </Svg>
    );
  return (
    <Svg testID="provider-mark-email" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={5} width={18} height={14} rx={2} />
      <Path d="M3 7l9 6 9-6" />
    </Svg>
  );
}

/**
 * A sign-in provider button: a 52 pill across the width with the provider's mark and its label (passed in, e.g.
 * "Lanjut dengan Google"). Apple is filled per Apple's HIG: black with the white logo in light, white with the black
 * logo in dark. Google and email are outlined on the page. `busy` behaves like Button's: after `BUSY_DELAY_MS` a spinner
 * replaces the mark and label, the size holds, presses are ignored and the label stays the spoken name.
 */
export function ProviderButton({
  provider,
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  provider: SignInProvider;
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  const styles = useStyles();
  const dark = useThemePreference().scheme === "dark";
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!busy) {
      setSpinning(false);
      return;
    }
    const timer = setTimeout(() => setSpinning(true), BUSY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [busy]);
  const apple = provider === "apple";
  const fill = apple ? (dark ? APPLE_WHITE : APPLE_BLACK) : "transparent";
  const ink = apple ? (dark ? APPLE_BLACK : APPLE_WHITE) : c.charcoal;
  return (
    <PressableScale
      testID={`provider-${provider}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled || busy}
      haptic={disabled || busy ? "none" : "tap"}
      onPress={() => {
        if (!busy) onPress();
      }}
      style={[styles.button, apple ? { backgroundColor: fill } : styles.outlined, disabled && styles.disabled]}
    >
      <View style={[styles.row, spinning && { opacity: 0 }]}>
        <Mark provider={provider} ink={ink} />
        <RNText style={[styles.label, { color: ink, flexShrink: 1 }]} numberOfLines={1}>
          {label}
        </RNText>
      </View>
      {spinning ? (
        <View pointerEvents="none" style={styles.spinner}>
          <ActivityIndicator testID="provider-spinner" color={ink} />
        </View>
      ) : null}
    </PressableScale>
  );
}

const useStyles = themedStyles((c) => ({
  button: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: 26,
    borderCurve: "continuous",
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  outlined: { borderWidth: 1.5, borderColor: c.secondaryBorder, backgroundColor: c.surface },
  disabled: { opacity: 0.45 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  label: { fontFamily: fontFor("700"), fontSize: 16 },
  spinner: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
}));
