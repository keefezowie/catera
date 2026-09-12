"use client";
import { menuSummary } from "@catera/domain";
import { Select, SelectOption } from "./select";
import { useState } from "react";
import {
  Plus,
  ShieldCheck,
  Wallet,
  LifeBuoy,
  ArrowUpRight,
} from "lucide-react";
import { currency, type AdminState } from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Button, Checkbox, TextArea, TextInput } from "./form-controls";
import {
  Heading,
  Loading,
  ErrorNotice,
  Status,
  ActionForm,
  Field,
  Dialog,
  Facts,
} from "./ui";
import { SupportQueue, TransactionRows } from "./seller";
import { NumericInput } from "./numeric-input";
export function Admin({ view }: { view: string }) {
  const { perform, t, locale } = useApp();
  const state = useResource<AdminState>("admin:" + view, () => api.admin());
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("submitted");
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const a = state.data;
  const seller = a.caterers.find((c) => c.id === selected);
  return (
    <>
      <Heading
        title={
          {
            sellers: t("Katerer & kepercayaan", "Caterers & trust"),
            transactions: t("Transaksi marketplace", "Marketplace transactions"),
            support: t("Bantuan & pengembalian dana", "Support & refunds"),
            payouts: t("Pencairan dana katerer", "Caterer payouts"),
            promotions: t("Promosi yang terukur", "Measured promotions"),
            reviews: t("Ulasan pelanggan", "Customer reviews"),
            audit: t("Jejak keputusan", "Decision trail"),
          }[view] || t("Catera Admin", "Catera Admin")
        }
        description={t("Keputusan yang jelas. Bukti yang dapat ditelusuri.", "Clear decisions. Traceable evidence.")}
      />
      {view === "sellers" ? (
        <>
          <div className="ops-metrics">
            {[
              [
                ShieldCheck,
                t("Menunggu tinjauan", "Awaiting review"),
                a.caterers.filter((c) => c.status === "submitted").length,
              ],
              [
                ShieldCheck,
                t("Katerer aktif", "Active caterers"),
                a.caterers.filter((c) => c.status === "approved").length,
              ],
              [
                LifeBuoy,
                t("Permintaan terbuka", "Open requests"),
                a.cases.filter((c) => c.status !== "resolved").length,
              ],
              [
                Wallet,
                t("Pembayaran bermasalah", "Payment issues"),
                a.transactions.filter((c) => c.state === "payment_exception")
                  .length,
              ],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <div key={label as string}>
                  <I size={21} />
                  <span>{label as string}</span>
                  <strong>{value as number}</strong>
                </div>
              );
            })}
          </div>
          <div className="master-detail">
            <section className="panel">
              <h2>{t("Antrean verifikasi", "Verification queue")}</h2>
              <div className="queue-filters">
                <Button
                  className={filter === "submitted" ? "selected" : ""}
                  onClick={() => {
                    setFilter("submitted");
                    setSelected("");
                  }}
                >
                  {t("Menunggu tinjauan", "Awaiting review")}
                </Button>
                <Button
                  className={filter === "all" ? "selected" : ""}
                  onClick={() => setFilter("all")}
                >
                  {t("Semua katerer", "All caterers")}
                </Button>
              </div>
              {filter === "submitted" &&
                !a.caterers.some((c) => c.status === "submitted") && (
                  <p className="quiet-empty">
                    {t(
                      "Tidak ada pengajuan yang menunggu tinjauan. Buka Semua katerer untuk melihat mitra dan statusnya.",
                      "No applications are awaiting review. Open All caterers to see partners and their status.",
                    )}
                  </p>
                )}
              {a.caterers
                .filter((c) => filter === "all" || c.status === "submitted")
                .map((c) => (
                  <Button
                    className={
                      "queue-row " + (selected === c.id ? "selected" : "")
                    }
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                  >
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.area.join(", ")}</small>
                    </span>
                    <Status status={c.status} />
                    <ArrowUpRight size={17} />
                  </Button>
                ))}
            </section>
            {seller && (
              <section className="panel detail-panel">
                <h2>{seller.name}</h2>
                <p>{seller.description}</p>
                {seller.offers?.map((o) => (
                  <div className="queue-row" key={o.id}>
                    <span>
                      <strong>{o.name}</strong>
                      <small>
                        {currency(o.price, locale)} {t("/ porsi / hari", "/ portion / day")} · {o.days} {t("hari", "days")} ·{" "}
                        {o.menus.map((m) => menuSummary(m, locale)).join(", ")}
                      </small>
                    </span>
                    <Status status={o.status} />
                  </div>
                ))}
                <Facts
                  rows={[
                    [t("Area", "Area"), seller.area.join(", ")],
                    [t("Cutoff", "Cutoff"), seller.cutoff],
                    [t("Zona waktu", "Time zone"), seller.timezone],
                    [t("Revisi", "Revision"), seller.version],
                  ]}
                />
                <ActionForm
                  submit={t("Simpan keputusan verifikasi", "Save verification decision")}
                  onSubmit={async (f) => {
                    await perform("admin.verify", {
                      id: seller.id,
                      version: seller.version,
                      status: f.get("status"),
                      reason: f.get("reason"),
                    });
                  }}
                >
                  <Field label={t("Keputusan", "Decision")}>
                    <Select name="status" defaultValue={seller.status}>
                      <SelectOption value="approved">
                        {t("Setujui katerer", "Approve caterer")}
                      </SelectOption>
                      <SelectOption value="corrections">
                        {t("Minta perbaikan", "Request changes")}
                      </SelectOption>
                      <SelectOption value="suspended">
                        {t("Tangguhkan penjualan", "Suspend sales")}
                      </SelectOption>
                    </Select>
                  </Field>
                  <Field label={t("Alasan / koreksi yang diperlukan", "Reason / required changes")}>
                    <TextArea name="reason" required minLength={5} />
                  </Field>
                  <p className="notice">
                    {t(
                      "Penangguhan menghentikan penjualan baru. Pengantaran aktif tetap harus dipenuhi.",
                      "Suspension stops new sales. Active deliveries must still be fulfilled.",
                    )}
                  </p>
                </ActionForm>
              </section>
            )}
          </div>
        </>
      ) : view === "transactions" ? (
        <section className="panel">
          <TransactionRows rows={a.transactions} />
        </section>
      ) : view === "support" ? (
        <>
          <SupportQueue cases={a.cases} admin />
          <section className="panel spaced">
            <h2>{t("Proses refund", "Refund processing")}</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("Kasus", "Case")}</th>
                    <th>{t("Jumlah", "Amount")}</th>
                    <th>{t("Status provider / rekonsiliasi", "Provider / reconciliation status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.refunds.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <code>{r.case_id}</code>
                      </td>
                      <td>{currency(r.amount, locale)}</td>
                      <td>
                        <Status status={r.state} />
                        {r.state === "succeeded" && !r.reconciliation && (
                          <details>
                            <summary>{t("Rekonsiliasi refund", "Refund reconciliation")}</summary>
                            <ActionForm
                              submit={t("Konfirmasi rekonsiliasi", "Confirm reconciliation")}
                              onSubmit={async (f) => {
                                await perform("reconcile.refund", {
                                  id: r.id,
                                  sellerDeduction: Number(
                                    f.get("sellerDeduction"),
                                  ),
                                  reference: f.get("reference"),
                                  reason: f.get("reason"),
                                });
                              }}
                            >
                              <Field label={t("Potongan alokasi katerer (Rp)", "Caterer allocation deduction (IDR)")}>
                                <NumericInput
                                  name="sellerDeduction"
                                  min={0}
                                  max={r.amount}
                                  required
                                />
                              </Field>
                              <Field label={t("Referensi penyelesaian provider", "Provider settlement reference")}>
                                <TextInput
                                  name="reference"
                                  required
                                  minLength={3}
                                />
                              </Field>
                              <Field label={t("Alasan & rekonsiliasi biaya split", "Reason & split-fee reconciliation")}>
                                <TextArea
                                  name="reason"
                                  required
                                  minLength={5}
                                />
                              </Field>
                            </ActionForm>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!a.refunds.length && (
              <p className="quiet-empty">{t("Belum ada refund yang disetujui.", "No approved refunds yet.")}</p>
            )}
          </section>
        </>
      ) : view === "payouts" ? (
        <div className="ops-two-col">
          <section className="panel">
            <h2>{t("Setujui pelepasan dana", "Approve fund release")}</h2>
            <ActionForm
              submit={t("Setujui pencairan tersedia", "Approve available payout")}
              onSubmit={async (f) => {
                await perform("payout.approve", {
                  catererId: f.get("catererId"),
                  reason: f.get("reason"),
                });
              }}
            >
              <Field label={t("Katerer", "Caterer")}>
                <Select name="catererId">
                  {a.caterers.map((c) => (
                    <SelectOption key={c.id} value={c.id}>
                      {c.name}
                    </SelectOption>
                  ))}
                </Select>
              </Field>
              <Field label={t("Catatan pemeriksaan", "Review notes")}>
                <TextArea name="reason" minLength={5} required />
              </Field>
              <label className="checkbox">
                <Checkbox required />
                {t(
                  "Transaksi, pengembalian dana, dan saldo sengketa telah diperiksa.",
                  "Transactions, refunds, and disputed balances have been reviewed.",
                )}
              </label>
              <p className="notice">
                {t(
                  "Server menghitung saldo yang dapat dilepas. Dana dalam sengketa dikecualikan. Status berhasil hanya dicatat setelah konfirmasi penyelesaian.",
                  "The server calculates the releasable balance. Disputed funds are excluded. Success is recorded only after settlement is confirmed.",
                )}
              </p>
            </ActionForm>
          </section>
          <section className="panel">
            <h2>{t("Riwayat pencairan", "Payout history")}</h2>
            {a.payouts.map((p) => (
              <div className="queue-row" key={p.id}>
                <span>
                  <strong>
                    {a.caterers.find((c) => c.id === p.caterer_id)?.name}
                  </strong>
                  <small>{currency(p.amount, locale)}</small>
                </span>
                <Status status={p.status} />
                {!["succeeded", "failed"].includes(p.status) && (
                  <details>
                    <summary>{t("Rekonsiliasi pencairan", "Payout reconciliation")}</summary>
                    <ActionForm
                      submit={t("Catat penyelesaian", "Record settlement")}
                      onSubmit={async (f) => {
                        await perform("reconcile.payout", {
                          id: p.id,
                          status: f.get("status"),
                          reference: f.get("reference"),
                          reason: f.get("reason"),
                        });
                      }}
                    >
                      <Field label={t("Hasil provider", "Provider result")}>
                        <Select name="status">
                          <SelectOption value="succeeded">
                            {t("Dana diterima", "Funds received")}
                          </SelectOption>
                          <SelectOption value="failed">
                            {t("Gagal, pulihkan alokasi", "Failed, restore allocation")}
                          </SelectOption>
                        </Select>
                      </Field>
                      <Field label={t("Referensi provider", "Provider reference")}>
                        <TextInput name="reference" required minLength={3} />
                      </Field>
                      <Field label={t("Catatan pemeriksaan", "Review notes")}>
                        <TextArea name="reason" required minLength={5} />
                      </Field>
                    </ActionForm>
                  </details>
                )}
              </div>
            ))}
            {!a.payouts.length && (
              <p className="quiet-empty">{t("Belum ada pencairan.", "No payouts yet.")}</p>
            )}
          </section>
        </div>
      ) : view === "promotions" ? (
        <section className="panel">
          <div className="section-heading">
            <h2>{t("Kode promosi", "Promotion codes")}</h2>
            <Button className="button small" onClick={() => setOpen(true)}>
              <Plus size={17} />
              {t("Buat promosi", "Create promotion")}
            </Button>
          </div>
          {a.promotions.map((p) => (
            <div className="queue-row" key={p.id}>
              <strong>{p.code}</strong>
              <span>{p.percent}%</span>
              <Status status={p.active ? "active" : "paused"} />
              <ActionForm
                submit={p.active ? t("Jeda", "Pause") : t("Aktifkan", "Activate")}
                onSubmit={async () => {
                  await perform("promotion.save", {
                    code: p.code,
                    percent: p.percent,
                    active: !p.active,
                  });
                }}
              >
                <span />
              </ActionForm>
            </div>
          ))}
          <Dialog open={open} onOpenChange={setOpen} title={t("Promosi baru", "New promotion")}>
            <ActionForm
              onSubmit={async (f) => {
                await perform("promotion.save", {
                  code: f.get("code"),
                  percent: Number(f.get("percent")),
                  active: true,
                });
                setOpen(false);
              }}
            >
              <Field label={t("Kode", "Code")}>
                <TextInput
                  name="code"
                  required
                  pattern="[A-Za-z0-9_-]+"
                  maxLength={40}
                />
              </Field>
              <Field label={t("Diskon (%)", "Discount (%)")}>
                <NumericInput name="percent" min={1} max={90} required />
              </Field>
              <p>
                {t(
                  "Promosi berlaku untuk pembelian berikutnya. Nilai diskon disimpan pada pembelian.",
                  "Promotions apply to the next purchase. The discount value is saved with the purchase.",
                )}
              </p>
            </ActionForm>
          </Dialog>
        </section>
      ) : view === "reviews" ? (
        <section className="panel">
          <h2>{t("Ulasan pembelian terverifikasi", "Verified purchase reviews")}</h2>
          {a.reviews.map((r) => (
            <div className="support-case" key={r.id}>
              <strong>{r.rating} / 5</strong>
              <p>{r.body}</p>
              <ActionForm
                submit={r.hidden ? t("Tampilkan ulasan", "Show review") : t("Sembunyikan ulasan", "Hide review")}
                onSubmit={async (f) => {
                  await perform("review.moderate", {
                    id: r.id,
                    hidden: !r.hidden,
                    reason: f.get("reason"),
                  });
                }}
              >
                <Field label={t("Alasan moderasi", "Moderation reason")}>
                  <TextInput name="reason" required minLength={5} />
                </Field>
              </ActionForm>
            </div>
          ))}
          {!a.reviews.length && (
            <p className="quiet-empty">{t("Belum ada ulasan.", "No reviews yet.")}</p>
          )}
        </section>
      ) : (
        <section className="panel">
          <h2>{t("Riwayat audit", "Audit history")}</h2>
          <p>
            {t(
              "Riwayat bersifat permanen dan tidak dapat diedit. Menampilkan 100 kejadian terbaru.",
              "This history is permanent and cannot be edited. Showing the 100 most recent events.",
            )}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Waktu", "Time")}</th>
                  <th>{t("Aksi", "Action")}</th>
                  <th>{t("Pelaku", "Actor")}</th>
                  <th>{t("Detail", "Details")}</th>
                </tr>
              </thead>
              <tbody>
                {a.audit.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.created_at).toLocaleString(locale === "id" ? "id-ID" : "en-GB")}</td>
                    <td>
                      <strong>{e.action}</strong>
                    </td>
                    <td>
                      <code>{e.actor_id?.slice(0, 8) || t("Sistem", "System")}</code>
                    </td>
                    <td>
                      <details>
                        <summary>{t("Lihat catatan", "View notes")}</summary>
                        <pre>{JSON.stringify(e.details, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
