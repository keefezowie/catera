import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { Locale } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import {
  ChoiceList,
  SheetHeader,
  Text,
  ThemeChoice,
  themeChoiceLabels,
  useColors,
  useThemePreference,
} from "@catera/mobile-ui";

/**
 * The choice sheets Dapur's Pengaturan opens (`/pengaturan/tampilan`, `/pengaturan/bahasa`, `sheetOptions({ detents: "fit" })`). A choice
 * applies at once and the sheet closes on it; back, a swipe down or Close leave everything as it was.
 */

/** Tampilan: the three theme thumbnails and what following the system means. */
export function TampilanSheet() {
  const { t } = useMobile();
  const { preference, setPreference } = useThemePreference();
  const palette = useColors();
  const insets = useSafeAreaInsets();
  const ios = process.env.EXPO_OS === "ios";
  return (
    <View style={{ paddingBottom: insets.bottom + 24 }}>
      <SheetHeader title={t("Tampilan", "Appearance")} closeLabel={t("Tutup", "Close")} />
      <View style={{ paddingHorizontal: ios ? 20 : 24, gap: 16 }}>
        <ThemeChoice
          label={t("Tampilan", "Appearance")}
          value={preference}
          labels={themeChoiceLabels(t)}
          onChange={(next) => {
            setPreference(next);
            router.back();
          }}
        />
        <Text style={{ color: palette.muted, textAlign: ios ? "center" : "left" }}>
          {ios
            ? t("Sistem mengikuti pengaturan ponsel kamu.", "System follows your phone's setting.")
            : t("Ikuti sistem memakai pengaturan ponsel kamu.", "Follow system uses your phone's setting.")}
        </Text>
      </View>
    </View>
  );
}

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "id", label: "Indonesia" },
  { value: "en", label: "English" },
];

/** Bahasa: Indonesia or English, each named in its own language. */
export function BahasaSheet() {
  const { t, locale, setLocale } = useMobile();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingBottom: insets.bottom + 16 }}>
      <SheetHeader title={t("Bahasa", "Language")} closeLabel={t("Tutup", "Close")} />
      <ChoiceList
        label={t("Bahasa", "Language")}
        options={LANGUAGES}
        value={locale}
        onChange={(next) => {
          setLocale(next);
          router.back();
        }}
      />
    </View>
  );
}
