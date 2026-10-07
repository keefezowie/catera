import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { errorLabel, type PayoutSetup } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Field, Screen, Segmented, Text } from "@catera/mobile-ui";

type StepState = "done" | "waiting" | "todo" | "later";

function Step({ n, title, state, children }: { n: number; title: string; state: StepState; children?: ReactNode }) {
  const { t } = useMobile();
  const badge = { done: t("Selesai", "Done"), waiting: t("Sedang ditinjau", "In review"), todo: "", later: t("Segera", "Soon") }[state];
  return (
    <Card tone={state === "todo" ? "attention" : "surface"}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text variant="heading" style={{ flex: 1 }}>{`${n}. ${title}`}</Text>
        {badge ? <Text variant="label" style={{ color: state === "done" ? colors.forest : colors.muted }}>{badge}</Text> : null}
      </View>
      {children}
    </Card>
  );
}

/**
 * Aktifkan pembayaran: what must be true before renewals and new customers can pay through Catera.
 * Imports and the daily lists keep working without it.
 */
export function AktifkanScreen() {
  const { runtime, actor, t, locale, command } = useMobile();
  const catererId = actor?.catererId ?? "";
  const state = useData(`aktifkan:${catererId}`, async () => {
    const [ops, setup] = await Promise.all([
      runtime.api.sellerOperations(catererId),
      runtime.api.request<PayoutSetup>("payout-setup/" + catererId).catch(() => null),
    ]);
    return { status: ops.caterer.status ?? "draft", packages: ops.offers.length, setup };
  });
  const [bank, setBank] = useState({ bank: "", holder: "", accountNumber: "", recipientType: "INDIVIDUAL" as "INDIVIDUAL" | "BUSINESS" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const s = state.data;
  if (!s) return <Screen><Text variant="caption">{state.error || t("Memuat…", "Loading…")}</Text></Screen>;

  async function run(key: string, action: string, payload: unknown) {
    setBusy(key);
    setError("");
    try {
      await command(action, payload);
    } catch (e) {
      setError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
    } finally {
      setBusy("");
    }
  }

  const review: StepState = s.status === "approved" ? "done" : s.status === "submitted" ? "waiting" : "todo";
  const latest = s.setup?.latest;
  const payout: StepState = s.setup?.active ? "done" : latest?.status === "submitted" ? "waiting" : "todo";
  const bankReady = bank.bank.trim().length >= 2 && bank.holder.trim().length >= 2 && /^\d{6,20}$/.test(bank.accountNumber);

  return (
    <Screen>
      <Text variant="title">{t("Aktifkan pembayaran", "Turn on payments")}</Text>
      <Text>
        {t(
          "Setelah aktif, pelanggan bisa memperpanjang dan memesan langsung lewat Catera. Daftar masak dan antar tetap berjalan seperti biasa.",
          "Once on, customers can renew and order through Catera. Your cooking and delivery lists keep working as usual.",
        )}
      </Text>
      <Step n={1} title={t("Profil dan paket diperiksa", "Profile and packages checked")} state={review}>
        {review === "todo" ? (
          s.packages ? (
            <Button
              label={t("Ajukan pemeriksaan", "Request a check")}
              disabled={busy === "submit"}
              onPress={() => void run("submit", "seller.submit", { catererId })}
            />
          ) : (
            <Text variant="caption">{t("Buat paket dulu di Usaha › Paket.", "Create a package first in Business › Packages.")}</Text>
          )
        ) : review === "waiting" ? (
          <Text variant="caption">{t("Tim Catera biasanya memeriksa dalam 1–2 hari kerja.", "The Catera team usually checks within 1–2 working days.")}</Text>
        ) : null}
      </Step>
      <Step n={2} title={t("Rekening pencairan", "Payout bank account")} state={payout}>
        {payout === "done" && s.setup?.active ? (
          <Text variant="caption">{`${s.setup.active.bank} · ${s.setup.active.maskedAccount} · ${s.setup.active.holder}`}</Text>
        ) : payout === "waiting" && latest ? (
          <Text variant="caption">{`${latest.bank} · ${latest.maskedAccount}`}</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {latest?.status === "rejected" && latest.reason ? <Text style={{ color: colors.danger }}>{latest.reason}</Text> : null}
            <Field label={t("Nama bank", "Bank name")} value={bank.bank} onChangeText={(v) => setBank((b) => ({ ...b, bank: v }))} placeholder="BCA" />
            <Field label={t("Nama pemilik rekening", "Account holder")} value={bank.holder} onChangeText={(v) => setBank((b) => ({ ...b, holder: v }))} />
            <Field label={t("Nomor rekening", "Account number")} value={bank.accountNumber} onChangeText={(v) => setBank((b) => ({ ...b, accountNumber: v.replace(/\D/g, "") }))} keyboardType="number-pad" />
            <Segmented
              value={bank.recipientType}
              onChange={(v) => setBank((b) => ({ ...b, recipientType: v }))}
              options={[
                { value: "INDIVIDUAL", label: t("Perorangan", "Individual") },
                { value: "BUSINESS", label: t("Badan usaha", "Business") },
              ]}
            />
            <Button
              label={t("Kirim rekening", "Submit account")}
              disabled={!bankReady || busy === "bank"}
              onPress={() => void run("bank", "payoutDestination.submit", { catererId, ...bank })}
            />
          </View>
        )}
      </Step>
      <Step n={3} title={t("Verifikasi pembayaran", "Payment verification")} state="later">
        <Text variant="caption">
          {t("Kami akan mengabari Anda bila ada dokumen tambahan yang diperlukan.", "We'll let you know if any extra documents are needed.")}
        </Text>
      </Step>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </Screen>
  );
}
