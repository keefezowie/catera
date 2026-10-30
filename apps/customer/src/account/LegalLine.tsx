import { Text as RNText } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useMobile } from "@catera/mobile-core";
import { fontFor, Text, useColors } from "@catera/mobile-ui";

/** "Dengan melanjutkan, kamu setuju dengan Syarat & Ketentuan dan Kebijakan Privasi Catera.", each name a link. */
export function LegalLine() {
  const { runtime, t } = useMobile();
  const c = useColors();
  const open = (hash: string) => () => void WebBrowser.openBrowserAsync(`${runtime.apiBase}/syarat-dan-privasi${hash}`).catch(() => undefined);
  const link = { color: c.forest, fontFamily: fontFor("700"), textDecorationLine: "underline" } as const; // forest: action (two links)
  return (
    <Text variant="caption" style={{ textAlign: "center" }} testID="legal-line">
      {t("Dengan melanjutkan, kamu setuju dengan ", "By continuing, you agree to Catera's ")}
      <RNText accessibilityRole="link" style={link} onPress={open("")}>
        {t("Syarat & Ketentuan", "Terms & Conditions")}
      </RNText>
      {t(" dan ", " and ")}
      <RNText accessibilityRole="link" style={link} onPress={open("#privasi")}>
        {t("Kebijakan Privasi", "Privacy Policy")}
      </RNText>
      {t(" Catera.", ".")}
    </Text>
  );
}
