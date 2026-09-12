"use client";
import { useState } from "react";
import { Plus, Trash2, ClipboardCheck, ArrowLeft, Check } from "lucide-react";
import {
  addDays,
  localDay,
  mealLabel,
  type SellerImportOptions,
  type PrepaidImportRow,
  type PrepaidImportPreview,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, Field, Loading, ErrorNotice, Empty } from "./ui";
import { Button, Checkbox, TextInput } from "./form-controls";
import { Select, SelectOption } from "./select";
import { NumericInput } from "./numeric-input";
import { DatePicker } from "./date-picker";

type Draft = PrepaidImportRow & { key: string };
const newRow = (): Draft => ({
  key: crypto.randomUUID(),
  customerId: "",
  packageId: "",
  addressId: "",
  portions: 1,
  startDate: addDays(localDay(), 2),
  remainingDays: 1,
  externalReference: "",
});
export function PrepaidImport({
  catererId,
  done,
  onBusyChange,
}: {
  catererId: string;
  done: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t, perform, locale } = useApp();
  const options = useResource<SellerImportOptions>(
    "import-options:" + catererId,
    () => api.sellerImportOptions(catererId),
  );
  const [rows, setRows] = useState<Draft[]>(() => [newRow()]);
  const [preview, setPreview] = useState<PrepaidImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const update = (key: string, change: Partial<Draft>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
    setPreview(null);
  };
  if (options.error)
    return <ErrorNotice message={options.error} retry={options.reload} />;
  if (!options.data) return <Loading />;
  const choices = options.data;
  if (!choices.customers.length)
    return (
      <Empty
        title={t("Belum ada pelanggan terhubung", "No connected customers yet")}
        description={t(
          "Pelanggan perlu memiliki akun Catera dan terhubung ke katerer ini melalui undangan atau pembelian sebelum dapat dipilih.",
          "Customers need a Catera account connected to this caterer through an invitation or purchase before they can be selected.",
        )}
      />
    );
  if (!choices.packages.length)
    return (
      <Empty
        title={t("Terbitkan paket terlebih dahulu", "Publish a package first")}
        description={t(
          "Impor membutuhkan katerer yang sudah disetujui dan paket yang sedang dijual.",
          "Imports require an approved caterer and a published package.",
        )}
      />
    );
  return (
    <ActionForm
      submit={
        preview
          ? t("Konfirmasi impor", "Confirm import")
          : t("Periksa langganan", "Review subscriptions")
      }
      submitIcon={preview ? <Check size={18} /> : <ClipboardCheck size={18} />}
      onSubmit={async () => {
        setBusy(true);
        onBusyChange(true);
        try {
          if (preview) {
            await perform("import.commit", { catererId, id: preview.id });
            done();
          } else {
            setAttempted(true);
            const incomplete = rows.findIndex(
              (r) => !r.customerId || !r.packageId || !r.addressId,
            );
            if (incomplete >= 0) {
              document
                .querySelector<HTMLButtonElement>(
                  `[data-import-row="${rows[incomplete].key}"] [data-missing="true"] button`,
                )
                ?.focus();
              throw new Error("INVALID_INPUT");
            }
            setPreview(
              await perform<PrepaidImportPreview>("import.preview", {
                catererId,
                rows: rows.map(({ key, ...row }) => row),
              }),
            );
          }
        } finally {
          setBusy(false);
          onBusyChange(false);
        }
      }}
    >
      <p className="notice">
        {t(
          "Untuk langganan yang sudah dibayar di luar Catera. Tidak ada pembayaran baru yang ditagih.",
          "For subscriptions already paid outside Catera. No new payment will be charged.",
        )}
      </p>
      {preview ? (
        <>
          <p role="status">
            {t(
              `${preview.rows.length} langganan siap diperiksa. Tanggal dan kapasitas diperiksa lagi saat konfirmasi.`,
              `${preview.rows.length} subscriptions ready for review. Dates and capacity are checked again on confirmation.`,
            )}
          </p>
          <div className="import-preview">
            {preview.rows.map((r, index) => (
              <article key={index}>
                <h3>
                  {choices.customers.find((c) => c.id === r.customerId)?.name} ·{" "}
                  {r.preview.offer.name}
                </h3>
                <p>
                  {r.portions} {t("porsi", "portions")} ×{" "}
                  {r.preview.dates.length} {t("hari", "days")} ·{" "}
                  {mealLabel(r.preview.offer.meal, locale)}
                </p>
                <p>
                  {r.preview.address.label} · {r.preview.address.line},{" "}
                  {r.preview.address.area}
                </p>
                <p>
                  {t("Tanggal pengantaran", "Delivery dates")}:{" "}
                  {r.preview.dates
                    .map((d) =>
                      new Date(d + "T12:00:00Z").toLocaleDateString(
                        locale === "id" ? "id-ID" : "en-GB",
                        { day: "numeric", month: "short", timeZone: "UTC" },
                      ),
                    )
                    .join(", ")}
                </p>
                <small>
                  {t("Bukti pembayaran", "Payment reference")}:{" "}
                  {r.externalReference}
                </small>
              </article>
            ))}
          </div>
          <Button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            <ArrowLeft size={18} />
            {t("Perbaiki data", "Edit data")}
          </Button>
          <label className="checkbox">
            <Checkbox required />
            {t(
              "Saya telah memverifikasi pembayaran dan hak pengantaran ini.",
              "I have verified this payment and delivery entitlement.",
            )}
          </label>
        </>
      ) : (
        <>
          {rows.map((row, index) => {
            const customer = choices.customers.find(
              (c) => c.id === row.customerId,
            );
            const offer = choices.packages.find((p) => p.id === row.packageId);
            const addresses =
              customer?.addresses.filter(
                (a) => !offer || offer.areas.includes(a.area),
              ) || [];
            return (
              <fieldset
                className="import-row"
                key={row.key}
                data-import-row={row.key}
                disabled={busy}
              >
                <legend>
                  {t("Langganan", "Subscription")} {index + 1}
                </legend>
                <div className="form-grid">
                  <div data-missing={!row.customerId}>
                    <Field
                      label={t("Pelanggan", "Customer")}
                      error={
                        attempted && !row.customerId
                          ? t(
                              "Pilih sebelum melanjutkan.",
                              "Choose before continuing.",
                            )
                          : undefined
                      }
                    >
                      <Select
                        value={row.customerId}
                        onValueChange={(customerId) =>
                          update(row.key, { customerId, addressId: "" })
                        }
                      >
                        <SelectOption value="">
                          {t("Pilih pelanggan", "Choose customer")}
                        </SelectOption>
                        {choices.customers.map((c) => (
                          <SelectOption key={c.id} value={c.id}>
                            {c.name}
                          </SelectOption>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div data-missing={!row.packageId}>
                    <Field
                      label={t("Paket", "Package")}
                      error={
                        attempted && !row.packageId
                          ? t(
                              "Pilih sebelum melanjutkan.",
                              "Choose before continuing.",
                            )
                          : undefined
                      }
                    >
                      <Select
                        value={row.packageId}
                        onValueChange={(packageId) =>
                          update(row.key, {
                            packageId,
                            addressId: "",
                            remainingDays: 1,
                          })
                        }
                      >
                        <SelectOption value="">
                          {t("Pilih paket", "Choose package")}
                        </SelectOption>
                        {choices.packages.map((p) => (
                          <SelectOption key={p.id} value={p.id}>
                            {p.name}
                          </SelectOption>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
                <div data-missing={!row.addressId}>
                  <Field
                    label={t("Alamat pengantaran", "Delivery address")}
                    error={
                      attempted && !row.addressId
                        ? t(
                            "Pilih sebelum melanjutkan.",
                            "Choose before continuing.",
                          )
                        : undefined
                    }
                  >
                    <Select
                      value={row.addressId}
                      disabled={!customer || !addresses.length}
                      onValueChange={(addressId) =>
                        update(row.key, { addressId })
                      }
                    >
                      <SelectOption value="">
                        {t("Pilih alamat", "Choose address")}
                      </SelectOption>
                      {addresses.map((a) => (
                        <SelectOption key={a.id} value={a.id}>
                          {a.label} · {a.line}, {a.area}
                        </SelectOption>
                      ))}
                    </Select>
                  </Field>
                </div>
                {customer && !addresses.length && (
                  <p className="notice">
                    {customer.addresses.length
                      ? t(
                          "Belum ada alamat di area paket ini. Pilih paket lain atau minta pelanggan menambah alamat yang terjangkau.",
                          "No address is in this package's delivery area. Choose another package or ask the customer to add an address in the delivery area.",
                        )
                      : t(
                          "Pelanggan ini belum menyimpan alamat. Minta pelanggan menambah alamat di Akun → Alamat sebelum mengimpor.",
                          "This customer has no saved address. Ask them to add one in Account → Addresses before importing.",
                        )}
                  </p>
                )}
                <div className="form-grid">
                  <Field label={t("Porsi per hari", "Portions per day")}>
                    <NumericInput
                      required
                      min={1}
                      max={100}
                      value={row.portions}
                      onValueChange={(v) =>
                        update(row.key, { portions: Number(v) })
                      }
                    />
                  </Field>
                  <Field
                    label={t(
                      "Sisa hari yang sudah dibayar",
                      "Remaining prepaid days",
                    )}
                  >
                    <NumericInput
                      required
                      min={1}
                      max={offer?.days || 365}
                      value={row.remainingDays}
                      onValueChange={(v) =>
                        update(row.key, { remainingDays: Number(v) })
                      }
                    />
                  </Field>
                  <Field label={t("Mulai pengantaran", "First delivery")}>
                    <DatePicker
                      required
                      value={row.startDate}
                      min={localDay()}
                      onValueChange={(startDate) =>
                        update(row.key, { startDate })
                      }
                    />
                  </Field>
                  <Field
                    label={t("Nomor bukti pembayaran", "Payment reference")}
                  >
                    <TextInput
                      required
                      minLength={3}
                      maxLength={160}
                      value={row.externalReference}
                      placeholder={t(
                        "Contoh: Kuitansi-123",
                        "Example: Receipt-123",
                      )}
                      onChange={(e) =>
                        update(row.key, { externalReference: e.target.value })
                      }
                    />
                  </Field>
                </div>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    className="text-button"
                    aria-label={t(
                      `Hapus langganan ${index + 1}`,
                      `Remove subscription ${index + 1}`,
                    )}
                    onClick={() =>
                      setRows((all) => all.filter((r) => r.key !== row.key))
                    }
                  >
                    <Trash2 size={18} />
                    {t("Hapus baris", "Remove row")}
                  </Button>
                )}
              </fieldset>
            );
          })}
          <Button
            type="button"
            className="button secondary"
            disabled={busy || rows.length >= 100}
            onClick={() => setRows((all) => [...all, newRow()])}
          >
            <Plus size={18} />
            {t("Tambah langganan", "Add subscription")} ({rows.length}/100)
          </Button>
        </>
      )}
    </ActionForm>
  );
}
