import { useEffect, useState } from "react";
import { BackHandler, View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { errorLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { AuthHeading, AuthScreen, Button, FormError, ListCard, StepHeader, Text, useBusy } from "@catera/mobile-ui";
import { createKitchen, clearHeldKitchen, type PendingKitchen } from "./pending";
import { StepFooter, Terms } from "./parts";
import { useKitchenSteps } from "./kitchenSteps";

const TOTAL = 3;
const codeOf = (e: unknown) => (e as { code?: string }).code || (e as Error).message;

/** Makes the kitchen on the signed-in account, then re-reads it: the tabs open on Hari ini. */
function useOpenKitchen() {
  const { runtime, actor, command, refresh, t, locale } = useMobile();
  const [failure, setFailure] = useState<{ message: string; key: number } | null>(null);
  const [busy, open] = useBusy(async (kitchen: PendingKitchen) => {
    if (!actor) return;
    setFailure(null);
    try {
      await createKitchen(runtime, command, actor, kitchen);
      await clearHeldKitchen(runtime);
      await refresh();
    } catch (e) {
      setFailure((f) => ({ message: errorLabel(codeOf(e), locale) || t("Dapur belum bisa dibuat. Coba lagi.", "Couldn't set up your kitchen. Try again."), key: (f?.key ?? 0) + 1 }));
    }
  });
  return { busy, open, failure };
}

/**
 * A signed-in customer registers a kitchen on the same account: Daftar's three questions, without the account step.
 * `initial` carries what they typed before; back from the first step leaves.
 */
export function BukaDapur({ initial, onLeave }: { initial?: PendingKitchen | null; onLeave: () => void }) {
  const { t } = useMobile();
  const [step, setStep] = useState(1);
  const { busy, open, failure } = useOpenKitchen();
  const next = () => form.checks[step - 1].submit(() => (step < TOTAL ? setStep(step + 1) : void open(form.kitchen())));
  const form = useKitchenSteps({ initial, onSubmit: next });
  const back = () => (step > 1 ? setStep(step - 1) : onLeave());
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  });
  const last = step === TOTAL;
  return (
    <AuthScreen
      revealKey={failure?.key}
      footer={
        <StepFooter links={last ? <Terms lead={t("Dengan membuka dapur, kamu setuju dengan", "By opening a kitchen, you agree to the")} /> : null}>
          <Button label={last ? t("Buka dapur", "Open kitchen") : t("Lanjut", "Continue")} busy={last && busy} onPress={next} />
        </StepFooter>
      }
    >
      <StepHeader step={step} total={TOTAL} onBack={back} />
      {form.body(step)}
      {failure ? <FormError message={failure.message} failureKey={failure.key} retry={() => void open(form.kitchen())} /> : null}
    </AuthScreen>
  );
}

/**
 * After signing in from Daftar's "email sudah terdaftar": what they typed comes along, so they only confirm it. The
 * kitchen is made here, on the press, never by the sign-in alone.
 */
export function KonfirmasiDapur({ kitchen, onEdit, onLeave }: { kitchen: PendingKitchen; onEdit: () => void; onLeave: () => void }) {
  const { t } = useMobile();
  const { busy, open, failure } = useOpenKitchen();
  const row = (label: string, value: string) => (
    <View style={{ gap: 2, paddingVertical: 10 }}>
      <Text variant="meta">{label}</Text>
      <Text variant="rowTitle" selectable>
        {value}
      </Text>
    </View>
  );
  return (
    <AuthScreen
      revealKey={failure?.key}
      footer={
        <View style={{ gap: nativeLayout.space.xs }}>
          <Button label={t("Buka dapur", "Open kitchen")} busy={busy} onPress={() => void open(kitchen)} />
          <Button variant="text" label={t("Ubah data", "Change the details")} onPress={onEdit} />
          <Button variant="text" label={t("Bukan sekarang", "Not now")} onPress={onLeave} />
        </View>
      }
    >
      <AuthHeading
        title={t("Buka dapur dengan data ini?", "Open a kitchen with these details?")}
        subtitle={t("Kami bawa yang tadi kamu isi. Dapur ini memakai akun yang baru saja masuk.", "We kept what you typed. This kitchen uses the account you just signed in with.")}
      />
      <ListCard>
        {row(t("Nama usaha", "Business name"), kitchen.name)}
        {row(t("Lokasi dapur", "Kitchen area"), kitchen.area)}
        {kitchen.whatsapp ? row(t("WhatsApp dapur", "Kitchen WhatsApp"), kitchen.whatsapp) : null}
      </ListCard>
      {failure ? <FormError message={failure.message} failureKey={failure.key} retry={() => void open(kitchen)} /> : null}
    </AuthScreen>
  );
}
