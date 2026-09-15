"use client";
import { NumericInput } from "./numeric-input";
import { useState } from "react";
import { api, useApp, useResource } from "./context";
import { SellerSettlement } from "./seller-settlement";
import { Heading, Field, ActionForm, Loading, ErrorNotice } from "./ui";
import { Select, SelectOption } from "./select";
import { Checkbox, TextInput } from "./form-controls";
function PolicyEditor({ seller }: { seller: string }) {
  const { t, perform } = useApp();
  const state = useResource("settlement-policy:" + seller, () =>
    api.settlement(seller),
  );
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const policy = state.data.policy;
  return (
    <>
      <ActionForm
        key={policy?.id ?? "new"}
        submit={t("Simpan kebijakan pencairan", "Save payout policy")}
        onSubmit={async (f) => {
          await perform("settlement.policy", {
            catererId: seller,
            enabled: f.get("enabled") === "on",
            synthetic: f.get("synthetic") === "on",
            minimumAmount: Number(f.get("minimum")),
            maximumAmount: Number(f.get("maximum")),
            reason: f.get("reason"),
          });
          state.reload();
        }}
      >
        <p>
          {t(
            "Setiap Senin, 09.00 WIB. Kebijakan disimpan sebagai versi baru.",
            "Every Monday, 09:00 WIB. Each policy is saved as a new version.",
          )}
        </p>
        <label className="checkbox">
          <Checkbox name="enabled" defaultChecked={policy?.enabled ?? false} />
          {t("Aktifkan pencairan", "Enable payouts")}
        </label>
        <label className="checkbox">
          <Checkbox
            name="synthetic"
            defaultChecked={policy?.synthetic ?? true}
          />
          {t("Data pengujian", "Synthetic testing")}
        </label>
        <Field label={t("Minimum pencairan (Rp)", "Minimum payout (IDR)")}>
          <NumericInput
            name="minimum"
            min={1}
            max={2147483647}
            defaultValue={policy?.minimumAmount ?? 1}
            required
          />
        </Field>
        <Field
          label={t("Maksimum per transfer (Rp)", "Maximum per transfer (IDR)")}
        >
          <NumericInput
            name="maximum"
            min={1}
            max={2147483647}
            defaultValue={policy?.maximumAmount ?? 2147483647}
            required
          />
        </Field>
        <p className="small muted">
          {t(
            "Sesuaikan batas dengan rekening dan kanal pembayaran yang telah diverifikasi.",
            "Match these limits to the verified recipient and payout channel.",
          )}
        </p>
        <Field label={t("Alasan", "Reason")}>
          <TextInput name="reason" minLength={5} required />
        </Field>
      </ActionForm>
      <details className="spaced">
        <summary>
          {t(
            "Catat pengembalian dana dari katerer",
            "Record funds recovered from caterer",
          )}
        </summary>
        <ActionForm
          submit={t("Catat dana yang diterima", "Record received funds")}
          onSubmit={async (f) => {
            await perform("settlement.recovery", {
              catererId: seller,
              allocationId: f.get("allocation"),
              amount: Number(f.get("amount")),
              reference: f.get("reference"),
              reason: f.get("reason"),
            });
            state.reload();
          }}
        >
          <p>
            {t(
              "Hanya untuk dana yang sudah diterima Catera. Catatan ini tidak memindahkan uang.",
              "Only record funds already received by Catera. This entry does not transfer money.",
            )}
          </p>
          <Field label={t("ID alokasi pembelian", "Purchase allocation ID")}>
            <TextInput name="allocation" required />
          </Field>
          <Field label={t("Jumlah diterima (Rp)", "Amount received (IDR)")}>
            <NumericInput name="amount" min={1} max={2147483647} required />
          </Field>
          <Field label={t("Referensi transfer", "Transfer reference")}>
            <TextInput name="reference" minLength={3} required />
          </Field>
          <Field label={t("Alasan", "Reason")}>
            <TextInput name="reason" minLength={5} required />
          </Field>
        </ActionForm>
      </details>
    </>
  );
}
export function AdminSettlement() {
  const { t, perform } = useApp();
  const [seller, setSeller] = useState("");
  const state = useResource("settlement-admin", () => api.admin());
  const controls = useResource("settlement-controls", () =>
    api.request<{ multiCycle: boolean; automaticPayouts: boolean }>(
      "settlement-controls",
    ),
  );
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  return (
    <>
      <Heading
        title={t(
          "Pencairan berdasarkan pengantaran",
          "Delivery-earned settlement",
        )}
      />
      <section className="panel">
        <Field label={t("Katerer", "Caterer")}>
          <Select value={seller} onValueChange={setSeller}>
            <SelectOption value="">
              {t("Pilih katerer", "Choose caterer")}
            </SelectOption>
            {state.data.caterers.map((c) => (
              <SelectOption key={c.id} value={c.id}>
                {c.name}
              </SelectOption>
            ))}
          </Select>
        </Field>
        {seller && <PolicyEditor key={seller} seller={seller} />}
      </section>
      {seller && <SellerSettlement key={seller} catererId={seller} />}
      <section className="panel spaced">
        <h2>{t("Kontrol peluncuran", "Rollout controls")}</h2>
        {controls.error ? (
          <ErrorNotice message={controls.error} retry={controls.reload} />
        ) : !controls.data ? (
          <Loading />
        ) : (
          <ActionForm
            key={JSON.stringify(controls.data)}
            submit={t("Simpan kontrol", "Save controls")}
            onSubmit={async (f) => {
              await perform("settlement.features", {
                multiCycle: f.get("cycles") === "on",
                automaticPayouts: f.get("payouts") === "on",
                reason: f.get("reason"),
              });
              controls.reload();
            }}
          >
            <label className="checkbox">
              <Checkbox
                name="cycles"
                defaultChecked={controls.data.multiCycle}
              />
              {t("Pembelian beberapa periode", "Multi-cycle purchases")}
            </label>
            <label className="checkbox">
              <Checkbox
                name="payouts"
                defaultChecked={controls.data.automaticPayouts}
              />
              {t("Pengiriman pencairan otomatis", "Automatic payout dispatch")}
            </label>
            <Field label={t("Alasan", "Reason")}>
              <TextInput name="reason" minLength={5} required />
            </Field>
          </ActionForm>
        )}
      </section>
    </>
  );
}
