"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizeCustomerPhone, durationOptions } from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, ErrorNotice, Field, Heading, Loading } from "./ui";
import { TextInput } from "./form-controls";
import { Select, SelectOption } from "./select";
export function ClaimCustomer({ token }: { token: string }) {
  const { t, perform } = useApp();
  const [sent, setSent] = useState(false),
    [verified, setVerified] = useState(false),
    [phone, setPhone] = useState(""),
    [result, setResult] = useState("");
  return (
    <section className="panel narrow">
      <Heading
        title={t(
          "Hubungkan langganan katering",
          "Connect your catering subscription",
        )}
        description={t(
          "Gunakan nomor yang tercatat pada katerer. Pengantaran tetap berjalan selama proses ini.",
          "Use the phone number recorded by your caterer. Deliveries continue during this process.",
        )}
      />
      {!result && (
        <>
          <details>
            <summary>
              {t(
                "Tambahkan / verifikasi nomor pada akun ini",
                "Add / verify a phone on this account",
              )}
            </summary>
            <ActionForm
              submit={
                sent
                  ? t("Verifikasi nomor", "Verify phone")
                  : t("Kirim kode verifikasi", "Send verification code")
              }
              onSubmit={async (f) => {
                const normalized = normalizeCustomerPhone(phone);
                await api.request(
                  "auth/" + (sent ? "phone-verify" : "phone-send"),
                  {
                    phone: normalized,
                    ...(sent ? { token: f.get("code") } : {}),
                  },
                );
                setSent(true);
                if (sent) setVerified(true);
              }}
            >
              <Field label={t("Nomor telepon", "Phone number")}>
                <TextInput
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setSent(false);
                    setVerified(false);
                  }}
                  required
                />
              </Field>
              {sent && (
                <Field label={t("Kode verifikasi", "Verification code")}>
                  <TextInput
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                  />
                </Field>
              )}
            </ActionForm>
            {verified && <p>{t("Nomor terverifikasi.", "Phone verified.")}</p>}
          </details>
          <ActionForm
            submit={t("Hubungkan langganan", "Connect subscription")}
            onSubmit={async () => {
              const r = await perform<{ status: string }>("customer.claim", {
                token,
              });
              setResult(r.status);
            }}
          >
            <p>
              {t(
                "Dengan melanjutkan, jadwal dan alamat dari katerer ini ditautkan ke akun terverifikasi Anda.",
                "Continuing links this caterer’s schedules and address to your verified account.",
              )}
            </p>
          </ActionForm>
        </>
      )}
      {result === "claimed" && (
        <>
          <p>
            {t("Langganan sudah terhubung.", "Your subscription is connected.")}
          </p>
          <Link className="button" href="/home">
            {t("Lihat jadwal saya", "View my schedule")}
          </Link>
        </>
      )}
      {result === "review" && (
        <p role="status">
          {t(
            "Ada data kepemilikan atau jadwal yang perlu ditinjau. Hubungi katerer; pengantaran Anda tetap tersimpan.",
            "Ownership or schedule information needs review. Contact your caterer; your deliveries remain saved.",
          )}
        </p>
      )}
    </section>
  );
}
export function RenewCustomer({ id }: { id: string }) {
  const { t, perform } = useApp(),
    params = useSearchParams();
  const [replacement, setReplacement] = useState(params.get("packageId") || "");
  const [cycles, setCycles] = useState(1);
  const state = useResource(
    "renewal:" + id + ":" + replacement + ":" + cycles,
    () => api.renewalContext(id, replacement || undefined, cycles),
  );
  const [ready, setReady] = useState("");
  useEffect(() => setReady(""), [cycles, replacement]);
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const r = state.data;
  return (
    <section className="panel narrow">
      <Heading
        title={t("Siapkan paket berikutnya", "Prepare your next package")}
        description={t(
          "Porsi dan alamat sebelumnya sudah disiapkan. Harga dan ketentuan terbaru ditinjau sebelum pembayaran.",
          "Your previous portions and address are prepared. Review current prices and terms before payment.",
        )}
      />
      {r.replacementRequired && (
        <p className="notice">
          {t(
            "Paket lama tidak dijual. Pilih pengganti dari katerer ini.",
            "Your previous package is unavailable. Choose a replacement from this caterer.",
          )}
        </p>
      )}
      <Field label={t("Paket berikutnya", "Next package")}>
        <Select
          value={replacement || (!r.replacementRequired ? r.packageId : "")}
          onValueChange={(v) => {
            setReplacement(v);
            setCycles(1);
            setReady("");
          }}
        >
          <SelectOption value="">
            {t("Pilih paket", "Choose package")}
          </SelectOption>
          {r.offers.map((p) => (
            <SelectOption key={p.id} value={p.id}>
              {p.name}
            </SelectOption>
          ))}
        </Select>
      </Field>
      {r.offers.find((o) => o.id === r.packageId) && (
        <Field label={t("Durasi paket", "Package duration")}>
          <Select
            value={String(cycles)}
            onValueChange={(v) => setCycles(Number(v))}
          >
            {durationOptions(r.offers.find((o) => o.id === r.packageId)!).map(
              (o) => (
                <SelectOption key={o.cycles} value={String(o.cycles)}>
                  {o.cycles} {t("periode", "cycles")}
                  {o.discountPercent ? ` · −${o.discountPercent}%` : ""}
                </SelectOption>
              ),
            )}
          </Select>
        </Field>
      )}
      {r.pendingCheckoutId && (
        <Link className="button" href={"/payment/" + r.pendingCheckoutId}>
          {t("Lanjutkan pembayaran yang tertunda", "Continue pending payment")}
        </Link>
      )}
      <p>
        {r.portions} {t("porsi", "portions")} · {t("Mulai", "Starts")}{" "}
        {r.startDate}
      </p>
      <p>
        {r.address?.line} · {r.address?.area}
      </p>
      {!r.available && (
        <p role="status">
          {t(
            "Belum ada jadwal lengkap yang tersedia. Pilih paket lain atau hubungi katerer.",
            "No complete schedule is available. Choose another package or contact the caterer.",
          )}
        </p>
      )}
      <ActionForm
        disabled={r.replacementRequired || !r.available}
        submit={t(
          "Gunakan alamat & tinjau pembelian",
          "Use address & review purchase",
        )}
        onSubmit={async () => {
          const addressId =
            r.addressId ||
            (
              await perform<{ id: string }>("address.save", {
                label: r.address.label || "Katering",
                line: r.address.line,
                area: r.address.area,
                city: r.address.city,
                instructions: r.address.instructions || "",
              })
            ).id;
          setReady(
            "/checkout/" +
              r.packageId +
              "?" +
              new URLSearchParams({
                renewedFrom: r.subscriptionId,
                cycles: String(cycles),
                portions: String(r.portions),
                startDate: r.startDate,
                addressId,
              }),
          );
        }}
      >
        <p>
          {t(
            "Tidak ada pembayaran otomatis.",
            "There is no automatic payment.",
          )}
        </p>
      </ActionForm>
      {ready && (
        <Link className="button" href={ready}>
          {t("Lanjutkan ke pembayaran", "Continue to checkout")}
        </Link>
      )}
    </section>
  );
}
