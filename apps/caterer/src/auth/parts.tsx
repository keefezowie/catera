import type { ReactNode } from "react";
import { Linking, Text as RNText, View } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { Button, PressableScale, Text, fontFor, useColors } from "@catera/mobile-ui";
import { waLink } from "../onboarding";

/** A later step's head: the large title and its line, without the mascot (it waves on the first step only). */
export function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 8, paddingTop: 8 }}>
      <Text variant="display" accessibilityRole="header">
        {title}
      </Text>
      <Text style={{ color: c.muted }}>{subtitle}</Text>
    </View>
  );
}

/** "Dengan mendaftar, kamu setuju dengan Syarat & Ketentuan dan Kebijakan Privasi Catera." Both open the one terms page. */
export function Terms({ lead }: { lead: string }) {
  const { runtime, t } = useMobile();
  const c = useColors();
  const open = () => void Linking.openURL(`${runtime.apiBase}/syarat-dan-privasi`).catch(() => undefined);
  const link = (label: string) => (
    // Nested in the line's Text, so it keeps the line's face and size and only takes the link colour. forest: action
    <RNText accessibilityRole="link" onPress={open} style={{ color: c.forest, textDecorationLine: "underline" }}>
      {label}
    </RNText>
  );
  return (
    <Text testID="terms" variant="meta" style={{ textAlign: "center" }}>
      {`${lead} `}
      {link(t("Syarat & Ketentuan", "Terms"))}
      {` ${t("dan", "and")} `}
      {link(t("Kebijakan Privasi", "Privacy Policy"))}
      {t(" Catera.", " of Catera.")}
    </Text>
  );
}

/** "Cek di WhatsApp" and the line under it: opens a chat with the typed number, which shows the person's own chat when it is right. */
export function WhatsAppCheck({ phone, ready }: { phone: string; ready: boolean }) {
  const { t } = useMobile();
  return (
    <View style={{ gap: 4 }}>
      <Button
        variant="text"
        label={t("Cek di WhatsApp", "Check in WhatsApp")}
        trailingIcon="open-outline"
        disabled={!ready}
        style={{ alignSelf: "flex-start" }}
        onPress={() => void Linking.openURL(waLink(phone)).catch(() => undefined)}
      />
      <Text variant="meta">
        {t(
          "Membuka WhatsApp ke nomor ini. Kalau yang muncul chat dengan dirimu sendiri, nomornya benar.",
          "Opens WhatsApp to this number. If it shows a chat with yourself, the number is right.",
        )}
      </Text>
    </View>
  );
}

/** Daftar's kitchen-area choice as drawn: a 40 tall pill (the shared Chip is 34), its 48 target reached by 4 of slop. */
export const AREA_CHIP = 40;
export function AreaChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      hitSlop={{ top: (48 - AREA_CHIP) / 2, bottom: (48 - AREA_CHIP) / 2 }}
      style={[
        { minHeight: AREA_CHIP, borderRadius: AREA_CHIP / 2, paddingHorizontal: 16, justifyContent: "center" },
        selected ? { backgroundColor: c.forest } : { borderWidth: 1, borderColor: c.secondaryBorder },
      ]}
    >
      <RNText style={{ fontFamily: fontFor("700"), fontSize: 15, color: selected ? c.cream : c.charcoal }}>{label}</RNText>
    </PressableScale>
  );
}

/** The pinned footer of a sign-in step: its switch lines (centred, 12 above the button), then the primary action. */
export function StepFooter({ links, children }: { links?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      {links ? <View style={{ alignItems: "center" }}>{links}</View> : null}
      {children}
    </View>
  );
}

