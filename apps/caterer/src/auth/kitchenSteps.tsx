import { useRef, useState } from "react";
import { AccessibilityInfo, View, type ViewInstance } from "react-native";
import * as Crypto from "expo-crypto";
import { nativeLayout } from "@catera/design-tokens";
import { areaOptions } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { authFields, AuthHeading, Field, FieldMessage, useFieldCheck } from "@catera/mobile-ui";
import { e164Indonesia } from "../onboarding";
import { areaCheck, nameCheck, waCheck } from "./checks";
import type { PendingKitchen } from "./pending";
import { AREA_CHIP, AreaChip, StepTitle, WhatsAppCheck } from "./parts";

/** A stored E.164 number as it is typed: +6281234567890 reads 081234567890. */
const typedPhone = (whatsapp?: string) => (whatsapp ? whatsapp.replace(/^\+62/, "0") : "");

/**
 * The kitchen's three questions, one topic per step: the business name, the kitchen area, the kitchen's WhatsApp. Daftar
 * asks them ahead of the account; a signed-in customer (`BukaDapur`) asks only these. Each is checked on Lanjut.
 */
export function useKitchenSteps({ initial, onSubmit }: { initial?: PendingKitchen | null; onSubmit: () => void }) {
  const { t } = useMobile();
  const [name, setName] = useState(initial?.name ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [phone, setPhone] = useState(typedPhone(initial?.whatsapp));
  // Chosen once, so a retry after an app restart or a lost answer asks for the same slug.
  const slugSuffix = useRef(initial?.slugSuffix ?? Crypto.randomUUID().replace(/-/g, "").slice(0, 4));
  const firstChip = useRef<ViewInstance>(null);

  const one = useFieldCheck({ name: { value: name, check: nameCheck(t) } });
  const two = useFieldCheck({ area: { value: area, check: areaCheck(t) } });
  const three = useFieldCheck({ phone: { value: phone, check: waCheck(t) } });
  const nameField = one.fieldProps("name");
  const areaField = two.fieldProps("area");
  const phoneField = three.fieldProps("phone");
  // The area has no text input: focus for it means the first chip.
  (areaField.inputRef as { current: unknown }).current = {
    focus: () => {
      const node = firstChip.current;
      if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
    },
  };

  const kitchen = (): PendingKitchen => ({ name: name.trim(), area, whatsapp: e164Indonesia(phone) ?? undefined, slugSuffix: slugSuffix.current });
  const checks = [one, two, three];

  /** What one step asks. */
  const body = (step: number) =>
    step === 1 ? (
      <>
        <AuthHeading
          title={t("Apa nama usaha kateringmu?", "What's your catering business called?")}
          subtitle={t("Nama ini yang dilihat pelanggan di Catera. Bisa diubah nanti.", "Customers see this name on Catera. You can change it later.")}
        />
        <Field
          {...authFields.name}
          {...nameField}
          label={t("Nama usaha katering", "Catering business name")}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          onSubmitEditing={onSubmit}
        />
      </>
    ) : step === 2 ? (
      <>
        <StepTitle
          title={t("Di mana dapurmu?", "Where is your kitchen?")}
          subtitle={t(`Pelanggan di area ini akan melihat paket ${name.trim()}.`, `Customers in this area will see ${name.trim()}'s packages.`)}
        />
        <View style={{ gap: nativeLayout.groupGap }}>
          {/* 40 chips reach their 48 target by 4 of slop above and below, so the wrapped rows sit 8 apart. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: nativeLayout.groupGap, rowGap: 48 - AREA_CHIP }}>
            {areaOptions.map((a, i) => (
              <View key={a} ref={i === 0 ? firstChip : undefined} collapsable={false}>
                <AreaChip label={a} selected={area === a} onPress={() => setArea(a)} />
              </View>
            ))}
          </View>
          {areaField.error ? <FieldMessage text={areaField.error} testID="area-error" /> : null}
        </View>
      </>
    ) : (
      <>
        <StepTitle
          title={t("Nomor WhatsApp dapur", "Kitchen WhatsApp number")}
          subtitle={t(
            "Pelanggan dan kurir menghubungimu lewat nomor ini. Kami tidak mengirim kode ke sini.",
            "Customers and couriers reach you on this number. We don't send codes to it.",
          )}
        />
        <View style={{ gap: nativeLayout.groupGap }}>
          <Field
            {...authFields.phone}
            {...phoneField}
            label={t("Nomor WhatsApp", "WhatsApp number")}
            hint={t("Contoh: 0812 3456 7890", "Example: 0812 3456 7890")}
            value={phone}
            onChangeText={setPhone}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          <WhatsAppCheck phone={phone} ready={!waCheck(t)(phone)} />
        </View>
      </>
    );

  return { name, checks, kitchen, body };
}
