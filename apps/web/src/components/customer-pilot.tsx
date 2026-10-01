"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import {
  currency,
  durationOptions,
  normalizeCustomerPhone,
  purchaseCommitment,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, ErrorNotice, Facts, Field, Heading, Loading } from "./ui";
import { TextInput } from "./form-controls";
import { Select, SelectOption } from "./select";
import { Disclosure } from "./disclosure";
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
          <Disclosure
            title={t(
              "Tambahkan / verifikasi nomor pada akun ini",
              "Add / verify a phone on this account",
            )}
          >
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
            {verified && (
              <p className="save-status" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                {t("Nomor terverifikasi.", "Phone verified.")}
              </p>
            )}
          </Disclosure>
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
          <div className="notice" role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            <p>
              {t(
                "Langganan sudah terhubung.",
                "Your subscription is connected.",
              )}
            </p>
          </div>
          <Link className="button" href="/home">
            {t("Lihat jadwal saya", "View my schedule")}
          </Link>
        </>
      )}
      {result === "review" && (
        <div className="notice" role="status">
          <CircleAlert size={20} aria-hidden="true" />
          <p>
            {t(
              "Ada data kepemilikan atau jadwal yang perlu ditinjau. Hubungi katerer; pengantaran Anda tetap tersimpan.",
              "Ownership or schedule information needs review. Contact your caterer; your deliveries remain saved.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
export function RenewCustomer({ id }: { id: string }) {
  const { t, perform, locale } = useApp(),
    params = useSearchParams();
  const [replacement, setReplacement] = useState(params.get("packageId") || "");
  const [cycles, setCycles] = useState(1);
  const state = useResource(
    "renewal:" + id + ":" + replacement + ":" + cycles,
    () => api.renewalContext(id, replacement || undefined, cycles),
  );
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const r = state.data;
  const selectedOffer = r.offers.find((offer) => offer.id === r.packageId);
  const commitment = selectedOffer
    ? purchaseCommitment({
        offer: selectedOffer,
        portions: r.portions,
        cycles,
        addressCovered: selectedOffer.areas.includes(r.address.area),
      })
    : null;
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
                  {o.cycles} {t("periode", o.cycles === 1 ? "cycle" : "cycles")}
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
      <Facts
        rows={[
          [t("Porsi per waktu makan", "Portions per meal"), String(r.portions)],
          [
            t("Mulai", "Starts"),
            new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(r.startDate + "T12:00:00Z")),
          ],
          [
            t("Alamat pengantaran", "Delivery address"),
            `${r.address?.line} · ${r.address?.area}`,
          ],
        ]}
      />
      {commitment && (
        <Facts
          rows={[
            [
              t("Hari pengantaran", "Delivery days"),
              String(commitment.deliveryDays),
            ],
            [
              t("Harga paket", "Package price"),
              currency(commitment.packagePrice, locale),
            ],
            [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
            [
              t("Perpanjangan", "Renewal"),
              t("Manual · dibayar di awal", "Manual · paid upfront"),
            ],
          ]}
        />
      )}
      {!r.available && (
        <p className="notice" role="status">
          {t(
            "Belum ada jadwal lengkap yang tersedia. Pilih paket lain atau hubungi katerer.",
            "No complete schedule is available. Choose another package or contact the caterer.",
          )}
        </p>
      )}
      <ActionForm
        disabled={navigating || r.replacementRequired || !r.available}
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
          startNavigation(() =>
            router.push(
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
            ),
          );
        }}
      >
        <p className="small muted">
          {t(
            "Tidak ada pembayaran otomatis.",
            "There is no automatic payment.",
          )}
        </p>
      </ActionForm>
    </section>
  );
}
