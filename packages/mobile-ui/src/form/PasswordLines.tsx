import { useEffect, useRef } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCaptionStyle } from "../components";
import { themedStyles, useColors } from "../theme";
import { useT } from "../useT";

type Look = "idle" | "met" | "bad";

function Line({ look, text, testID }: { look: Look; text: string; testID: string }) {
  const c = useColors();
  const styles = useStyles();
  const caption = useCaptionStyle();
  const color = look === "met" ? c.forest : look === "bad" ? c.danger : c.muted;
  const name = look === "met" ? "checkmark-circle" : look === "bad" ? "alert-circle" : "ellipse-outline";
  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={styles.row}>
      <Ionicons name={name} size={16} color={color} style={styles.icon} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden />
      <Text selectable style={[caption, { color, flex: 1 }]}>
        {text}
      </Text>
    </View>
  );
}

/** A danger message with its glyph under something that is not a text input (the area chips), set as a Field's own error line. */
export const FieldMessage = ({ text, testID = "field-message" }: { text: string; testID?: string }) => <Line look="bad" text={text} testID={testID} />;

/** One line under a password field: muted ring, forest check once met (announced once), danger when short after a blur or submit. */
export function PasswordRule({ value, min = 8, failed }: { value: string; min?: number; failed: boolean }) {
  const t = useT();
  const met = value.length >= min;
  const was = useRef(met);
  useEffect(() => {
    if (met && !was.current) AccessibilityInfo.announceForAccessibility(t("Syarat kata sandi terpenuhi", "Password requirement met"));
    was.current = met;
  }, [met, t]);
  return <Line testID="password-rule" look={met ? "met" : failed ? "bad" : "idle"} text={t(`Minimal ${min} karakter`, `At least ${min} characters`)} />;
}

/** Quiet until the second field is as long as the first, or `touched`; then a match check or the mismatch message. */
export function PasswordMatch({ first, second, touched }: { first: string; second: string; touched: boolean }) {
  const t = useT();
  if (!first && !second) return null;
  if (!touched && second.length < first.length) return null;
  return first === second ? (
    <Line testID="password-match" look="met" text={t("Kata sandinya sama", "Passwords match")} />
  ) : (
    <Line testID="password-match" look="bad" text={t("Kata sandinya belum sama.", "The passwords don't match.")} />
  );
}

const useStyles = themedStyles(() => ({
  row: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  icon: { marginTop: 1 },
}));
