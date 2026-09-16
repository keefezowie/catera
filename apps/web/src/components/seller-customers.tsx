"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CustomerDeliveryCalendar } from "./customer-delivery-calendar";
import {
  UserPlus,
  Upload,
  Send,
  CalendarDays,
  Wallet,
  ArrowLeft,
  Pencil,
  Check,
  Users,
} from "lucide-react";
import {
  errorLabel,
  addDays,
  localDay,
  currency,
  normalizeCustomerPhone,
  pilotImportRows,
  type SellerCustomer,
  type CustomerSubscription,
  type PilotImportRow,
  type PilotImportPreview,
  type Delivery,
  type DeliveryChangeResult,
  type Address,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, Dialog, Empty, ErrorNotice, Field, Loading } from "./ui";
import { Button, TextInput, TextArea } from "./form-controls";
import { Select, SelectOption } from "./select";
import { NumericInput } from "./numeric-input";
import { DatePicker } from "./date-picker";
import { PilotPanel } from "./pilot-panel";

export function SellerCustomers({ catererId }: { catererId: string }) {
  const { actor, t, locale, perform, notify } = useApp();
  const query = useSearchParams();
  const [lastChange, setLastChange] = useState<DeliveryChangeResult>();
  const changed = lastChange?.delivery;
  const [actionError, setActionError] = useState("");
  const [followup, setFollowup] = useState(false);
  const fail = (e: unknown) =>
    setActionError(
      errorLabel(e instanceof Error ? e.message : "", locale) ||
        t(
          "Tidak dapat menyelesaikan tindakan. Coba lagi.",
          "Could not complete this action. Try again.",
        ),
    );
  const [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(query.get("customerRecordId") || "");
  const linkedCustomer = query.get("customerRecordId") || "";
  useEffect(() => {
    setSelected(linkedCustomer);
    setLastChange(undefined);
  }, [linkedCustomer]);
  const state = useResource(
    "pilot-customers:" +
      catererId +
      ":" +
      selected +
      ":" +
      offset +
      ":" +
      followup +
      ":" +
      (query.get("customerId") || ""),
    () =>
      api.sellerCustomers(
        catererId,
        selected
          ? "?customerRecordId=" + selected
          : "?offset=" +
              offset +
              (followup ? "&followup=true" : "") +
              (query.get("customerId")
                ? "&customerId=" + query.get("customerId")
                : ""),
      ),
  );
  const [editing, setEditing] = useState<SellerCustomer | null | undefined>();
  const [importing, setImporting] = useState(false),
    [renewing, setRenewing] = useState<CustomerSubscription | null>(null);
  const [preview, setPreview] = useState<PilotImportPreview | null>(null),
    [bulk, setBulk] = useState(""),
    [bulkError, setBulkError] = useState("");
  const [share, setShare] = useState<{
    url: string;
    message: string;
    phone: string;
  } | null>(null);
  const [change, setChange] = useState<Delivery | null>(null),
    [changeKind, setChangeKind] = useState("date");
  const [busy, setBusy] = useState(false),
    [packageId, setPackageId] = useState(""),
    [recordId, setRecordId] = useState("");
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const data = {
      ...state.data,
      customers: state.data.customers.map((c) => ({
        ...c,
        subscriptions: c.subscriptions.map((s) => {
          const previous = s.deliveries.find((d) => d.id === changed?.id);
          if (
            !lastChange ||
            !changed ||
            !previous ||
            previous.version > changed.version
          )
            return s;
          const deliveries = s.deliveries.map((d) =>
            d.id === changed.id ? changed : d,
          );
          return {
            ...s,
            ...lastChange.subscription,
            deliveries,
            next_delivery:
              deliveries
                .filter(
                  (d) =>
                    d.status === "scheduled" &&
                    d.service_date >= localDay(new Date(), d.offer.timezone),
                )
                .map((d) => d.service_date)
                .sort()[0] || null,
          };
        }),
      })),
    },
    owner = actor?.role === "owner",
    current = data.customers.find((c) => c.id === selected);
  const runImport = async (rows: PilotImportRow[]) =>
    setPreview(
      await perform<PilotImportPreview>("import.preview", { catererId, rows }),
    );
  const closeImport = () => {
    if (!busy) {
      setImporting(false);
      setPreview(null);
      setRenewing(null);
      setBulkError("");
    }
  };
  return (
    <div className="pilot-workspace">
      {state.error && (
        <ErrorNotice
          message={
            changed
              ? t(
                  "Perubahan tersimpan, tetapi jadwal belum berhasil dimuat ulang.",
                  "Change saved, but the schedule could not be refreshed.",
                )
              : state.error
          }
          retry={state.reload}
        />
      )}
      {actionError && <ErrorNotice message={actionError} />}
      {!selected && (
        <div className="action-row">
          <Button
            className="button secondary"
            aria-pressed={!followup}
            onClick={() => {
              setFollowup(false);
              setOffset(0);
            }}
          >
            {t("Semua pelanggan", "All customers")}
          </Button>
          <Button
            className="button secondary"
            aria-pressed={followup}
            onClick={() => {
              setFollowup(true);
              setOffset(0);
            }}
          >
            {t("Perlu perpanjangan", "Renewal follow-ups")}
          </Button>
        </div>
      )}
      <div className="action-row">
        {selected && (
          <Button className="button secondary" onClick={() => setSelected("")}>
            <ArrowLeft size={18} />
            {t("Semua pelanggan", "All customers")}
          </Button>
        )}
        {owner && (
          <>
            <Button className="button" onClick={() => setEditing(null)}>
              <UserPlus size={18} />
              {t("Tambah pelanggan", "Add customer")}
            </Button>
            <Button
              className="button secondary"
              onClick={() => {
                setImporting(true);
                setRecordId(current?.id || "");
                setPackageId(data.packages[0]?.id || "");
              }}
            >
              <Upload size={18} />
              {t("Impor prabayar", "Import prepaid")}
            </Button>
          </>
        )}
      </div>
      {!data.customers.length && (
        <Empty
          title={t(
            "Mulai dari pelanggan yang sudah Anda layani",
            "Start with your existing customers",
          )}
          description={t(
            "Tambahkan pelanggan dan jadwal prabayar. Pelanggan dapat membuat akun nanti.",
            "Add customers and prepaid schedules. Customers can create an account later.",
          )}
        />
      )}
      <div className="pilot-customer-grid">
        {data.customers.map((c) => (
          <article className="panel" key={c.id}>
            <div className="section-heading">
              <div>
                <h2>{c.name}</h2>
                <p>
                  {c.phone || t("Nomor belum dicatat", "Phone not recorded")}
                </p>
              </div>
              <Users size={22} />
            </div>
            <div className="pilot-tags">
              <span>
                {c.user_id
                  ? t("Akun terhubung", "Account connected")
                  : t("Dikelola katerer", "Seller managed")}
              </span>
              <span>
                {c.origin === "seller"
                  ? t("Pelanggan katerer", "Seller customer")
                  : t("Melalui marketplace", "Marketplace customer")}
              </span>
            </div>
            {c.claim_review && (
              <p role="status" className="notice">
                {t(
                  "Pengaitan akun perlu ditinjau. Periksa kepemilikan dan jadwal sebelum pelanggan mencoba lagi.",
                  "Account linking needs review. Check ownership and schedules before the customer retries.",
                )}
              </p>
            )}
            <div className="action-row">
              {!selected && (
                <Button
                  className="button secondary"
                  onClick={() => setSelected(c.id)}
                >
                  <CalendarDays size={16} />
                  {t("Lihat jadwal", "View schedule")}
                </Button>
              )}
              {owner && (
                <Button
                  className="button secondary"
                  onClick={() => setEditing(c)}
                >
                  <Pencil size={16} />
                  {t("Edit", "Edit")}
                </Button>
              )}
              {owner && !c.user_id && c.phone && (
                <Button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      const r = await perform<{ path: string; phone: string }>(
                        "customer.invite",
                        { catererId, customerRecordId: c.id },
                      );
                      setShare({
                        url: location.origin + r.path,
                        phone: r.phone,
                        message: t(
                          "Kelola jadwal katering Anda di Catera. Verifikasi nomor telepon untuk menghubungkan langganan:",
                          "Manage your catering schedule on Catera. Verify your phone to connect your subscription:",
                        ),
                      });
                    } catch (e) {
                      fail(e);
                    }
                  }}
                >
                  <Send size={16} />
                  {t("Undang pelanggan", "Invite customer")}
                </Button>
              )}
            </div>
            {!c.subscriptions.length && (
              <p className="muted">
                {t(
                  "Belum ada jadwal. Impor langganan yang sudah dibayar.",
                  "No schedule yet. Import an already-paid subscription.",
                )}
              </p>
            )}
            {(selected || query.get("customerId")) && (
              <CustomerDeliveryCalendar
                key={c.id}
                changed={changed}
                deliveries={c.subscriptions
                  .flatMap((s) => s.deliveries)
                  .map((d) =>
                    changed?.id === d.id && changed.version >= d.version
                      ? changed
                      : d,
                  )}
                onChange={(d) => {
                  setChange(d);
                  setChangeKind(d.canChange ? "date" : "address");
                }}
              />
            )}
            {c.subscriptions.map((s) => (
              <section className="pilot-subscription" key={s.id}>
                <h3>{s.package_name}</h3>
                <p>
                  {s.portions} {t("porsi", "portions")} · {s.remaining}{" "}
                  {t("hari pengantaran tersisa", "delivery days remaining")}
                </p>
                <p>
                  {t("Berikutnya", "Next")}: {s.next_delivery || "—"} ·{" "}
                  {s.payment_route === "catera"
                    ? t("Dibayar melalui Catera", "Paid through Catera")
                    : t(
                        "Pembayaran eksternal dilaporkan katerer",
                        "External payment reported by seller",
                      )}
                </p>
                <p>
                  {t("Pembelian berikutnya", "Next purchase")}:{" "}
                  {s.renewal_status === "catera"
                    ? "Catera"
                    : s.renewal_status === "external_reported"
                      ? t("Dibayar eksternal", "Paid externally")
                      : s.renewal_status === "declined"
                        ? t("Tidak melanjutkan", "Not continuing")
                        : t("Belum diketahui", "Unknown")}
                </p>
                {s.remaining <= 3 &&
                  !s.trial &&
                  s.status !== "cancelled" &&
                  ["unknown", "declined"].includes(s.renewal_status) && (
                    <div className="action-row">
                      {c.user_id && c.phone && (
                        <Button
                          className="button secondary"
                          onClick={async () => {
                            try {
                              const r = await perform<{ path: string }>(
                                "customer.followup",
                                {
                                  catererId,
                                  subscriptionId: s.id,
                                  kind: "prepared",
                                },
                              );
                              setShare({
                                url: location.origin + r.path,
                                phone: c.phone!,
                                message: t(
                                  "Paket katering Anda hampir selesai. Tinjau jadwal dan harga pembelian berikutnya:",
                                  "Your catering package is nearly finished. Review the schedule and price for your next purchase:",
                                ),
                              });
                            } catch (e) {
                              fail(e);
                            }
                          }}
                        >
                          <Send size={16} />
                          {t("Siapkan pengingat", "Prepare reminder")}
                        </Button>
                      )}
                      {owner && (
                        <Button
                          className="button secondary"
                          onClick={() => {
                            setRenewing(s);
                            setImporting(true);
                            setRecordId(c.id);
                            setPackageId(
                              data.packages.find((p) => p.id === s.package_id)
                                ?.id ||
                                data.packages[0]?.id ||
                                "",
                            );
                          }}
                        >
                          <Wallet size={16} />
                          {t(
                            "Catat pembayaran eksternal",
                            "Record external renewal",
                          )}
                        </Button>
                      )}
                      <Button
                        className="text-button"
                        onClick={() =>
                          perform("customer.followup", {
                            catererId,
                            subscriptionId: s.id,
                            kind:
                              s.renewal_status === "declined"
                                ? "unknown"
                                : "declined",
                          }).catch(fail)
                        }
                      >
                        {s.renewal_status === "declined"
                          ? t("Tandai belum diketahui", "Mark unknown")
                          : t("Tidak melanjutkan", "Not continuing")}
                      </Button>
                    </div>
                  )}
                {s.prepared_at && (
                  <small>
                    {t(
                      "Pesan disiapkan, bukan bukti terkirim",
                      "Message prepared; delivery is unverified",
                    )}
                  </small>
                )}
              </section>
            ))}
          </article>
        ))}
      </div>
      {!selected && data.total > 100 && (
        <div className="action-row">
          <Button
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 100))}
          >
            {t("Sebelumnya", "Previous")}
          </Button>
          <span>
            {offset + 1}–{Math.min(offset + 100, data.total)} / {data.total}
          </span>
          <Button
            disabled={offset + 100 >= data.total}
            onClick={() => setOffset(offset + 100)}
          >
            {t("Berikutnya", "Next")}
          </Button>
        </div>
      )}
      {owner && (
        <details className="panel">
          <summary>
            {t("Biaya & tagihan pilot", "Pilot fees & invoices")}
          </summary>
          <PilotPanel catererId={catererId} />
        </details>
      )}

      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        title={
          editing
            ? t("Edit pelanggan", "Edit customer")
            : t("Tambah pelanggan", "Add customer")
        }
      >
        {editing !== undefined && (
          <ActionForm
            key={editing?.id || "new"}
            submit={t("Simpan pelanggan", "Save customer")}
            onSubmit={async (f) => {
              await perform("customer.save", {
                catererId,
                id: editing?.id,
                version: editing?.version,
                name: f.get("name"),
                phone: normalizeCustomerPhone(String(f.get("phone"))),
                address: addressFrom(f),
              });
              setEditing(undefined);
            }}
          >
            <Field label={t("Nama", "Name")}>
              <TextInput
                name="name"
                defaultValue={editing?.name}
                required
                maxLength={100}
              />
            </Field>
            <Field label={t("Nomor WhatsApp", "WhatsApp number")}>
              <TextInput
                name="phone"
                type="tel"
                defaultValue={editing?.phone || ""}
                placeholder="08…"
                required
              />
            </Field>
            <CustomerAddress value={editing?.address} />
          </ActionForm>
        )}
      </Dialog>
      <Dialog
        open={importing}
        onOpenChange={(open) => {
          if (!open) closeImport();
        }}
        busy={busy}
        size="editor"
        title={
          renewing
            ? t(
                "Pembelian berikutnya dibayar eksternal",
                "Externally paid renewal",
              )
            : t("Impor langganan prabayar", "Import prepaid subscriptions")
        }
      >
        {preview ? (
          <>
            <p>
              {t(
                "Periksa pelanggan, tanggal, dan porsi. Belum ada jadwal yang dipesan.",
                "Review customers, dates, and portions. No schedule is reserved yet.",
              )}
            </p>
            {preview.rows.map((r, i) => (
              <div className="pilot-subscription" key={i}>
                <strong>{r.customerName}</strong>
                <p>
                  {r.preview.offer.name} · {r.portions} {t("porsi", "portions")}
                </p>
                <p>{r.preview.dates.join(" · ")}</p>
                <small>
                  {r.newCustomer
                    ? t(
                        "Pelanggan baru, akun belum diperlukan",
                        "New customer; no account required",
                      )
                    : t("Pelanggan yang sudah tercatat", "Existing customer")}
                </small>
              </div>
            ))}
            <ActionForm
              submit={t("Konfirmasi impor", "Confirm import")}
              onSubmit={async () => {
                setBusy(true);
                try {
                  await perform("import.commit", { catererId, id: preview.id });
                  setPreview(null);
                  setImporting(false);
                  setRenewing(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p className="notice">
                {t(
                  "Pembayaran telah diterima di luar Catera. Impor ini tidak membuat pembayaran atau pencairan baru.",
                  "Payment was received outside Catera. This import creates no new payment or payout.",
                )}
              </p>
            </ActionForm>
            <Button className="text-button" onClick={() => setPreview(null)}>
              <ArrowLeft size={16} />
              {t("Kembali mengedit", "Back to edit")}
            </Button>
          </>
        ) : (
          <>
            {!renewing && (
              <details className="panel">
                <summary>
                  {t("CSV / tempel dari Excel", "CSV / paste from Excel")}
                </summary>
                <p>
                  {t(
                    "Gunakan judul kolom berikut. Isi paket dengan nama paket yang sama persis. Maksimal 100 baris.",
                    "Use these column headers and the exact package name. Maximum 100 rows.",
                  )}
                </p>
                <pre className="pilot-template">
                  name,phone,line,area,city,package,portions,startDate,remainingDays,externalReference
                </pre>
                <Field label={t("File CSV", "CSV file")}>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 140000) {
                          setBulkError(
                            t(
                              "File terlalu besar. Maksimal 140 KB.",
                              "File too large. Maximum 140 KB.",
                            ),
                          );
                          return;
                        }
                        setBulk(await file.text());
                        setBulkError("");
                      }
                    }}
                  />
                </Field>
                <Field label={t("Data tabel", "Table data")}>
                  <TextArea
                    value={bulk}
                    onChange={(e) => {
                      setBulk(e.target.value);
                      setBulkError("");
                    }}
                    rows={6}
                  />
                </Field>
                {bulkError && <p role="alert">{bulkError}</p>}
                <ActionForm
                  children={null}
                  submit={t("Periksa tabel", "Review table")}
                  onSubmit={async () => {
                    try {
                      await runImport(
                        pilotImportRows(bulk, data.packages, data.customers),
                      );
                    } catch (e) {
                      setBulkError(
                        t(
                          "Periksa kolom, nomor telepon, dan nama paket. Detail: ",
                          "Check columns, phone numbers, and package names. Details: ",
                        ) + (e instanceof Error ? e.message : ""),
                      );
                      throw e;
                    }
                  }}
                />
              </details>
            )}
            <ActionForm
              key={renewing?.id || "import"}
              submit={t("Periksa jadwal", "Review schedule")}
              onSubmit={async (f) => {
                if (!recordId || !packageId) throw new Error("INVALID_INPUT");
                const c = data.customers.find((c) => c.id === recordId)!;
                await runImport([
                  {
                    customerRecordId: recordId,
                    address: c.address,
                    packageId,
                    portions: Number(f.get("portions")),
                    remainingDays: Number(f.get("remainingDays")),
                    startDate: String(f.get("startDate")),
                    externalReference: String(f.get("externalReference")),
                    ...(renewing ? { renewedFrom: renewing.id } : {}),
                  },
                ]);
              }}
            >
              <Field label={t("Pelanggan", "Customer")}>
                <Select
                  value={recordId}
                  onValueChange={setRecordId}
                  disabled={!!renewing}
                >
                  <SelectOption value="">
                    {t("Pilih pelanggan", "Choose customer")}
                  </SelectOption>
                  {data.customers.map((c) => (
                    <SelectOption key={c.id} value={c.id}>
                      {c.name}
                    </SelectOption>
                  ))}
                </Select>
              </Field>
              <Field label={t("Paket", "Package")}>
                <Select value={packageId} onValueChange={setPackageId}>
                  <SelectOption value="">
                    {t("Pilih paket", "Choose package")}
                  </SelectOption>
                  {data.packages.map((p) => (
                    <SelectOption key={p.id} value={p.id}>
                      {p.name}
                    </SelectOption>
                  ))}
                </Select>
              </Field>
              <Field label={t("Porsi tetap", "Fixed portions")}>
                <NumericInput
                  name="portions"
                  min={1}
                  max={100}
                  defaultValue={renewing?.portions || 1}
                  required
                />
              </Field>
              <Field
                label={t(
                  "Sisa hari yang sudah dibayar",
                  "Remaining prepaid delivery days",
                )}
              >
                <NumericInput
                  name="remainingDays"
                  min={1}
                  max={60}
                  defaultValue={
                    renewing
                      ? data.packages.find((p) => p.id === packageId)?.days || 1
                      : 1
                  }
                  required
                />
              </Field>
              <Field label={t("Mulai pengantaran", "First delivery")}>
                <DatePicker
                  name="startDate"
                  defaultValue={
                    renewing
                      ? addDays(renewing.ends_on, 1)
                      : addDays(localDay(), 2)
                  }
                  required
                />
              </Field>
              <Field
                label={t(
                  "Referensi bukti pembayaran",
                  "Payment receipt reference",
                )}
              >
                <TextInput
                  name="externalReference"
                  required
                  minLength={3}
                  maxLength={120}
                />
              </Field>
            </ActionForm>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!share}
        onOpenChange={(open) => {
          if (!open) setShare(null);
        }}
        title={t("Pesan siap dikirim", "Message ready to send")}
      >
        {share && (
          <>
            <p>{share.message}</p>
            <p className="notice">
              {t(
                "Anda memilih kapan mengirim. Catera tidak dapat memastikan pesan WhatsApp terkirim atau dibaca.",
                "You choose when to send. Catera cannot confirm WhatsApp delivery or reading.",
              )}
            </p>
            <a
              className="button"
              target="_blank"
              rel="noreferrer"
              href={
                "https://wa.me/" +
                share.phone.replace(/\D/g, "") +
                "?text=" +
                encodeURIComponent(share.message + " " + share.url)
              }
            >
              <Send size={18} />
              {t("Buka WhatsApp", "Open WhatsApp")}
            </a>
            <Button
              className="button secondary"
              onClick={() =>
                navigator.clipboard.writeText(share.message + " " + share.url)
              }
            >
              {t("Salin pesan", "Copy message")}
            </Button>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!change}
        onOpenChange={(open) => {
          if (!open) setChange(null);
        }}
        title={t(
          "Perubahan atas permintaan pelanggan",
          "Customer-requested change",
        )}
      >
        {change && (
          <ActionForm
            key={change.id + changeKind}
            submit={t("Simpan perubahan", "Save change")}
            onSubmit={async (f) => {
              const result = await perform<DeliveryChangeResult>(
                "customer.deliveryChange",
                {
                  catererId,
                  id: change.id,
                  version: change.version,
                  reason: f.get("reason"),
                  ...(changeKind === "date"
                    ? { date: f.get("date") }
                    : { address: addressFrom(f) }),
                },
              );
              setLastChange(result);
              notify(
                changeKind === "date"
                  ? `${change.service_date} → ${result.delivery.service_date} ${t("diperbarui", "updated")}`
                  : `${result.delivery.service_date}: ${t("Alamat diperbarui", "Address updated")} · ${result.delivery.address.line}`,
              );
              setChange(null);
            }}
          >
            <Field label={t("Jenis perubahan", "Change type")}>
              <Select value={changeKind} onValueChange={setChangeKind}>
                {change.canChange && (
                  <SelectOption value="date">
                    {t("Tanggal", "Date")}
                  </SelectOption>
                )}
                <SelectOption value="address">
                  {t("Alamat", "Address")}
                </SelectOption>
              </Select>
            </Field>
            {changeKind === "date" ? (
              <Field label={t("Tanggal baru", "New date")}>
                <DatePicker
                  name="date"
                  defaultValue={addDays(change.service_date, 1)}
                  required
                />
              </Field>
            ) : (
              <CustomerAddress value={change.address} />
            )}
            <Field label={t("Permintaan pelanggan", "Customer request")}>
              <TextArea name="reason" required minLength={5} />
            </Field>
          </ActionForm>
        )}
      </Dialog>
    </div>
  );
}
function addressFrom(f: FormData) {
  return {
    label: String(f.get("label") || "Katering"),
    line: String(f.get("line")),
    area: String(f.get("area")),
    city: String(f.get("city")),
    instructions: String(f.get("instructions") || ""),
  };
}
function CustomerAddress({ value }: { value?: Partial<Address> }) {
  const { t } = useApp();
  return (
    <>
      <Field label={t("Alamat pengantaran", "Delivery address")}>
        <TextInput
          name="line"
          defaultValue={value?.line}
          required
          minLength={5}
          maxLength={240}
        />
      </Field>
      <Field label={t("Area pengantaran", "Delivery area")}>
        <TextInput name="area" defaultValue={value?.area} required />
      </Field>
      <Field label={t("Kota", "City")}>
        <TextInput name="city" defaultValue={value?.city} required />
      </Field>
      <Field label={t("Catatan pengantaran", "Delivery notes")}>
        <TextInput
          name="instructions"
          defaultValue={value?.instructions}
          maxLength={400}
        />
      </Field>
    </>
  );
}
