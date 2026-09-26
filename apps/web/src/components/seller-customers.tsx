"use client";
import { useEffect, useMemo, useState } from "react";
import { CustomerDeliveryCalendar } from "./customer-delivery-calendar";
import {
  Send,
  CalendarDays,
  ArrowLeft,
  Pencil,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  errorLabel,
  addDays,
  localDay,
  currency,
  normalizeCustomerPhone,
  type SellerCustomer,
  type Delivery,
  type DeliveryChangeResult,
  type Address,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, Dialog, Empty, ErrorNotice, Field, Loading } from "./ui";
import { Button, TextInput, TextArea } from "./form-controls";
import { Select, SelectOption } from "./select";
import { DatePicker } from "./date-picker";
import { PilotPanel } from "./pilot-panel";
import { PrepaidMigration } from "./prepaid-migration";
import { useJourneyQuery, useDiscardChanges } from "./journey-state";
import "./seller-customers.css";

export function SellerCustomers({ catererId }: { catererId: string }) {
  const { actor, t, locale, perform, notify } = useApp();
  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        day: "numeric",
        month: "short",
      }),
    [locale],
  );
  const { query, update } = useJourneyQuery();
  const [lastChange, setLastChange] = useState<DeliveryChangeResult>();
  const changed = lastChange?.delivery;
  const [actionError, setActionError] = useState("");
  const followup = query.get("followup") === "true";
  const setFollowup = (value: boolean) =>
    update({ followup: value ? "true" : null });
  const search = query.get("search") || "";
  const fail = (e: unknown) =>
    setActionError(
      errorLabel(e instanceof Error ? e.message : "", locale) ||
        t(
          "Tidak dapat menyelesaikan tindakan. Coba lagi.",
          "Could not complete this action. Try again.",
        ),
    );
  const offset = Math.max(0, Math.floor(Number(query.get("offset")) || 0));
  const setOffset = (value: number) => update({ offset: value || null });
  const selected = query.get("customerRecordId") || "";
  const setSelected = (value: string) =>
    update({ customerRecordId: value, customerId: null });
  const linkedCustomer = query.get("customerRecordId") || "";
  useEffect(() => {
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
      search +
      ":" +
      (query.get("customerId") || ""),
    () =>
      api.sellerCustomers(
        catererId,
        selected
          ? "?customerRecordId=" + selected
          : "?offset=" +
              offset +
              "&search=" +
              encodeURIComponent(search) +
              (followup ? "&followup=true" : "") +
              (query.get("customerId")
                ? "&customerId=" + query.get("customerId")
                : ""),
      ),
  );
  const [editing, setEditing] = useState<SellerCustomer | undefined>();
  const [share, setShare] = useState<{
    url: string;
    message: string;
    phone: string;
  } | null>(null);
  const [change, setChange] = useState<Delivery | null>(null),
    [changeKind, setChangeKind] = useState("date");
  const [changeDirty, setChangeDirty] = useState(false);
  const changeGuard = useDiscardChanges(changeDirty && !!change, () => {
    setChange(null);
    setChangeDirty(false);
  });
  const customerNavigation = (
    <div
      className="customer-view-switch"
      key="customer-navigation"
      role="group"
      aria-label={t("Tampilan pelanggan", "Customer view")}
    >
      <Button
        variant="secondary"
        aria-pressed={selected ? undefined : !followup}
        onClick={() => {
          setSelected("");
          setFollowup(false);
          setOffset(0);
          update({ search: null });
        }}
      >
        {selected && <ArrowLeft size={18} />}
        {t("Semua pelanggan", "All customers")}
      </Button>
      {!selected && (
        <Button
          variant="secondary"
          aria-pressed={followup}
          onClick={() => {
            setFollowup(true);
            setOffset(0);
          }}
        >
          {t("Perlu perpanjangan", "Renewal follow-ups")}
        </Button>
      )}
    </div>
  );
  if (!state.data)
    return (
      <div className="pilot-workspace seller-customers">
        {customerNavigation}
        {state.error ? (
          <ErrorNotice message={state.error} retry={state.reload} />
        ) : (
          <Loading />
        )}
      </div>
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
    owner = actor?.role === "owner";
  return (
    <div className="pilot-workspace seller-customers">
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
      {selected ? (
        customerNavigation
      ) : (
        <section
          className="customer-controls"
          aria-label={t(
            "Cari dan filter pelanggan",
            "Search and filter customers",
          )}
        >
          <div className="customer-filter-bar">
            {customerNavigation}
            <p className="customer-result-count" aria-live="polite">
              <strong>{data.total}</strong>{" "}
              {t("pelanggan", data.total === 1 ? "customer" : "customers")}
            </p>
          </div>
          <form
            className="customer-search"
            onSubmit={(event) => {
              event.preventDefault();
              update({
                search: String(
                  new FormData(event.currentTarget).get("search") || "",
                ).trim(),
                offset: null,
                customerId: null,
              });
            }}
          >
            <Field label={t("Cari pelanggan", "Search customers")}>
              <TextInput
                key={search}
                name="search"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder={t(
                  "Nama atau nomor telepon",
                  "Name or phone number",
                )}
              />
            </Field>
            <Button type="submit" variant="secondary">
              {t("Cari", "Search")}
            </Button>
            {search && (
              <Button
                type="button"
                variant="text"
                onClick={() => update({ search: null, offset: null })}
              >
                {t("Hapus pencarian", "Clear search")}
              </Button>
            )}
          </form>
        </section>
      )}
      {!data.customers.length && (
        <Empty
          title={
            followup || search || selected
              ? t("Tidak ada pelanggan yang cocok", "No matching customers")
              : t("Belum ada pelanggan berlangganan", "No subscribers yet")
          }
          description={
            followup || search || selected
              ? t(
                  "Coba pencarian lain atau hapus filter untuk melihat pelanggan lainnya.",
                  "Try another search or clear the filters to see other customers.",
                )
              : t(
                  "Pelanggan muncul otomatis setelah membeli langganan paket Anda.",
                  "Customers appear automatically after purchasing one of your packages.",
                )
          }
        />
      )}
      {!data.customers.length && (followup || search || selected) && (
        <Button
          variant="secondary"
          onClick={() =>
            update({
              customerRecordId: null,
              customerId: null,
              search: null,
              followup: null,
              offset: null,
            })
          }
        >
          {t("Hapus filter", "Clear filters")}
        </Button>
      )}
      <div className="pilot-customer-grid customer-list" role="list">
        {data.customers.map((c) => {
          const nextDelivery = c.subscriptions
              .map((subscription) => subscription.next_delivery)
              .filter((day): day is string => !!day)
              .sort()[0],
            remainingDeliveries = c.subscriptions.reduce(
              (total, subscription) => total + subscription.remaining,
              0,
            );
          return (
            <article className="panel customer-row" key={c.id} role="listitem">
              <header className="customer-row-header">
                <div className="customer-identity">
                  <span className="customer-avatar" aria-hidden="true">
                    {c.name.slice(0, 1).toLocaleUpperCase(locale)}
                  </span>
                  <div>
                    <h2>{c.name}</h2>
                    <p>
                      {c.phone ||
                        t("Nomor belum dicatat", "Phone not recorded")}
                    </p>
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
                  </div>
                </div>
                <div className="customer-row-metrics">
                  <span>
                    <strong>{c.subscriptions.length}</strong>
                    <small>{t("Langganan", "Subscriptions")}</small>
                  </span>
                  <span>
                    <strong>{remainingDeliveries}</strong>
                    <small>{t("Hari tersisa", "Days remaining")}</small>
                  </span>
                  <span>
                    <strong>
                      {nextDelivery
                        ? shortDate.format(
                            new Date(`${nextDelivery}T12:00:00Z`),
                          )
                        : "—"}
                    </strong>
                    <small>{t("Berikutnya", "Next delivery")}</small>
                  </span>
                </div>
                <div className="customer-row-actions">
                  {!selected && (
                    <Button
                      variant="secondary"
                      onClick={() => setSelected(c.id)}
                    >
                      <CalendarDays size={16} />
                      {t("Lihat jadwal", "View schedule")}
                    </Button>
                  )}
                  {owner && (
                    <Button variant="secondary" onClick={() => setEditing(c)}>
                      <Pencil size={16} />
                      {t("Edit", "Edit")}
                    </Button>
                  )}
                  {owner && !c.user_id && c.phone && (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const r = await perform<{
                            path: string;
                            phone: string;
                          }>("customer.invite", {
                            catererId,
                            customerRecordId: c.id,
                          });
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
              </header>
              {c.claim_review && (
                <p role="status" className="notice">
                  {t(
                    "Pengaitan akun perlu ditinjau. Periksa kepemilikan dan jadwal sebelum pelanggan mencoba lagi.",
                    "Account linking needs review. Check ownership and schedules before the customer retries.",
                  )}
                </p>
              )}
              {!c.subscriptions.length && (
                <p className="muted customer-no-subscriptions">
                  {t(
                    "Belum ada langganan aktif.",
                    "No active subscription yet.",
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
              {!!c.subscriptions.length && (
                <details
                  className="customer-subscriptions"
                  open={!!selected || !!query.get("customerId")}
                >
                  <summary>
                    <span>
                      <strong>
                        {c.subscriptions.length}{" "}
                        {t(
                          "langganan",
                          c.subscriptions.length === 1
                            ? "subscription"
                            : "subscriptions",
                        )}
                      </strong>
                      <small>
                        {t(
                          "Lihat paket, pembayaran, dan tindak lanjut",
                          "View packages, payments, and follow-ups",
                        )}
                      </small>
                    </span>
                    <ChevronDown size={19} aria-hidden="true" />
                  </summary>
                  <div className="customer-subscription-list">
                    {c.subscriptions.map((s) => (
                      <section className="pilot-subscription" key={s.id}>
                        <h3>{s.package_name}</h3>
                        <dl className="customer-subscription-facts">
                          <div>
                            <dt>{t("Porsi", "Portions")}</dt>
                            <dd>{s.portions}</dd>
                          </div>
                          <div>
                            <dt>{t("Hari tersisa", "Days remaining")}</dt>
                            <dd>{s.remaining}</dd>
                          </div>
                          <div>
                            <dt>{t("Berikutnya", "Next delivery")}</dt>
                            <dd>
                              {s.next_delivery
                                ? shortDate.format(
                                    new Date(`${s.next_delivery}T12:00:00Z`),
                                  )
                                : "—"}
                            </dd>
                          </div>
                        </dl>
                        <p className="customer-subscription-meta">
                          {s.payment_route === "catera"
                            ? t("Dibayar melalui Catera", "Paid through Catera")
                            : t(
                                "Pembayaran eksternal dilaporkan katerer",
                                "External payment reported by seller",
                              )}
                          {" · "}
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
                          ["unknown", "declined"].includes(
                            s.renewal_status,
                          ) && (
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
                  </div>
                </details>
              )}
            </article>
          );
        })}
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
        <details className="panel customer-owner-tools">
          <summary>
            {t(
              "Tindakan pemilik · impor prabayar",
              "Owner actions · prepaid import",
            )}
          </summary>
          <PrepaidMigration catererId={catererId} data={data} />
        </details>
      )}
      {owner && (
        <details className="panel customer-owner-tools">
          <summary>
            {t("Biaya & tagihan pilot", "Pilot fees & invoices")}
          </summary>
          <PilotPanel catererId={catererId} />
        </details>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        title={t("Edit pelanggan", "Edit customer")}
      >
        {editing && (
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
          if (!open) changeGuard.close();
        }}
        title={t(
          "Perubahan atas permintaan pelanggan",
          "Customer-requested change",
        )}
      >
        {change && (
          <ActionForm
            key={change.id}
            onDirtyChange={setChangeDirty}
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
            <div className="notice">
              <strong>
                {
                  data.customers.find((customer) =>
                    customer.subscriptions.some((subscription) =>
                      subscription.deliveries.some(
                        (delivery) => delivery.id === change.id,
                      ),
                    ),
                  )?.name
                }
              </strong>
              <p>
                {change.offer.name} · {change.service_date}
              </p>
              <p>
                {change.address.line}, {change.address.area}
              </p>
              <p>
                {t(
                  "Perubahan di bawah menggantikan tanggal atau alamat pengantaran ini setelah berhasil disimpan.",
                  "The change below replaces this delivery's date or address only after it is saved successfully.",
                )}
              </p>
            </div>
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
            <fieldset
              hidden={changeKind !== "date"}
              disabled={changeKind !== "date"}
            >
              <Field label={t("Tanggal baru", "New date")}>
                <DatePicker
                  name="date"
                  defaultValue={addDays(change.service_date, 1)}
                  required
                />
              </Field>
            </fieldset>
            <fieldset
              hidden={changeKind !== "address"}
              disabled={changeKind !== "address"}
            >
              <CustomerAddress value={change.address} />
            </fieldset>
            <Field label={t("Permintaan pelanggan", "Customer request")}>
              <TextArea name="reason" required minLength={5} />
            </Field>
          </ActionForm>
        )}
      </Dialog>
      {changeGuard.confirmation}
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
