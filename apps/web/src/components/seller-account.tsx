"use client";
import { useState } from "react";
import Link from "next/link";
import { Landmark, LifeBuoy, LogOut, ShieldCheck } from "lucide-react";
import {
  settlementCurrency,
  type PayoutSetup,
  type PayoutDestination,
  type AccountRequest,
  type SellerState,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, Dialog, ErrorNotice, Field, Loading, Status } from "./ui";
import { Button, TextInput, TextArea, Checkbox } from "./form-controls";
import { Select, SelectOption } from "./select";
import { LocaleSwitch } from "./locale-switch";
import "./seller-experience.css";

export function PayoutSetupCard({
  catererId,
  editable = false,
}: {
  catererId: string;
  editable?: boolean;
}) {
  const { t, locale, perform } = useApp();
  const resource = useResource<PayoutSetup>("payout-setup:" + catererId, () =>
    api.request("payout-setup/" + catererId),
  );
  const [open, setOpen] = useState(false);
  if (!resource.data)
    return resource.error ? (
      <ErrorNotice message={resource.error} retry={resource.reload} />
    ) : (
      <Loading />
    );
  const s = resource.data,
    destination = s.active || s.legacyDestination;
  const ready =
    !!destination &&
    s.providerReady &&
    s.dispatchEnabled &&
    !!s.settlement.policy?.enabled &&
    !s.settlement.policy?.synthetic;
  return (
    <section className="panel" id="payout">
      <h2>
        <Landmark size={21} />{" "}
        {t("Rekening & pencairan", "Bank account & payouts")}
      </h2>
      {resource.error && (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      )}
      <p>
        <strong>
          {ready
            ? t("Siap", "Ready")
            : !destination
              ? t("Belum dikonfigurasi", "Not configured")
              : t("Menunggu aktivasi pencairan", "Awaiting payout activation")}
        </strong>
      </p>
      {destination && (
        <p>
          {destination.bank} · {destination.maskedAccount} ·{" "}
          {destination.holder}
        </p>
      )}
      {s.latest?.status === "submitted" && (
        <p className="notice">
          {t(
            "Rekening diajukan dan sedang ditinjau. Rekening yang sudah disetujui tetap digunakan sampai penggantinya disetujui.",
            "Bank details are awaiting review. Any approved destination remains in use until its replacement is approved.",
          )}
        </p>
      )}
      {s.latest?.status === "rejected" && (
        <p role="status">
          {t("Rekening ditolak", "Bank details rejected")}: {s.latest.reason}
        </p>
      )}
      <div className="payout-state">
        {[
          [t("Diproses", "Processing"), s.settlement.reserved],
          [t("Dibayar", "Paid"), s.settlement.paid],
          [t("Ditahan", "Held"), s.settlement.held],
        ].map(([label, amount]) => (
          <p key={label}>
            <strong>{label}</strong>
            <br />
            {settlementCurrency(amount, locale)}
          </p>
        ))}
      </div>
      {s.settlement.payouts
        .filter((p) =>
          ["failed", "rejected", "reversed", "cancelled"].includes(p.status),
        )
        .slice(0, 3)
        .map((p) => (
          <p key={p.id}>
            <Status status={p.status} /> ·{" "}
            {settlementCurrency(String(p.amount), locale)}{" "}
            {"failure_code" in p && p.failure_code ? `· ${p.failure_code}` : ""}
          </p>
        ))}
      <p>
        {t(
          "Pencairan otomatis diproses Senin pukul 09.00 WIB setelah diaktifkan. Waktu masuk ke rekening bergantung pada bank.",
          "Automatic payouts process Mondays at 09:00 WIB once enabled. Bank arrival time may vary.",
        )}
      </p>
      <p>
        {t("Jendela pemrosesan berikutnya", "Next processing window")}:{" "}
        {new Date(
          s.settlement.nextProcessingAt || s.settlement.nextPayoutAt,
        ).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
          timeZone: "Asia/Jakarta",
          hour12: false,
        })}{" "}
        WIB
        {!ready &&
          ` · ${t("setelah konfigurasi lengkap", "after setup is complete")}`}
      </p>
      {editable ? (
        <Button
          className="button"
          disabled={s.latest?.status === "submitted"}
          onClick={() => setOpen(true)}
        >
          {destination
            ? t("Ganti rekening", "Change bank account")
            : t("Atur pencairan", "Set up payout")}
        </Button>
      ) : (
        <Link className="button" href="/seller/settings#payout">
          {destination
            ? t("Kelola rekening", "Manage bank account")
            : t("Atur pencairan", "Set up payout")}
        </Link>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Ajukan rekening pencairan", "Submit payout bank account")}
      >
        <ActionForm
          submit={t("Ajukan untuk ditinjau", "Submit for review")}
          onSubmit={async (f) => {
            await perform("payoutDestination.submit", {
              catererId,
              bank: f.get("bank"),
              holder: f.get("holder"),
              accountNumber: f.get("accountNumber"),
              recipientType: f.get("recipientType"),
            });
            setOpen(false);
          }}
        >
          <Field label={t("Nama bank", "Bank name")}>
            <TextInput name="bank" required minLength={2} maxLength={100} />
          </Field>
          <Field label={t("Nama pemilik rekening", "Account holder name")}>
            <TextInput
              name="holder"
              required
              minLength={2}
              maxLength={150}
              autoComplete="off"
            />
          </Field>
          <Field label={t("Nomor rekening", "Account number")}>
            <TextInput
              name="accountNumber"
              inputMode="numeric"
              pattern="[0-9]{5,34}"
              required
              autoComplete="off"
            />
          </Field>
          <Field label={t("Jenis pemilik rekening", "Account holder type")}>
            <Select name="recipientType" defaultValue="INDIVIDUAL">
              <SelectOption value="INDIVIDUAL">
                {t("Perorangan", "Individual")}
              </SelectOption>
              <SelectOption value="BUSINESS">
                {t("Badan usaha", "Business")}
              </SelectOption>
            </Select>
          </Field>
          <p>
            {t(
              "Catera memverifikasi rekening sebelum digunakan. Pengajuan ini tidak mengaktifkan pencairan otomatis.",
              "Catera verifies bank details before use. Submitting does not enable automatic payouts.",
            )}
          </p>
        </ActionForm>
      </Dialog>
    </section>
  );
}

export function AccountHelp({ admin = false }: { admin?: boolean }) {
  const { actor, t, perform, notify } = useApp();
  const state = useResource<AccountRequest[]>("account-requests", () =>
    api.request("account-requests"),
  );
  return (
    <section className="panel" id="help">
      <h2>
        <LifeBuoy size={21} /> {t("Bantuan akun", "Account help")}
      </h2>
      {state.error && (
        <ErrorNotice message={state.error} retry={state.reload} />
      )}
      {!admin && (
        <ActionForm
          submit={t("Kirim permintaan", "Send request")}
          onSubmit={async (f) => {
            await perform("accountRequest.create", {
              catererId: actor?.catererId,
              kind: f.get("kind"),
              body: f.get("body"),
            });
            notify(
              t(
                "Permintaan tercatat. Akun dan pengantaran tetap aktif selama peninjauan.",
                "Request recorded. Your account and deliveries stay active during review.",
              ),
            );
          }}
        >
          <Field label={t("Jenis permintaan", "Request type")}>
            <Select name="kind" defaultValue="help">
              <SelectOption value="help">
                {t("Bantuan akun & keamanan", "Account & security help")}
              </SelectOption>
              <SelectOption value="deletion">
                {t("Ajukan penghapusan akun", "Request account deletion")}
              </SelectOption>
            </Select>
          </Field>
          <Field label={t("Keterangan", "Details")}>
            <TextArea name="body" minLength={5} maxLength={2000} required />
          </Field>
          <p>
            {t(
              "Penghapusan ditangani tim Catera setelah meninjau pengantaran, pembayaran, dan kepemilikan akun. Mengirim permintaan tidak menghapus akun.",
              "Catera handles deletion after reviewing deliveries, payments, and account ownership. Sending a request does not delete your account.",
            )}
          </p>
        </ActionForm>
      )}
      {state.data?.map((r) => (
        <article className="request-row" key={r.id}>
          <strong>
            {admin ? r.name + " · " : ""}
            {r.kind === "deletion"
              ? t("Penghapusan akun", "Account deletion")
              : t("Bantuan", "Help")}
          </strong>
          <p>{r.body}</p>
          <Status status={r.status} />
          {r.resolution && <p>{r.resolution}</p>}
          {admin && r.status === "open" && (
            <ActionForm
              submit={t("Simpan penyelesaian", "Record resolution")}
              onSubmit={async (f) => {
                await perform("accountRequest.resolve", {
                  id: r.id,
                  resolution: f.get("resolution"),
                });
              }}
            >
              <Field label={t("Hasil penanganan", "Resolution")}>
                <TextArea
                  required
                  minLength={5}
                  maxLength={2000}
                  name="resolution"
                />
              </Field>
              <p>
                {t(
                  "Catat hasil penanganan. Tindakan ini tidak menghapus akun secara otomatis.",
                  "Record the handling outcome. This action does not automatically delete the account.",
                )}
              </p>
            </ActionForm>
          )}
        </article>
      ))}
      {state.data?.length === 0 && (
        <p>{t("Belum ada permintaan.", "No requests yet.")}</p>
      )}
    </section>
  );
}

export function SellerAccountSettings({ state: s }: { state: SellerState }) {
  const { actor, perform, t } = useApp();
  const [invite, setInvite] = useState("");
  return (
    <div className="seller-settings-sections">
      <section className="panel">
        <h2>
          <ShieldCheck size={21} /> {t("Akun & keamanan", "Account & security")}
        </h2>
        <p>{actor?.name}</p>
        <LocaleSwitch />
        <Button
          className="button secondary"
          onClick={async () => {
            await api.request("auth/logout", {});
            location.assign("/");
          }}
        >
          <LogOut size={17} />{" "}
          {t("Keluar dari sesi ini", "Sign out of this session")}
        </Button>
        <p>
          <a href="#help" className="text-button">
            {t(
              "Bantuan masuk & keamanan akun",
              "Sign-in & account security help",
            )}
          </a>
        </p>
      </section>
      {actor?.role === "owner" && (
        <>
          <PayoutSetupCard catererId={s.caterer.id} editable />
          <section className="panel">
            <h2>{t("Tim katerer", "Caterer team")}</h2>
            {s.staff.map((st) => (
              <p key={st.user_id}>
                {st.name} ·{" "}
                {st.role === "owner"
                  ? t("Pemilik", "Owner")
                  : t("Staf", "Staff")}
              </p>
            ))}
            <ActionForm
              submit={t("Buat undangan staf", "Create staff invite")}
              onSubmit={async () => {
                const r = await perform<{ code: string }>("staff.invite", {
                  catererId: s.caterer.id,
                });
                setInvite(r.code);
              }}
            >
              <p>
                {t(
                  "Staf menangani operasi; akses keuangan dibatasi untuk pemilik.",
                  "Staff handle operations; financial access is limited to owners.",
                )}
              </p>
            </ActionForm>
            {invite && (
              <p className="notice">
                <code>{invite}</code>
              </p>
            )}
          </section>
        </>
      )}
      <AccountHelp />
      <section className="panel">
        <h2>{t("Tentang Catera", "About Catera")}</h2>
        <p>
          {t(
            "Catera menghubungkan pelanggan dengan katerer, jadwal pengantaran, dan bantuan dalam satu tempat.",
            "Catera connects customers with caterers, delivery schedules, and support in one place.",
          )}
        </p>
        <Link href="/seller/profile">
          {t(
            "Profil usaha & area pengantaran",
            "Business profile & delivery coverage",
          )}
        </Link>
      </section>
    </div>
  );
}

export function PayoutDestinationQueue() {
  const { t, perform } = useApp();
  const state = useResource<PayoutDestination[]>(
    "payout-destination-queue",
    () => api.request("payout-destination-queue"),
  );
  const [selected, setSelected] = useState<
      (PayoutDestination & { accountNumber: string }) | null
    >(null),
    [error, setError] = useState("");
  const [decision, setDecision] = useState("approved");
  return (
    <section className="panel">
      <h2>{t("Verifikasi rekening", "Bank account review")}</h2>
      {(state.error || error) && (
        <ErrorNotice message={state.error || error} retry={state.reload} />
      )}
      {state.data?.map((d) => (
        <div className="request-row" key={d.id}>
          <p>
            {d.caterer} · {d.bank} · {d.maskedAccount}
          </p>
          <Button
            className="button secondary"
            onClick={async () => {
              try {
                setDecision("approved");
                setSelected(
                  await api.request("payout-destination-detail/" + d.id),
                );
                setError("");
              } catch {
                setError(
                  t(
                    "Detail rekening gagal dimuat.",
                    "Bank details could not be loaded.",
                  ),
                );
              }
            }}
          >
            {t("Tinjau rekening", "Review bank details")}
          </Button>
        </div>
      ))}
      {state.data?.length === 0 && (
        <p>
          {t(
            "Tidak ada rekening menunggu tinjauan.",
            "No bank details awaiting review.",
          )}
        </p>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={t("Verifikasi rekening", "Bank account review")}
      >
        {selected && (
          <ActionForm
            key={selected.id}
            submit={t("Simpan keputusan", "Save decision")}
            onSubmit={async (f) => {
              await perform("payoutDestination.review", {
                id: selected.id,
                version: selected.version,
                decision,
                routingCode: f.get("routingCode"),
                givenName: f.get("givenName"),
                surname: f.get("surname"),
                businessName: f.get("businessName"),
                reason: f.get("reason"),
              });
              setSelected(null);
            }}
          >
            <p>
              {selected.bank} · {selected.holder} · {selected.accountNumber}
            </p>
            <Field label={t("Keputusan", "Decision")}>
              <Select value={decision} onValueChange={setDecision}>
                <SelectOption value="approved">
                  {t("Setujui", "Approve")}
                </SelectOption>
                <SelectOption value="rejected">
                  {t("Tolak", "Reject")}
                </SelectOption>
              </Select>
            </Field>
            {decision === "approved" && (
              <>
                {selected.recipientType === "BUSINESS" ? (
                  <Field
                    label={t(
                      "Nama badan usaha terverifikasi",
                      "Verified business name",
                    )}
                  >
                    <TextInput
                      name="businessName"
                      required
                      maxLength={50}
                      defaultValue={selected.holder}
                    />
                  </Field>
                ) : (
                  <>
                    <Field
                      label={t(
                        "Nama depan penerima terverifikasi",
                        "Verified recipient given name",
                      )}
                    >
                      <TextInput name="givenName" required maxLength={50} />
                    </Field>
                    <Field
                      label={t(
                        "Nama belakang penerima terverifikasi",
                        "Verified recipient surname",
                      )}
                    >
                      <TextInput name="surname" required maxLength={50} />
                    </Field>
                    <p>
                      {t(
                        "Gunakan identitas yang diterima penyedia pembayaran. Nama tunggal perlu dikonfirmasi sebelum disetujui.",
                        "Use the identity accepted by the payment provider. Confirm the accepted format for a single name before approval.",
                      )}
                    </p>
                  </>
                )}
                <Field
                  label={t(
                    "Kode SWIFT bank terverifikasi",
                    "Verified bank SWIFT code",
                  )}
                >
                  <TextInput
                    name="routingCode"
                    required
                    pattern="[A-Z0-9]{8}([A-Z0-9]{3})?"
                  />
                </Field>
                <label className="checkbox">
                  <Checkbox required />
                  {t(
                    "Kepemilikan, nomor rekening, dan dukungan bank telah diverifikasi.",
                    "Account ownership, number, and bank support have been verified.",
                  )}
                </label>
              </>
            )}
            <Field label={t("Alasan keputusan", "Decision reason")}>
              <TextArea name="reason" required minLength={5} maxLength={1000} />
            </Field>
          </ActionForm>
        )}
      </Dialog>
    </section>
  );
}
