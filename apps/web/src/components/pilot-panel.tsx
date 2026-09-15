"use client";
import { useState } from "react";
import { currency, localDay, type AdminState } from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, ErrorNotice, Field, Heading, Loading } from "./ui";
import { Checkbox, TextInput } from "./form-controls";
import { NumericInput } from "./numeric-input";
import { Select, SelectOption } from "./select";
import { DatePicker } from "./date-picker";
export function PilotAdmin() {
  const { t } = useApp(),
    state = useResource<AdminState>("pilot-admin-sellers", () => api.admin());
  const [cid, setCid] = useState("");
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const chosen = cid || state.data.caterers[0]?.id;
  return (
    <>
      <Heading
        title={t("Pilot berbayar", "Paid seller pilot")}
        description={t(
          "Pisahkan penggunaan, pembayaran, dan biaya layanan.",
          "Separate adoption, payments, and service costs.",
        )}
      />
      <Field label={t("Katerer", "Caterer")}>
        <Select value={chosen} onValueChange={setCid}>
          {state.data.caterers.map((c) => (
            <SelectOption value={c.id} key={c.id}>
              {c.name}
            </SelectOption>
          ))}
        </Select>
      </Field>
      {chosen && <PilotPanel catererId={chosen} />}
    </>
  );
}
export function PilotPanel({ catererId }: { catererId: string }) {
  const { actor, t, locale, perform } = useApp(),
    admin = actor?.role === "platform_admin";
  const [from, setFrom] = useState(localDay().slice(0, 7) + "-01"),
    [to, setTo] = useState(localDay());
  const [model, setModel] = useState("transaction"),
    [invoiceId, setInvoiceId] = useState(""),
    [kind, setKind] = useState("payment");
  const [costKind, setCostKind] = useState("processing");
  const state = useResource("pilot:" + catererId + ":" + from + ":" + to, () =>
    api.pilot(catererId, from, to),
  );
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const data = state.data,
    m = data.metrics,
    money = (n: number | null) =>
      n === null ? t("Belum diketahui", "Unknown") : currency(n, locale);
  const costLabels: Record<string, string> = {
    processing: t("Biaya pembayaran", "Payment processing"),
    payout: t("Biaya pencairan", "Payout costs"),
    incentive: t("Insentif tambahan", "Additional incentives"),
    support: t("Biaya bantuan", "Support costs"),
    acquisition: t("Akuisisi pelanggan", "Customer acquisition"),
    onboarding: t("Pendampingan awal", "Onboarding"),
    admin_baseline: t("Waktu admin sebelum Catera", "Admin time before Catera"),
    admin_current: t("Waktu admin dengan Catera", "Admin time using Catera"),
    assistance: t("Waktu pendampingan Catera", "Catera assistance time"),
    refund_reconciliation: t(
      "Rekonsiliasi pengembalian dana",
      "Refund reconciliation",
    ),
  };
  return (
    <div className="pilot-workspace">
      <section className="panel">
        <h2>{t("Status pilot", "Pilot status")}</h2>
        <p>
          {data.readiness.syntheticPolicy
            ? t(
                "Konfigurasi sintetis. Bukan persetujuan untuk menerima pembayaran nyata.",
                "Synthetic configuration. This is not approval to accept real payments.",
              )
            : t(
                "Konfigurasi komersial disetujui.",
                "Commercial configuration approved.",
              )}
        </p>
        {data.enrollment ? (
          <>
            <p>
              {data.enrollment.starts_on} → {data.enrollment.ends_on} ·{" "}
              {data.enrollment.exited_on
                ? t("Berhenti", "Exited")
                : t("Terdaftar", "Enrolled")}
            </p>
            {admin && !data.enrollment.exited_on && (
              <details>
                <summary>
                  {t("Catat berhenti dari pilot", "Record pilot exit")}
                </summary>
                <ActionForm
                  submit={t("Catat berhenti", "Record exit")}
                  onSubmit={async (f) => {
                    await perform("pilot.exit", {
                      catererId,
                      date: f.get("date"),
                      reason: f.get("reason"),
                    });
                  }}
                >
                  <Field label={t("Tanggal berhenti", "Exit date")}>
                    <DatePicker
                      name="date"
                      defaultValue={localDay()}
                      max={localDay()}
                      required
                    />
                  </Field>
                  <Field label={t("Alasan", "Reason")}>
                    <TextInput name="reason" required minLength={5} />
                  </Field>
                </ActionForm>
              </details>
            )}
          </>
        ) : (
          admin && (
            <details>
              <summary>
                {t("Daftarkan pilot 90 hari", "Enroll in 90-day pilot")}
              </summary>
              <ActionForm
                submit={t("Daftarkan pilot", "Enroll pilot")}
                onSubmit={async (f) => {
                  await perform("pilot.enroll", {
                    catererId,
                    pricingId: f.get("pricingId"),
                    startDate: f.get("startDate"),
                    reference: f.get("reference"),
                  });
                }}
              >
                <Field label={t("Kesepakatan disetujui", "Approved agreement")}>
                  <Select name="pricingId" required>
                    {data.policies
                      .filter((p) => p.approved)
                      .map((p) => (
                        <SelectOption key={p.id} value={p.id}>
                          {p.cohort} · {p.effective_at.slice(0, 10)}
                        </SelectOption>
                      ))}
                  </Select>
                </Field>
                <Field label={t("Tanggal mulai", "Start date")}>
                  <DatePicker
                    name="startDate"
                    defaultValue={localDay()}
                    required
                  />
                </Field>
                <Field
                  label={t("Bukti persetujuan pilot", "Pilot consent evidence")}
                >
                  <TextInput name="reference" minLength={5} required />
                </Field>
              </ActionForm>
            </details>
          )
        )}
        {admin && (
          <p>
            {t("Pemeliharaan terakhir", "Last scheduler maintenance")}:{" "}
            {data.readiness.lastMaintenance ||
              t("Belum ada bukti", "No evidence yet")}
          </p>
        )}
      </section>
      {admin && (
        <div className="pilot-fields">
          <Field label={t("Dari", "From")}>
            <DatePicker value={from} onValueChange={setFrom} />
          </Field>
          <Field label={t("Sampai", "To")}>
            <DatePicker value={to} onValueChange={setTo} />
          </Field>
        </div>
      )}
      {m && (
        <section className="panel">
          <h2>{t("Hasil pilot", "Pilot results")}</h2>
          <p className="notice">
            {m.dataMode === "synthetic"
              ? t(
                  "Laporan transaksi sintetis. Tidak digabung dengan transaksi komersial.",
                  "Synthetic transaction report. Commercial transactions are excluded.",
                )
              : t(
                  "Laporan transaksi komersial. Transaksi sintetis dikecualikan.",
                  "Commercial transaction report. Synthetic transactions are excluded.",
                )}
          </p>
          {m.unclassifiedGmv > 0 && (
            <p>
              {t(
                "Pembayaran lama tanpa penanda lingkungan, dikecualikan dari GMV di bawah:",
                "Historical payments without an environment marker, excluded from GMV below:",
              )}{" "}
              {money(m.unclassifiedGmv)}
            </p>
          )}
          <div className="ops-metrics">
            {[
              [
                t("Pembayaran melalui Catera", "Catera-processed GMV"),
                money(m.processedGmv),
              ],
              [
                t("Pendapatan biaya platform", "Platform fees"),
                money(m.platformFees),
              ],
              [
                t("Tagihan bulanan diterima", "Monthly fees collected"),
                money(m.monthlyCollected),
              ],
              [
                t("Kontribusi setelah biaya", "Contribution after costs"),
                money(m.contribution),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {m.missingCosts.length > 0 && (
            <p className="notice">
              {t(
                "Kontribusi belum dapat dihitung. Biaya belum lengkap: ",
                "Contribution is unknown. Missing costs: ",
              )}
              {m.missingCosts.map((k) => costLabels[k] || k).join(", ")}.
            </p>
          )}
          <p>
            {t(
              "Saldo prabayar dari luar Catera tidak dihitung sebagai pembayaran melalui Catera.",
              "External prepaid balances are excluded from Catera-processed GMV.",
            )}
          </p>
          <h3>{t("Pembelian berikutnya", "Renewals")}</h3>
          <p>
            {t("Memasuki waktu perpanjangan", "Eligible")}:{" "}
            {m.renewals.eligible} · Catera: {m.renewals.catera} ·{" "}
            {t("Eksternal dilaporkan", "Reported external")}:{" "}
            {m.renewals.externalReported} · {t("Belum diketahui", "Unknown")}:{" "}
            {m.renewals.unknown}
          </p>
          <p className="muted">
            {t(
              "Paket non-trial dengan paling banyak 3 hari tersisa dan tanggal selesai dalam periode ini. Hasil yang belum diketahui bukan bukti pelanggan keluar platform.",
              "Non-trial packages with at most 3 remaining days and an end date in this period. Unknown outcomes are not evidence of payment leakage.",
            )}
          </p>
          <h3>{t("Asal pelanggan", "Acquisition source")}</h3>
          {m.cohorts.map((c) => (
            <p key={c.origin}>
              {c.origin === "seller"
                ? t("Pelanggan katerer", "Seller-origin")
                : t("Marketplace", "Marketplace")}
              : {c.payments} {t("pembayaran", "payments")} · {money(c.gmv)} ·{" "}
              {t("biaya platform", "platform fees")} {money(c.fees)}
            </p>
          ))}
          <h3>{t("Waktu & kualitas layanan", "Time & service quality")}</h3>
          <p>
            {t(
              "Menit admin per hari, sebelum / sesudah",
              "Admin minutes per day, before / after",
            )}
            : {m.baselineMinutesPerDay ?? "—"} / {m.currentMinutesPerDay ?? "—"}
          </p>
          <p>
            {t("Menit pendampingan Catera", "Catera assistance minutes")}:{" "}
            {m.assistanceMinutes ?? "—"} ·{" "}
            {t("Masalah pengantaran", "Delivery issues")}: {m.deliveryIssues}
          </p>
          {m.sellerRetention.length > 0 && (
            <>
              <h3>{t("Retensi katerer berbayar", "Paid seller retention")}</h3>
              {m.sellerRetention.map((r) => (
                <p key={r.day}>
                  {t("Hari", "Day")} {r.day}:{" "}
                  {!r.mature
                    ? t("Belum jatuh tempo", "Not yet observable")
                    : r.stillEnrolled && r.paid
                      ? t(
                          "Terdaftar dan ada pembayaran",
                          "Enrolled with payment",
                        )
                      : r.stillEnrolled
                        ? t(
                            "Terdaftar, belum ada pembayaran",
                            "Enrolled; no payment recorded",
                          )
                        : t("Sudah berhenti", "Exited")}
                </p>
              ))}
              <p className="muted">
                {t(
                  "Pembayaran biaya bulanan atau komisi katerer dalam 30 hari sebelum titik pengamatan. Data sintetis tetap berlabel sintetis.",
                  "Monthly fee or seller commission payment in the 30 days before each checkpoint. Synthetic data remains labeled synthetic.",
                )}
              </p>
            </>
          )}
          <p>
            {t("Akuisisi", "Acquisition")}: {money(m.acquisitionCosts)} ·{" "}
            {t("Pendampingan awal", "Onboarding")}: {money(m.onboardingCosts)}
          </p>
          <p>
            {t("Promosi transaksi", "Transaction promotions")}:{" "}
            {money(m.promotionCosts)} · {t("Biaya dicatat", "Recorded costs")}:{" "}
            {money(m.recordedCosts)} ·{" "}
            {t("Pengembalian yang ditanggung Catera", "Catera-funded refunds")}:{" "}
            {money(m.refundCosts)}
          </p>
        </section>
      )}
      <section className="panel">
        <h2>{t("Kesepakatan biaya", "Pricing agreements")}</h2>
        {!data.policies.length && (
          <p>
            {t(
              "Belum ada kesepakatan pilot. Kebijakan global tetap berlaku.",
              "No pilot agreement yet. The global policy still applies.",
            )}
          </p>
        )}
        {data.policies.map((p) => (
          <div className="pilot-subscription" key={p.id}>
            <strong>
              {p.cohort} ·{" "}
              {p.model === "monthly"
                ? t("Bulanan", "Monthly")
                : t("Per transaksi", "Per transaction")}
            </strong>
            <p>
              {p.effective_at.slice(0, 10)} ·{" "}
              {p.approved
                ? t("Disetujui", "Approved")
                : t("Belum disetujui", "Not approved")}{" "}
              ·{" "}
              {p.synthetic
                ? t("Data sintetis", "Synthetic")
                : t("Komersial", "Commercial")}
            </p>
            <p>
              {t("Biaya pelanggan", "Customer fee")}: {money(p.service_fee)} ·{" "}
              {t("Komisi marketplace", "Marketplace commission")}:{" "}
              {p.marketplace_percent}% ·{" "}
              {t("Komisi pelanggan katerer", "Seller-origin commission")}:{" "}
              {p.model === "monthly" ? 0 : p.invited_percent}% ·{" "}
              {t("Biaya bulanan", "Monthly fee")}: {money(p.monthly_fee)}
            </p>
          </div>
        ))}
        {admin && (
          <details>
            <summary>
              {t("Tambah versi kesepakatan", "Add agreement version")}
            </summary>
            <ActionForm
              submit={t("Simpan kesepakatan", "Save agreement")}
              onSubmit={async (f) => {
                await perform("pilot.pricing", {
                  catererId,
                  model,
                  cohort: f.get("cohort"),
                  effectiveAt: new Date(
                    String(f.get("effectiveAt")) + "T00:00:00+07:00",
                  ).toISOString(),
                  serviceFee: Number(f.get("serviceFee")),
                  marketplacePercent: Number(f.get("marketplacePercent")),
                  invitedPercent: Number(f.get("invitedPercent")),
                  monthlyFee:
                    model === "monthly" ? Number(f.get("monthlyFee")) : 0,
                  approved: f.get("approved") === "on",
                  synthetic: f.get("synthetic") === "on",
                  reason: f.get("reason"),
                });
              }}
            >
              <Field label={t("Kelompok pilot", "Pilot cohort")}>
                <TextInput name="cohort" required maxLength={80} />
              </Field>
              <Field label={t("Mulai berlaku", "Effective date")}>
                <DatePicker
                  name="effectiveAt"
                  defaultValue={localDay()}
                  required
                />
              </Field>
              <Field label={t("Model biaya", "Pricing model")}>
                <Select value={model} onValueChange={setModel}>
                  <SelectOption value="transaction">
                    {t("Per transaksi", "Per transaction")}
                  </SelectOption>
                  <SelectOption value="monthly">
                    {t("Bulanan", "Monthly")}
                  </SelectOption>
                </Select>
              </Field>
              {[
                ["serviceFee", t("Biaya pelanggan (Rp)", "Customer fee (Rp)")],
                [
                  "marketplacePercent",
                  t("Komisi marketplace (%)", "Marketplace commission (%)"),
                ],
                [
                  "invitedPercent",
                  t(
                    "Komisi pelanggan katerer (%)",
                    "Seller-origin commission (%)",
                  ),
                ],
                ["monthlyFee", t("Biaya bulanan (Rp)", "Monthly fee (Rp)")],
              ].map(([name, label]) => (
                <Field key={name} label={label}>
                  <NumericInput
                    name={name}
                    disabled={name === "monthlyFee" && model !== "monthly"}
                    min={0}
                    max={name.includes("Percent") ? 100 : 100000000}
                    step={name.includes("Percent") ? 0.1 : 1}
                    required
                  />
                </Field>
              ))}
              <label className="check">
                <Checkbox name="approved" />
                {t(
                  "Kesepakatan ini telah disetujui secara eksplisit",
                  "This agreement has explicit approval",
                )}
              </label>
              <label className="check">
                <Checkbox name="synthetic" defaultChecked />
                {t("Hanya untuk data sintetis", "Synthetic use only")}
              </label>
              <Field label={t("Dasar persetujuan", "Approval reason")}>
                <TextInput name="reason" required minLength={5} />
              </Field>
            </ActionForm>
          </details>
        )}
      </section>
      <section className="panel">
        <h2>{t("Tagihan bulanan", "Monthly invoices")}</h2>
        {!data.invoices.length && (
          <p>{t("Belum ada tagihan.", "No invoices yet.")}</p>
        )}
        {data.invoices.map((i) => {
          const due =
              i.amount +
              i.entries
                .filter((e) => e.kind === "adjustment")
                .reduce((n, e) => n + e.amount, 0),
            paid = i.entries.reduce(
              (n, e) =>
                n +
                (e.kind === "payment"
                  ? e.amount
                  : e.kind === "refund"
                    ? -e.amount
                    : 0),
              0,
            );
          return (
            <div className="pilot-subscription" key={i.id}>
              <strong>
                {i.period} · {money(due)}
              </strong>
              <p>
                {t("Diterima", "Collected")}: {money(paid)} ·{" "}
                {t("Sisa", "Outstanding")}: {money(due - paid)}
              </p>
              {i.entries.map((e) => (
                <p key={e.id}>
                  {e.reference} · {money(e.amount)} ·{" "}
                  {e.kind === "payment"
                    ? t("Pembayaran", "Payment")
                    : e.kind === "refund"
                      ? t("Pengembalian", "Refund")
                      : t("Penyesuaian", "Adjustment")}
                </p>
              ))}
            </div>
          );
        })}
        {admin && (
          <>
            <details>
              <summary>{t("Buat tagihan", "Create invoice")}</summary>
              <ActionForm
                submit={t("Catat tagihan", "Record invoice")}
                onSubmit={async (f) => {
                  await perform("pilot.invoice", {
                    catererId,
                    pricingId: f.get("pricingId"),
                    period: f.get("period"),
                  });
                }}
              >
                <Field label={t("Kesepakatan bulanan", "Monthly agreement")}>
                  <Select name="pricingId" required>
                    {data.policies
                      .filter((p) => p.model === "monthly" && p.approved)
                      .map((p) => (
                        <SelectOption key={p.id} value={p.id}>
                          {p.cohort} · {p.effective_at.slice(0, 10)}
                        </SelectOption>
                      ))}
                  </Select>
                </Field>
                <Field
                  label={t("Awal bulan tagihan", "First day of billing month")}
                >
                  <DatePicker
                    name="period"
                    defaultValue={localDay().slice(0, 7) + "-01"}
                    required
                  />
                </Field>
              </ActionForm>
            </details>
            <details>
              <summary>
                {t("Pembayaran / penyesuaian", "Payment / adjustment")}
              </summary>
              <ActionForm
                submit={t("Simpan bukti", "Save evidence")}
                onSubmit={async (f) => {
                  await perform("pilot.invoiceEntry", {
                    catererId,
                    invoiceId,
                    kind,
                    amount: Number(f.get("amount")),
                    reference: f.get("reference"),
                  });
                }}
              >
                <Field label={t("Tagihan", "Invoice")}>
                  <Select value={invoiceId} onValueChange={setInvoiceId}>
                    {data.invoices.map((i) => (
                      <SelectOption key={i.id} value={i.id}>
                        {i.period} · {money(i.amount)}
                      </SelectOption>
                    ))}
                  </Select>
                </Field>
                <Field label={t("Jenis", "Type")}>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectOption value="payment">
                      {t("Pembayaran", "Payment")}
                    </SelectOption>
                    <SelectOption value="refund">
                      {t("Pengembalian", "Refund")}
                    </SelectOption>
                    <SelectOption value="adjustment">
                      {t("Penyesuaian tagihan", "Invoice adjustment")}
                    </SelectOption>
                  </Select>
                </Field>
                <Field label={t("Jumlah (Rp)", "Amount (Rp)")}>
                  <NumericInput
                    name="amount"
                    min={kind === "adjustment" ? -100000000 : 1}
                    max={100000000}
                    required
                  />
                </Field>
                <Field label={t("Referensi bukti", "Evidence reference")}>
                  <TextInput name="reference" required minLength={3} />
                </Field>
              </ActionForm>
            </details>
          </>
        )}
      </section>
      {admin && (
        <section className="panel">
          <h2>{t("Biaya & pengamatan", "Costs & observations")}</h2>
          <p>
            {t(
              "Catat nol hanya bila sudah diverifikasi. Waktu diukur untuk sejumlah hari pengamatan. Insentif tambahan tidak termasuk diskon transaksi yang sudah dihitung.",
              "Record zero only when verified. Time covers the specified observation days. Additional incentives exclude transaction discounts already counted.",
            )}
          </p>
          <ActionForm
            submit={t("Catat pengamatan", "Record observation")}
            onSubmit={async (f) => {
              await perform("pilot.observation", {
                catererId,
                date: f.get("date"),
                kind: costKind,
                amount: f.get("amount") === "" ? null : Number(f.get("amount")),
                minutes:
                  f.get("minutes") === "" ? null : Number(f.get("minutes")),
                sampleDays: Number(f.get("sampleDays")),
                reference: f.get("reference"),
              });
            }}
          >
            <Field label={t("Jenis", "Type")}>
              <Select value={costKind} onValueChange={setCostKind}>
                {Object.entries(costLabels)
                  .filter(([k]) => k !== "refund_reconciliation")
                  .map(([k, v]) => (
                    <SelectOption key={k} value={k}>
                      {v}
                    </SelectOption>
                  ))}
              </Select>
            </Field>
            <Field label={t("Tanggal", "Date")}>
              <DatePicker name="date" defaultValue={localDay()} required />
            </Field>
            <Field
              label={t(
                "Biaya (Rp), kosong bila belum diketahui",
                "Cost (Rp), blank if unknown",
              )}
            >
              <NumericInput name="amount" min={0} max={100000000} />
            </Field>
            <Field label={t("Menit", "Minutes")}>
              <NumericInput name="minutes" min={0} max={100000} />
            </Field>
            <Field label={t("Hari pengamatan", "Observation days")}>
              <NumericInput
                name="sampleDays"
                defaultValue={1}
                min={1}
                max={366}
                required
              />
            </Field>
            <Field
              label={t(
                "Bukti / sumber pengamatan",
                "Evidence / observation source",
              )}
            >
              <TextInput name="reference" required minLength={3} />
            </Field>
          </ActionForm>
          {data.observations.map((o) => (
            <p key={o.id}>
              {o.observed_on} · {costLabels[o.kind]} ·{" "}
              {o.amount === null ? "—" : money(o.amount)} · {o.minutes ?? "—"}{" "}
              {t("menit", "minutes")} · {o.reference}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
