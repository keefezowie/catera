"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import {
  currency,
  dayLabel,
  durationOptions,
  jakartaDay,
  localCustomerPhone,
  normalizeCustomerPhone,
  phoneMatchesMask,
  purchaseCommitment,
  shortDate,
  upcomingRows,
  type ClaimPreview,
  type UpcomingRow,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, ErrorNotice, Facts, Field, Heading, Loading } from "./ui";
import { Button, TextInput } from "./form-controls";
import { Select, SelectOption } from "./select";
/** Failures worth retrying; any other code means this claim link cannot be used. */
const TRANSIENT = [
  "REQUEST_TIMEOUT",
  "REQUEST_FAILED",
  "INVALID_API_RESPONSE",
  "AUTH_RATE_LIMITED",
  "RATE_LIMITED",
  "NOT_CONFIGURED",
];
const failureCode = (e: unknown) => (e as { code?: string }).code || "";
const transient = (e: unknown) =>
  !failureCode(e) || TRANSIENT.includes(failureCode(e));
type ClaimStage = "lihat" | "nomor" | "kode" | "selesai" | "tinjau";
/** A caterer's claim link, web first: the package before any phone number, then the
 * SMS code, then the next days and the app. Anyone holding the link sees the preview;
 * nothing from it is shown once the link turns out to be unusable. */
export function ClaimCustomer({ token }: { token: string }) {
  const { t, perform, actor, locale } = useApp();
  const [preview, setPreview] = useState<ClaimPreview | null>(null),
    [failure, setFailure] = useState<"" | "dead" | "offline">(""),
    [attempt, setAttempt] = useState(0),
    [stage, setStage] = useState<ClaimStage>("lihat"),
    [phone, setPhone] = useState(""),
    [sentTo, setSentTo] = useState(""),
    [codeError, setCodeError] = useState(""),
    [who, setWho] = useState(""),
    [days, setDays] = useState<UpcomingRow[]>([]);
  // A used SMS code cannot be verified twice: a retry after a dropped claim skips it.
  const verified = useRef("");
  // Read once per token: after the claim the same token answers NOT_FOUND.
  useEffect(() => {
    let live = true;
    setFailure("");
    api
      .claimPreview(token)
      .then((p) => live && setPreview(p))
      .catch((e) => live && setFailure(transient(e) ? "offline" : "dead"));
    return () => {
      live = false;
    };
  }, [token, attempt]);
  if (failure === "dead")
    return (
      <section className="claim narrow">
        <p className="notice" role="alert">
          {t(
            "Tautan ini tidak bisa dipakai. Minta tautan baru ke katering Anda.",
            "This link can’t be used. Ask your caterer for a new one.",
          )}
        </p>
      </section>
    );
  if (failure === "offline")
    return (
      <section className="claim narrow">
        <ErrorNotice
          message={t(
            "Belum bisa memuat. Periksa koneksi lalu coba lagi.",
            "Couldn’t load. Check your connection and try again.",
          )}
          retry={() => setAttempt((n) => n + 1)}
        />
      </section>
    );
  if (!preview) return <Loading />;
  const katering = preview.catererName;
  async function claim(name: string) {
    let result: { status?: string };
    try {
      result = await perform<{ status?: string }>("customer.claim", { token });
    } catch (e) {
      // A signed-in account without a verified phone verifies it first.
      if (stage === "lihat" && failureCode(e) === "PHONE_VERIFICATION_REQUIRED")
        return setStage("nomor");
      if (transient(e)) throw e;
      return setFailure("dead");
    }
    if (result.status === "review") return setStage("tinjau");
    setWho(name.trim().split(/\s+/)[0] || "");
    try {
      setDays(upcomingRows(await api.customer(), new Date(), 3));
    } catch {
      setDays([]);
    }
    setStage("selesai");
  }
  if (stage === "tinjau")
    return (
      <section className="claim narrow">
        <div className="notice" role="status">
          <CircleAlert size={20} aria-hidden="true" />
          <p>
            {t(
              `${katering} perlu memeriksa langganan ini dulu. Pengantaran Anda tetap berjalan.`,
              `${katering} needs to check this subscription first. Your deliveries continue.`,
            )}
          </p>
        </div>
      </section>
    );
  if (stage === "selesai") {
    const store = process.env.NEXT_PUBLIC_CATERA_ANDROID_URL;
    const today = jakartaDay(new Date());
    return (
      <section className="claim narrow">
        <div className="claim-done">
          <span className="claim-check" aria-hidden="true">
            <Check size={26} strokeWidth={2.4} />
          </span>
          <div>
            <h1>{who ? t(`Tersambung, ${who}`, `Connected, ${who}`) : t("Tersambung", "Connected")}</h1>
            <span>
              {t(
                `${preview.packageName}, sisa ${preview.remainingDays} hari`,
                `${preview.packageName}, ${preview.remainingDays} days left`,
              )}
            </span>
          </div>
        </div>
        {days.length > 0 && (
          <ul className="claim-days" aria-label={t("Hari berikutnya", "Coming days")}>
            {days.map((row) => (
              <li key={row.deliveryId}>
                <strong>
                  {locale === "id" ? row.label : dayLabel(row.date, today, "en")}
                </strong>
                <span>
                  {row.dishes ||
                    t(`Menu belum diisi ${katering}`, `${katering} hasn’t set the menu yet`)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {store && (
          <section className="claim-app" aria-label={t("Aplikasi Catera", "Catera app")}>
            <div>
              <img src="/assets/app-icon.png" alt="" width={52} height={52} />
              <p>
                <strong>{t("Tahu saat makanan berangkat", "Know when your food leaves")}</strong>
                {t(
                  "Aplikasi Catera memberi notifikasi saat diantar. Masuk dengan nomor yang sama.",
                  "The Catera app notifies you when it’s on the way. Sign in with the same number.",
                )}
              </p>
            </div>
            <a className="button" href={store}>
              {t("Pasang aplikasi", "Install the app")}
            </a>
          </section>
        )}
        {/* A full load, so the page header picks up the session the code just started. */}
        <a className="claim-browser" href="/home">
          {t("Lihat jadwal di browser saja", "Just view the schedule in the browser")}
        </a>
      </section>
    );
  }
  if (stage === "nomor" || stage === "kode") {
    const sent = stage === "kode";
    return (
      <section className="claim narrow">
        <div className="claim-intro">
          <h1>
            {sent
              ? t("Masukkan kode dari SMS", "Enter the code from the SMS")
              : t("Nomor HP Anda", "Your phone number")}
          </h1>
          <p>
            {sent
              ? t(
                  `Kami kirim 6 angka ke ${localCustomerPhone(sentTo)}, nomor yang dicatat ${katering}.`,
                  `We sent 6 digits to ${localCustomerPhone(sentTo)}, the number ${katering} recorded.`,
                )
              : t(
                  `Tulis nomor yang dicatat ${katering} (${preview.maskedPhone}). Kami kirim kode lewat SMS.`,
                  `Enter the number ${katering} recorded (${preview.maskedPhone}). We’ll text you a code.`,
                )}
          </p>
        </div>
        {!sent ? (
          <ActionForm
            key="nomor"
            submit={t("Kirim kode", "Send code")}
            validate={() => {
              let normalized: string;
              try {
                normalized = normalizeCustomerPhone(phone);
              } catch {
                return t(
                  "Tulis nomor HP yang benar, misalnya 0812 3456 7890.",
                  "Enter a valid phone number, for example 0812 3456 7890.",
                );
              }
              // Another number could never claim this link: say so before any SMS
              // (or, signed out, any new account) instead of failing at the end.
              if (!phoneMatchesMask(normalized, preview.maskedPhone))
                return t(
                  `Nomor ini berbeda dengan yang dicatat ${katering}. Pakai nomor yang Anda berikan ke ${katering}, atau minta ${katering} memperbarui nomor Anda.`,
                  `This number differs from the one ${katering} has. Use the number you gave ${katering}, or ask ${katering} to update it.`,
                );
            }}
            onSubmit={async () => {
              const normalized = normalizeCustomerPhone(phone);
              // Signed in: verify the number on this account. Otherwise the code signs in.
              if (actor)
                await api.request("auth/phone-send", { phone: normalized });
              else
                await api.request("auth/send", {
                  phone: normalized,
                  intent: "claim",
                });
              setSentTo(normalized);
              setCodeError("");
              setStage("kode");
            }}
          >
            <Field label={t("Nomor HP", "Phone number")}>
              <TextInput
                type="tel"
                autoComplete="tel"
                placeholder="0812…"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </Field>
          </ActionForm>
        ) : (
          <ActionForm
            key="kode"
            submit={t("Sambungkan langganan", "Connect subscription")}
            actions={(submitButton) => (
              <div className="claim-actions">
                {submitButton}
                <p className="claim-hint">
                  {t(
                    "Dengan melanjutkan, Anda setuju dengan Ketentuan dan Kebijakan Privasi Catera.",
                    "By continuing, you agree to Catera’s Terms and Privacy Policy.",
                  )}
                </p>
              </div>
            )}
            onSubmit={async (f) => {
              const name = String(f.get("name") || "").trim();
              if (verified.current !== sentTo) {
                try {
                  if (actor)
                    await api.request("auth/phone-verify", {
                      phone: sentTo,
                      token: f.get("code"),
                    });
                  else
                    await api.request("auth/verify", {
                      phone: sentTo,
                      token: f.get("code"),
                      name,
                    });
                } catch (e) {
                  if (transient(e)) throw e;
                  setCodeError(
                    t(
                      "Kode belum cocok. Periksa SMS lalu coba lagi.",
                      "That code doesn’t match. Check the SMS and try again.",
                    ),
                  );
                  return;
                }
                verified.current = sentTo;
              }
              await claim(actor ? actor.name : name);
            }}
          >
            <Field label={t("Kode", "Code")} error={codeError}>
              <TextInput
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
                onChange={() => setCodeError("")}
              />
            </Field>
            {!actor && (
              <Field label={t("Nama Anda", "Your name")}>
                <TextInput
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </Field>
            )}
          </ActionForm>
        )}
        <Button
          type="button"
          variant="text"
          onClick={() => setStage(sent ? "nomor" : "lihat")}
        >
          {sent
            ? t("Ganti nomor", "Change number")
            : t("Kembali", "Back")}
        </Button>
      </section>
    );
  }
  return (
    <section className="claim narrow">
      <div className="claim-intro">
        <p className="claim-from">{t(`Dari ${katering}`, `From ${katering}`)}</p>
        <h1>
          {t(
            "Langganan Anda sekarang ada di Catera",
            "Your subscription is now on Catera",
          )}
        </h1>
        <p>
          {t(
            `Sudah dibayar ke ${katering}, tidak ada tagihan baru. Di sini Anda bisa melihat menu, tahu kapan makanan berangkat, dan memindah hari.`,
            `Already paid to ${katering}, no new bill. Here you can see the menu, know when your food leaves, and move days.`,
          )}
        </p>
      </div>
      <section className="claim-card" aria-label={t("Paket Anda", "Your package")}>
        <strong>{preview.packageName}</strong>
        <dl>
          <dt>{t("Sisa", "Left")}</dt>
          <dd>
            {t(`${preview.remainingDays} hari`, `${preview.remainingDays} days`)}
          </dd>
          {preview.nextDate && (
            <>
              <dt>{t("Berikutnya", "Next")}</dt>
              <dd>
                {shortDate(preview.nextDate, locale) +
                  (preview.nextWindow ? `, ${preview.nextWindow}` : "")}
              </dd>
            </>
          )}
          <dt>{t("Alamat", "Address")}</dt>
          <dd>{preview.addressLabel}</dd>
        </dl>
      </section>
      <ActionForm
        submit={t(
          `Lanjut dengan ${preview.maskedPhone}`,
          `Continue with ${preview.maskedPhone}`,
        )}
        submitIcon={<ArrowRight size={17} aria-hidden="true" />}
        actions={(submitButton) => (
          <div className="claim-actions">
            {submitButton}
            <p className="claim-hint">
              {t(
                `Bukan nomor Anda? Minta ${katering} mengirim tautan baru.`,
                `Not your number? Ask ${katering} to send a new link.`,
              )}
            </p>
          </div>
        )}
        onSubmit={async () => {
          // A signed-in account whose phone is already verified connects right away.
          if (actor) await claim(actor.name);
          else setStage("nomor");
        }}
      >
        {null}
      </ActionForm>
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
