"use client";
import { useEffect, useState } from "react";
import { Copy, Download, LockKeyhole } from "lucide-react";
import {
  errorLabel,
  type Checkout,
  type DirectPaymentMethod,
} from "@catera/domain";
import { api, useApp } from "./context";
import { Button } from "./form-controls";
import { ErrorNotice } from "./ui";

export function DirectPayment({
  checkout,
  reload,
}: {
  checkout: Checkout;
  reload: () => void;
}) {
  const { t, locale } = useApp();
  const payment = checkout.payment!;
  const [method, setMethod] = useState<DirectPaymentMethod | "">(
    payment.selectedMethod || "",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false),
    [qr, setQr] = useState("");
  const instructions = payment.instructions;
  const content = instructions?.kind === "qris" ? instructions.qrContent : "";
  useEffect(() => {
    let active = true;
    setQr("");
    if (content)
      import("qrcode")
        .then(({ default: QRCode }) =>
          QRCode.toDataURL(content, {
            width: 640,
            margin: 4,
            errorCorrectionLevel: "M",
          }),
        )
        .then((url) => {
          if (active) setQr(url);
        })
        .catch((e) => {
          if (active)
            setError(
              t(
                "Pembayaran belum berhasil disiapkan. Coba lagi atau hubungi bantuan.",
                "Unable to prepare payment. Please try again or contact support.",
              ),
            );
        });
    return () => {
      active = false;
    };
  }, [content]);
  async function start() {
    if (!method) return;
    setBusy(true);
    setError(null);
    try {
      await api.command("checkout.payment.start", { id: checkout.id, method });
      reload();
    } catch (e) {
      setError(
        errorLabel((e as { code?: string }).code || "", locale) ||
          t(
            "Pembayaran belum berhasil disiapkan. Coba lagi atau hubungi bantuan.",
            "Unable to prepare payment. Please try again or contact support.",
          ),
      );
      reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="direct-payment"
      aria-label={t("Metode pembayaran", "Payment method")}
    >
      {error ? <ErrorNotice message={error} /> : null}
      {!payment.selectedMethod ? (
        <>
          <fieldset disabled={busy} className="payment-methods">
            <legend>{t("Pilih cara bayar", "Choose how to pay")}</legend>
            {payment.availableMethods.map((value) => (
              <label className="payment-method" key={value}>
                <input
                  type="radio"
                  name="payment-method"
                  value={value}
                  checked={method === value}
                  onChange={() => setMethod(value)}
                />
                <span>
                  <strong>
                    {value === "QRIS" ? "QRIS" : "BRI Virtual Account"}
                  </strong>
                  <small>
                    {value === "QRIS"
                      ? t(
                          "Bayar dengan aplikasi bank atau dompet digital",
                          "Pay with a banking or wallet app",
                        )
                      : t(
                          "Transfer ke nomor virtual account BRI",
                          "Transfer to a BRI virtual account",
                        )}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          {payment.availableMethods.length ? (
            <Button
              className="button full"
              disabled={
                !method ||
                busy ||
                !payment.availableMethods.includes(
                  method as DirectPaymentMethod,
                )
              }
              onClick={start}
            >
              {busy
                ? t("Menyiapkan pembayaran…", "Preparing payment…")
                : t(
                    "Tampilkan instruksi pembayaran",
                    "Show payment instructions",
                  )}
            </Button>
          ) : (
            <p role="status" className="notice">
              {t(
                "Pembayaran sedang tidak tersedia. Silakan coba lagi nanti.",
                "Payment is currently unavailable. Please try again later.",
              )}
            </p>
          )}
          <p className="small muted">
            {t(
              "Metode tidak dapat diganti setelah instruksi pembayaran diminta.",
              "The method cannot be changed after requesting payment instructions.",
            )}
          </p>
        </>
      ) : (
        <>
          <h2>
            {payment.selectedMethod === "QRIS" ? "QRIS" : "BRI Virtual Account"}
          </h2>
          {instructions?.kind === "virtual_account" ? (
            <>
              <p className="small muted">
                {t("Nomor virtual account", "Virtual account number")}
              </p>
              <div className="payment-account">
                <strong>{instructions.accountNumber}</strong>
                <Button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        instructions.accountNumber,
                      );
                      setCopied(true);
                    } catch (e) {
                      setError(
                        t(
                          "Nomor belum berhasil disalin. Pilih nomor lalu salin secara manual.",
                          "Could not copy the number. Select it and copy manually.",
                        ),
                      );
                    }
                  }}
                >
                  <Copy size={16} />
                  {t("Salin", "Copy")}
                </Button>
              </div>
              <p role="status" className="small">
                {copied
                  ? t("Nomor disalin.", "Number copied.")
                  : instructions.accountName}
              </p>
              <ol className="payment-steps">
                <li>
                  {t(
                    "Buka aplikasi bank atau ATM dan pilih pembayaran BRIVA / BRI Virtual Account.",
                    "Open your banking app or ATM and choose BRIVA / BRI Virtual Account payment.",
                  )}
                </li>
                <li>
                  {t(
                    "Masukkan nomor virtual account di atas.",
                    "Enter the virtual account number above.",
                  )}
                </li>
                <li>
                  {t(
                    "Periksa nama penerima dan pastikan jumlahnya sama dengan total pesanan sebelum membayar.",
                    "Check the recipient name and confirm the amount matches your order total before paying.",
                  )}
                </li>
                <li>
                  {t(
                    "Kembali ke Catera untuk melihat konfirmasi pembayaran.",
                    "Return to Catera to see your payment confirmation.",
                  )}
                </li>
              </ol>
            </>
          ) : instructions?.kind === "qris" ? (
            <>
              {qr ? (
                <div className="payment-qr">
                  <img
                    src={qr}
                    width={320}
                    height={320}
                    alt={t(
                      "Kode QRIS untuk pembayaran pesanan ini",
                      "QRIS code for this order",
                    )}
                  />
                  <a
                    className="button secondary"
                    href={qr}
                    download={`catera-qris-${checkout.id}.png`}
                  >
                    <Download size={16} />
                    {t("Unduh QRIS", "Download QRIS")}
                  </a>
                </div>
              ) : (
                <p role="status">
                  {t("Menyiapkan kode QRIS…", "Preparing QRIS code…")}
                </p>
              )}
              <p>
                {t(
                  "Pindai kode dengan aplikasi bank atau dompet digital di perangkat lain. Di ponsel yang sama, unduh kode lalu gunakan fitur unggah QR jika aplikasi pembayaran mendukungnya.",
                  "Scan with a banking or wallet app on another device. On the same phone, download the code and use your payment app’s QR upload feature if supported.",
                )}
              </p>
              <p>
                {t(
                  "Periksa nama penerima dan jumlah pembayaran, lalu kembali ke Catera setelah membayar.",
                  "Check the recipient and payment amount, then return to Catera after paying.",
                )}
              </p>
            </>
          ) : (
            <div role="status" className="notice">
              {payment.status === "preparing"
                ? t(
                    "Pembayaran belum dikirim. Lanjutkan untuk menyiapkan instruksi.",
                    "Payment has not been submitted. Continue to prepare instructions.",
                  )
                : payment.status === "failed"
                  ? t(
                      "Pembayaran gagal disiapkan. Hubungi bantuan sebelum mencoba pembayaran lain.",
                      "Payment preparation failed. Contact support before trying another payment.",
                    )
                  : t(
                      "Kami sedang memeriksa pembayaran. Jangan membuat pembayaran lain; halaman ini diperbarui otomatis.",
                      "We are checking your payment. Do not create another payment; this page updates automatically.",
                    )}
              {payment.status === "preparing" && (
                <Button className="button" disabled={busy} onClick={start}>
                  {t("Lanjutkan", "Continue")}
                </Button>
              )}
            </div>
          )}
          <p className="small muted">
            <LockKeyhole size={14} aria-hidden="true" />{" "}
            {t(
              "Status diperbarui setelah pembayaran diverifikasi.",
              "Status updates after payment is verified.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
