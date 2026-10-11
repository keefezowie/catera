import { View } from "react-native";
import { router } from "expo-router";
import type { Locale } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import {
  ChoiceList,
  SheetFitBody,
  SheetHeader,
  Text,
  ThemeChoice,
  themeChoiceLabels,
  useColors,
  useThemePreference,
} from "@catera/mobile-ui";

/**
 * The choice sheets Pengaturan opens (`/pengaturan/tampilan`, `/pengaturan/bahasa`, `sheetOptions({ detents: "fit" })`). A choice applies at
 * once and the sheet closes on it; back, a swipe down or Close leave everything as it was.
 */

/** Tampilan: the three theme thumbnails and what following the system means. */
export function TampilanSheet() {
  const { t } = useMobile();
  const { preference, setPreference } = useThemePreference();
  const palette = useColors();
  const ios = process.env.EXPO_OS === "ios";
  return (
    // At a larger font on a small phone the thumbnails and their note scroll under the fixed title row.
    <SheetFitBody foot={24} header={<SheetHeader title={t("Tampilan", "Appearance")} closeLabel={t("Tutup", "Close")} />}>
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
            ? t("Sistem mengikuti pengaturan ponsel Anda.", "System follows your phone's setting.")
            : t("Ikuti sistem memakai pengaturan ponsel Anda.", "Follow system uses your phone's setting.")}
        </Text>
      </View>
    </SheetFitBody>
  );
}

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "id", label: "Indonesia" },
  { value: "en", label: "English" },
];

/** Bahasa: Indonesia or English, each named in its own language. */
export function BahasaSheet() {
  const { t, locale, setLocale } = useMobile();
  return (
    <SheetFitBody header={<SheetHeader title={t("Bahasa", "Language")} closeLabel={t("Tutup", "Close")} />}>
      <ChoiceList
        label={t("Bahasa", "Language")}
        options={LANGUAGES}
        value={locale}
        onChange={(next) => {
          setLocale(next);
          router.back();
        }}
      />
    </SheetFitBody>
  );
}
