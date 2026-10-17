import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { type PayoutSetup } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, FadeSwap, Field, FormError, Screen, Segmented, Text, useColors } from "@catera/mobile-ui";
import { ReadError } from "../ReadError";
import { ListSkeleton } from "../skeletons";
import { useFormRun } from "../useFormRun";

type StepState = "done" | "waiting" | "todo" | "later";

function Step({ n, title, state, children }: { n: number; title: string; state: StepState; children?: ReactNode }) {
  const { t } = useMobile();
  const c = useColors();
  const badge = { done: t("Selesai", "Done"), waiting: t("Sedang ditinjau", "In review"), todo: "", later: t("Nanti", "Later") }[state];
  return (
    <Card tone={state === "todo" ? "attention" : "surface"}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text variant="heading" style={{ flex: 1 }}>{`${n}. ${title}`}</Text>
        {badge ? <Text variant="label" style={{ color: state === "done" ? c.charcoal : c.muted }}>{badge}</Text> : null}
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
  const c = useColors();
  const catererId = actor?.catererId ?? "";
  const state = useData(`aktifkan:${catererId}`, async () => {
    const [ops, setup] = await Promise.all([
      runtime.api.sellerOperations(catererId),
      runtime.api.request<PayoutSetup>("payout-setup/" + catererId).catch(() => null),
    ]);
    return { status: ops.caterer.status ?? "draft", packages: ops.offers.length, setup };
  });
  const [bank, setBank] = useState({ bank: "", holder: "", accountNumber: "", recipientType: "INDIVIDUAL" as "INDIVIDUAL" | "BUSINESS" });
  // Which of the two buttons is waiting; the hook drops a second press while one runs.
  const [which, setWhich] = useState("");
  const { busy, failure, run: guarded } = useFormRun(
    locale,
    t("Belum bisa dikirim. Coba lagi.", "Could not send it. Try again."),
  );
  const s = state.data;
  // Both states draw their body in the same FadeSwap, so the steps enter from their skeleton as one block.
  if (!s)
    return (
      <Screen>
        <FadeSwap swapKey={state.error ? "error" : "loading"} style={{ gap: 16 }}>
          {state.error ? (
            <ReadError art message={state.error} onRetry={() => void state.reload()} />
          ) : (
            <ListSkeleton rows={3} label={t("Memuat pembayaran", "Loading payments")} />
          )}
        </FadeSwap>
      </Screen>
    );

  const run = (key: string, action: string, payload: unknown) => {
    setWhich(key);
    return guarded(() => command(action, payload));
  };

  const review: StepState = s.status === "approved" ? "done" : s.status === "submitted" ? "waiting" : "todo";
  const latest = s.setup?.latest;
  const payout: StepState = s.setup?.active ? "done" : latest?.status === "submitted" ? "waiting" : "todo";
  const bankReady = bank.bank.trim().length >= 2 && bank.holder.trim().length >= 2 && /^\d{6,20}$/.test(bank.accountNumber);

  return (
    <Screen>
      <FadeSwap swapKey="steps" style={{ gap: 16 }}>
        <Text>
          {t(
            "Setelah aktif, pelanggan bisa memperpanjang dan memesan langsung lewat Catera. Daftar masak dan antar tetap berjalan seperti biasa.",
            "Once on, customers can renew and order through Catera. Your cooking and delivery lists keep working as usual.",
          )}
        </Text>
        <Step n={1} title={t("Pemeriksaan profil dan paket", "Profile and package check")} state={review}>
          {review === "todo" ? (
            s.packages ? (
              <Button
                label={t("Minta diperiksa", "Ask for a check")}
                busy={busy && which === "submit"}
                disabled={busy && which !== "submit"}
                onPress={() => void run("submit", "seller.submit", { catererId })}
              />
            ) : (
              <Text variant="caption">{t("Buat paket dulu di Usaha › Paket.", "Create a package first in Business › Packages.")}</Text>
            )
          ) : review === "waiting" ? (
            <Text variant="caption">{t("Tim Catera biasanya memeriksa dalam 1 sampai 2 hari kerja.", "The Catera team usually checks within 1 to 2 working days.")}</Text>
          ) : null}
        </Step>
        <Step n={2} title={t("Rekening pencairan", "Payout bank account")} state={payout}>
          {payout === "done" && s.setup?.active ? (
            <Text variant="caption">{`${s.setup.active.bank} · ${s.setup.active.maskedAccount} · ${s.setup.active.holder}`}</Text>
          ) : payout === "waiting" && latest ? (
            <Text variant="caption">{`${latest.bank} · ${latest.maskedAccount}`}</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {latest?.status === "rejected" && latest.reason ? <FormError message={latest.reason} failureKey={latest.reason} /> : null}
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
                label={t("Kirim untuk diperiksa", "Send for review")}
                busy={busy && which === "bank"}
                disabled={!bankReady || (busy && which !== "bank")}
                onPress={() => void run("bank", "payoutDestination.submit", { catererId, ...bank })}
              />
            </View>
          )}
        </Step>
        <Step n={3} title={t("Verifikasi pembayaran", "Payment verification")} state="later">
          <Text variant="caption">
            {t("Kami kabari kamu kalau perlu dokumen tambahan.", "We'll tell you if we need more documents.")}
          </Text>
        </Step>
        {failure ? <FormError message={failure.message} failureKey={failure.key} /> : null}
      </FadeSwap>
    </Screen>
  );
}
