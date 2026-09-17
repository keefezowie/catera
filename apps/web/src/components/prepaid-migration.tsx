"use client";
import { useState } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import {
  addDays,
  localDay,
  mealLabel,
  normalizeCustomerPhone,
  type PilotImportPreview,
  type PilotImportRow,
  type SellerCustomersState,
} from "@catera/domain";
import { useApp } from "./context";
import { ActionForm, Dialog, Field } from "./ui";
import { Button, Checkbox, TextInput } from "./form-controls";
import { Select, SelectOption } from "./select";
import { NumericInput } from "./numeric-input";
import { DatePicker } from "./date-picker";

/** One obligation at a time; creating a customer and their bookings is atomic. */
export function PrepaidMigration({
  catererId,
  data,
}: {
  catererId: string;
  data: SellerCustomersState;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="button secondary" onClick={() => setOpen(true)}>
        <Upload size={18} />
        {t("Impor prabayar", "Import prepaid")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Impor langganan prabayar", "Import prepaid subscription")}
      >
        {open && (
          <ImportForm
            catererId={catererId}
            data={data}
            done={() => setOpen(false)}
          />
        )}
      </Dialog>
    </>
  );
}

function ImportForm({
  catererId,
  data,
  done,
}: {
  catererId: string;
  data: SellerCustomersState;
  done: () => void;
}) {
  const { t, locale, perform } = useApp();
  const [customerId, setCustomerId] = useState("");
  const [packageId, setPackageId] = useState(data.packages[0]?.id || "");
  const [draft, setDraft] = useState<PilotImportRow>();
  const [preview, setPreview] = useState<PilotImportPreview>();
  const customer = data.customers.find((c) => c.id === customerId);
  const offer = data.packages.find((p) => p.id === packageId);
  const address =
    draft?.address || draft?.customer?.address || customer?.address;
  if (!data.packages.length)
    return (
      <p className="notice">
        {t(
          "Tayangkan paket setelah verifikasi katerer sebelum mengimpor.",
          "Publish a package after caterer verification before importing.",
        )}
      </p>
    );
  return (
    <>
      <p className="notice">
        {t(
          "Hanya untuk sisa pengantaran yang sudah dibayar di luar Catera. Tidak ada tagihan atau pencairan baru. Pelanggan dapat membuat akun nanti.",
          "Only for remaining deliveries already paid outside Catera. No new charge or payout. Customers can create an account later.",
        )}
      </p>
      {preview ? (
        <ActionForm
          key="confirm"
          submit={t("Konfirmasi impor", "Confirm import")}
          onSubmit={async () => {
            await perform("import.commit", { catererId, id: preview.id });
            done();
          }}
          actions={(submit, busy) => (
            <div className="action-row">
              <Button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setPreview(undefined)}
              >
                <ArrowLeft size={18} />
                {t("Perbaiki data", "Edit data")}
              </Button>
              {submit}
            </div>
          )}
        >
          <p>
            {t(
              "Belum ada pengantaran dipesan. Kapasitas dan batas waktu diperiksa lagi saat konfirmasi.",
              "No deliveries reserved yet. Capacity and cutoff are checked again on confirmation.",
            )}
          </p>
          {preview.rows.map((row, i) => (
            <article className="panel" key={i}>
              <h3>{row.customerName}</h3>
              <p>
                {row.preview.offer.name} ·{" "}
                {mealLabel(row.preview.offer.meal, locale)}
              </p>
              <p>
                {row.portions} {t("porsi", "portions")} ×{" "}
                {row.preview.dates.length}{" "}
                {t("hari pengantaran", "delivery days")}
              </p>
              <p>
                {row.preview.address.line}, {row.preview.address.area},{" "}
                {row.preview.address.city}
              </p>
              <p>
                {t("Tanggal pengantaran", "Delivery dates")}:{" "}
                {row.preview.dates.join(" · ")}
              </p>
              <p>
                {t("Bukti pembayaran", "Payment reference")}:{" "}
                {row.externalReference}
              </p>
            </article>
          ))}
          <label className="checkbox">
            <Checkbox required />
            {t(
              "Saya telah memverifikasi pembayaran dan sisa pengantaran ini.",
              "I have verified this payment and remaining deliveries.",
            )}
          </label>
        </ActionForm>
      ) : (
        <ActionForm
          key={`edit-${customerId}`}
          submit={t("Periksa jadwal", "Review schedule")}
          onSubmit={async (f) => {
            const deliveryAddress = {
              label: "Katering",
              line: String(f.get("line")),
              area: String(f.get("area")),
              city: String(f.get("city")),
              instructions: String(f.get("instructions") || ""),
            };
            const row: PilotImportRow = {
              ...(customer
                ? { customerRecordId: customer.id, address: deliveryAddress }
                : {
                    customer: {
                      name: String(f.get("name")).trim(),
                      phone: normalizeCustomerPhone(String(f.get("phone"))),
                      address: deliveryAddress,
                    },
                  }),
              packageId,
              portions: Number(f.get("portions")),
              remainingDays: Number(f.get("remainingDays")),
              startDate: String(f.get("startDate")),
              externalReference: String(f.get("externalReference")).trim(),
            };
            setDraft(row);
            setPreview(
              await perform<PilotImportPreview>("import.preview", {
                catererId,
                rows: [row],
              }),
            );
          }}
        >
          <Field label={t("Pelanggan", "Customer")}>
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v);
                setDraft(undefined);
              }}
            >
              <SelectOption value="">
                {t(
                  "Pelanggan baru (belum punya akun)",
                  "New customer (no account yet)",
                )}
              </SelectOption>
              {data.customers.map((c) => (
                <SelectOption key={c.id} value={c.id}>
                  {c.name}
                </SelectOption>
              ))}
            </Select>
          </Field>
          {!customer && (
            <div className="form-grid">
              <Field label={t("Nama", "Name")}>
                <TextInput
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={draft?.customer?.name}
                />
              </Field>
              <Field label={t("Nomor WhatsApp", "WhatsApp number")}>
                <TextInput
                  name="phone"
                  type="tel"
                  required
                  placeholder="08…"
                  defaultValue={draft?.customer?.phone}
                />
              </Field>
            </div>
          )}
          <Field label={t("Paket", "Package")}>
            <Select value={packageId} onValueChange={setPackageId}>
              {data.packages.map((p) => (
                <SelectOption key={p.id} value={p.id}>
                  {p.name}
                </SelectOption>
              ))}
            </Select>
          </Field>
          <Field label={t("Alamat pengantaran", "Delivery address")}>
            <TextInput
              name="line"
              required
              minLength={5}
              maxLength={240}
              defaultValue={address?.line}
            />
          </Field>
          <div className="form-grid">
            <Field label={t("Area pengantaran", "Delivery area")}>
              <Select
                name="area"
                required
                key={packageId}
                defaultValue={
                  offer?.areas.includes(address?.area || "")
                    ? address?.area
                    : ""
                }
              >
                <SelectOption value="">
                  {t("Pilih area", "Choose area")}
                </SelectOption>
                {offer?.areas.map((a) => (
                  <SelectOption key={a} value={a}>
                    {a}
                  </SelectOption>
                ))}
              </Select>
            </Field>
            <Field label={t("Kota", "City")}>
              <TextInput
                name="city"
                required
                maxLength={100}
                defaultValue={address?.city}
              />
            </Field>
          </div>
          <Field label={t("Catatan pengantaran", "Delivery notes")}>
            <TextInput
              name="instructions"
              maxLength={400}
              defaultValue={address?.instructions}
            />
          </Field>
          <div className="form-grid">
            <Field label={t("Porsi tetap", "Fixed portions")}>
              <NumericInput
                name="portions"
                min={1}
                max={100}
                required
                defaultValue={draft?.portions || 1}
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
                max={offer?.days || 1}
                required
                defaultValue={draft?.remainingDays || 1}
              />
            </Field>
          </div>
          <Field label={t("Mulai pengantaran", "First delivery")}>
            <DatePicker
              name="startDate"
              required
              defaultValue={
                draft?.startDate ||
                addDays(localDay(new Date(), offer?.timezone), 2)
              }
            />
          </Field>
          <Field
            label={t("Referensi bukti pembayaran", "Payment receipt reference")}
          >
            <TextInput
              name="externalReference"
              required
              minLength={3}
              maxLength={120}
              defaultValue={draft?.externalReference}
            />
          </Field>
        </ActionForm>
      )}
    </>
  );
}
