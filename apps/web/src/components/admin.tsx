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
  const { perform } = useApp();
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
            sellers: "Katerer & kepercayaan",
            transactions: "Transaksi marketplace",
            support: "Bantuan & pengembalian dana",
            payouts: "Pencairan dana katerer",
            promotions: "Promosi yang terukur",
            reviews: "Ulasan pelanggan",
            audit: "Jejak keputusan",
          }[view] || "Catera Admin"
        }
        description="Keputusan yang jelas. Bukti yang dapat ditelusuri."
      />
      {view === "sellers" ? (
        <>
          <div className="ops-metrics">
            {[
              [
                ShieldCheck,
                "Menunggu tinjauan",
                a.caterers.filter((c) => c.status === "submitted").length,
              ],
              [
                ShieldCheck,
                "Katerer aktif",
                a.caterers.filter((c) => c.status === "approved").length,
              ],
              [
                LifeBuoy,
                "Permintaan terbuka",
                a.cases.filter((c) => c.status !== "resolved").length,
              ],
              [
                Wallet,
                "Pembayaran bermasalah",
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
              <h2>Antrean verifikasi</h2>
              <div className="queue-filters">
                <Button
                  className={filter === "submitted" ? "selected" : ""}
                  onClick={() => {
                    setFilter("submitted");
                    setSelected("");
                  }}
                >
                  Menunggu tinjauan
                </Button>
                <Button
                  className={filter === "all" ? "selected" : ""}
                  onClick={() => setFilter("all")}
                >
                  Semua katerer
                </Button>
              </div>
              {filter === "submitted" &&
                !a.caterers.some((c) => c.status === "submitted") && (
                  <p className="quiet-empty">
                    Tidak ada pengajuan yang menunggu tinjauan. Buka Semua
                    katerer untuk melihat mitra dan statusnya.
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
                        {currency(o.price)} / porsi / hari · {o.days} hari ·{" "}
                        {o.menus.map(menuSummary).join(", ")}
                      </small>
                    </span>
                    <Status status={o.status} />
                  </div>
                ))}
                <Facts
                  rows={[
                    ["Area", seller.area.join(", ")],
                    ["Cutoff", seller.cutoff],
                    ["Zona waktu", seller.timezone],
                    ["Revisi", seller.version],
                  ]}
                />
                <ActionForm
                  submit="Simpan keputusan verifikasi"
                  onSubmit={async (f) => {
                    await perform("admin.verify", {
                      id: seller.id,
                      version: seller.version,
                      status: f.get("status"),
                      reason: f.get("reason"),
                    });
                  }}
                >
                  <Field label="Keputusan">
                    <Select name="status" defaultValue={seller.status}>
                      <SelectOption value="approved">
                        Setujui katerer
                      </SelectOption>
                      <SelectOption value="corrections">
                        Minta perbaikan
                      </SelectOption>
                      <SelectOption value="suspended">
                        Tangguhkan penjualan
                      </SelectOption>
                    </Select>
                  </Field>
                  <Field label="Alasan / koreksi yang diperlukan">
                    <TextArea name="reason" required minLength={5} />
                  </Field>
                  <p className="notice">
                    Penangguhan menghentikan penjualan baru. Pengantaran aktif
                    tetap harus dipenuhi.
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
            <h2>Proses refund</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kasus</th>
                    <th>Jumlah</th>
                    <th>Status provider / rekonsiliasi</th>
                  </tr>
                </thead>
                <tbody>
                  {a.refunds.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <code>{r.case_id}</code>
                      </td>
                      <td>{currency(r.amount)}</td>
                      <td>
                        <Status status={r.state} />
                        {r.state === "succeeded" && !r.reconciliation && (
                          <details>
                            <summary>Rekonsiliasi refund</summary>
                            <ActionForm
                              submit="Konfirmasi rekonsiliasi"
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
                              <Field label="Potongan alokasi katerer (Rp)">
                                <NumericInput
                                  name="sellerDeduction"
                                  min={0}
                                  max={r.amount}
                                  required
                                />
                              </Field>
                              <Field label="Referensi penyelesaian provider">
                                <TextInput
                                  name="reference"
                                  required
                                  minLength={3}
                                />
                              </Field>
                              <Field label="Alasan & rekonsiliasi biaya split">
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
              <p className="quiet-empty">Belum ada refund yang disetujui.</p>
            )}
          </section>
        </>
      ) : view === "payouts" ? (
        <div className="ops-two-col">
          <section className="panel">
            <h2>Setujui pelepasan dana</h2>
            <ActionForm
              submit="Setujui pencairan tersedia"
              onSubmit={async (f) => {
                await perform("payout.approve", {
                  catererId: f.get("catererId"),
                  reason: f.get("reason"),
                });
              }}
            >
              <Field label="Katerer">
                <Select name="catererId">
                  {a.caterers.map((c) => (
                    <SelectOption key={c.id} value={c.id}>
                      {c.name}
                    </SelectOption>
                  ))}
                </Select>
              </Field>
              <Field label="Catatan pemeriksaan">
                <TextArea name="reason" minLength={5} required />
              </Field>
              <label className="checkbox">
                <Checkbox required />
                Transaksi, pengembalian dana, dan saldo sengketa telah
                diperiksa.
              </label>
              <p className="notice">
                Server menghitung saldo yang dapat dilepas. Dana dalam sengketa
                dikecualikan. Status berhasil hanya dicatat setelah konfirmasi
                penyelesaian.
              </p>
            </ActionForm>
          </section>
          <section className="panel">
            <h2>Riwayat pencairan</h2>
            {a.payouts.map((p) => (
              <div className="queue-row" key={p.id}>
                <span>
                  <strong>
                    {a.caterers.find((c) => c.id === p.caterer_id)?.name}
                  </strong>
                  <small>{currency(p.amount)}</small>
                </span>
                <Status status={p.status} />
                {!["succeeded", "failed"].includes(p.status) && (
                  <details>
                    <summary>Rekonsiliasi pencairan</summary>
                    <ActionForm
                      submit="Catat penyelesaian"
                      onSubmit={async (f) => {
                        await perform("reconcile.payout", {
                          id: p.id,
                          status: f.get("status"),
                          reference: f.get("reference"),
                          reason: f.get("reason"),
                        });
                      }}
                    >
                      <Field label="Hasil provider">
                        <Select name="status">
                          <SelectOption value="succeeded">
                            Dana diterima
                          </SelectOption>
                          <SelectOption value="failed">
                            Gagal, pulihkan alokasi
                          </SelectOption>
                        </Select>
                      </Field>
                      <Field label="Referensi provider">
                        <TextInput name="reference" required minLength={3} />
                      </Field>
                      <Field label="Catatan pemeriksaan">
                        <TextArea name="reason" required minLength={5} />
                      </Field>
                    </ActionForm>
                  </details>
                )}
              </div>
            ))}
            {!a.payouts.length && (
              <p className="quiet-empty">Belum ada pencairan.</p>
            )}
          </section>
        </div>
      ) : view === "promotions" ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Kode promosi</h2>
            <Button className="button small" onClick={() => setOpen(true)}>
              <Plus size={17} />
              Buat promosi
            </Button>
          </div>
          {a.promotions.map((p) => (
            <div className="queue-row" key={p.id}>
              <strong>{p.code}</strong>
              <span>{p.percent}%</span>
              <Status status={p.active ? "active" : "paused"} />
              <ActionForm
                submit={p.active ? "Jeda" : "Aktifkan"}
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
          <Dialog open={open} onOpenChange={setOpen} title="Promosi baru">
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
              <Field label="Kode">
                <TextInput
                  name="code"
                  required
                  pattern="[A-Za-z0-9_-]+"
                  maxLength={40}
                />
              </Field>
              <Field label="Diskon (%)">
                <NumericInput name="percent" min={1} max={90} required />
              </Field>
              <p>
                Promosi berlaku untuk pembelian berikutnya. Nilai diskon
                disimpan pada pembelian.
              </p>
            </ActionForm>
          </Dialog>
        </section>
      ) : view === "reviews" ? (
        <section className="panel">
          <h2>Ulasan pembelian terverifikasi</h2>
          {a.reviews.map((r) => (
            <div className="support-case" key={r.id}>
              <strong>{r.rating} / 5</strong>
              <p>{r.body}</p>
              <ActionForm
                submit={r.hidden ? "Tampilkan ulasan" : "Sembunyikan ulasan"}
                onSubmit={async (f) => {
                  await perform("review.moderate", {
                    id: r.id,
                    hidden: !r.hidden,
                    reason: f.get("reason"),
                  });
                }}
              >
                <Field label="Alasan moderasi">
                  <TextInput name="reason" required minLength={5} />
                </Field>
              </ActionForm>
            </div>
          ))}
          {!a.reviews.length && (
            <p className="quiet-empty">Belum ada ulasan.</p>
          )}
        </section>
      ) : (
        <section className="panel">
          <h2>Riwayat audit</h2>
          <p>
            Riwayat bersifat permanen dan tidak dapat diedit. Menampilkan 100
            kejadian terbaru.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Pelaku</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {a.audit.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.created_at).toLocaleString("id-ID")}</td>
                    <td>
                      <strong>{e.action}</strong>
                    </td>
                    <td>
                      <code>{e.actor_id?.slice(0, 8) || "Sistem"}</code>
                    </td>
                    <td>
                      <details>
                        <summary>Lihat catatan</summary>
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
