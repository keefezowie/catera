"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  mealLabel,
  type CustomerState,
  type DeliveryIssue,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, Dialog, ErrorNotice, Field, Loading, Status } from "./ui";
import { Button, TextArea } from "./form-controls";
import { Select, SelectOption } from "./select";

export function ReportDeliveryIssue({ id }: { id: string }) {
  const { t, locale, perform } = useApp();
  const [open, setOpen] = useState(true);
  const state = useResource<CustomerState>("issue-delivery:" + id, () =>
    api.customer("?deliveryId=" + id),
  );
  if (state.error)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return <Loading />;
  const delivery = state.data.deliveries.find((d) => d.id === id);
  if (!delivery)
    return (
      <p role="alert">
        {t("Pengantaran tidak ditemukan.", "Delivery not found.")}
      </p>
    );
  return (
    <>
      <Button className="button secondary" onClick={() => setOpen(true)}>
        {t("Laporkan masalah pengantaran", "Report delivery issue")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Kendala pengantaran", "Delivery issue")}
      >
        <p>
          {delivery.offer.name} · {delivery.service_date}
        </p>
        <p className="notice">
          {t(
            "Laporan ini tidak membatalkan jadwal atau memproses refund. Katerer akan menanggapi; Anda dapat meminta Catera meninjau jika belum selesai.",
            "This report does not cancel deliveries or process a refund. Your caterer will respond; you can ask Catera to review unresolved issues.",
          )}
        </p>
        <ActionForm
          submit={t("Kirim laporan", "Send report")}
          onSubmit={async (f) => {
            await perform("deliveryIssue.create", {
              deliveryId: id,
              meal: f.get("meal"),
              subject: f.get("subject"),
              body: f.get("body"),
            });
            setOpen(false);
          }}
        >
          <Field label={t("Waktu makan", "Meal")}>
            <Select name="meal">
              {(delivery.offer.meal === "both"
                ? ["lunch", "dinner"]
                : [delivery.offer.meal]
              ).map((meal) => (
                <SelectOption key={meal} value={meal}>
                  {mealLabel(meal as "lunch" | "dinner", locale)}
                </SelectOption>
              ))}
            </Select>
          </Field>
          <Field label={t("Jenis kendala", "Issue type")}>
            <Select name="subject">
              {[
                ["Makanan belum diterima", "Meal not received"],
                ["Pengantaran terlambat", "Delivery is late"],
                ["Menu tidak sesuai", "Menu is incorrect"],
                ["Kemasan rusak", "Packaging is damaged"],
                ["Kualitas makanan", "Food quality"],
                ["Lainnya", "Other"],
              ].map(([id, en]) => (
                <SelectOption key={id} value={t(id, en)}>
                  {t(id, en)}
                </SelectOption>
              ))}
            </Select>
          </Field>
          <Field label={t("Ceritakan kendalanya", "Tell us what happened")}>
            <TextArea name="body" required minLength={5} maxLength={2000} />
          </Field>
        </ActionForm>
      </Dialog>
    </>
  );
}

export function DeliveryIssues({ catererId }: { catererId?: string }) {
  const { t, locale, perform } = useApp();
  const issue = useSearchParams().get("issue");
  const state = useResource<DeliveryIssue[]>(
    "delivery-issues:" + catererId + ":" + issue,
    () =>
      api.request(
        "delivery-issues?" +
          new URLSearchParams({
            ...(catererId ? { id: catererId } : {}),
            ...(issue ? { issue } : {}),
          }),
      ),
  );
  if (state.error)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return <Loading />;
  return (
    <section
      className="panel spaced"
      aria-label={t("Kendala pengantaran", "Delivery issues")}
    >
      <h2>{t("Kendala pengantaran", "Delivery issues")}</h2>
      {issue && (
        <Link href={catererId ? "/seller/support?tab=help" : "/support"}>
          {t("Semua laporan", "All reports")}
        </Link>
      )}
      {!state.data.length && (
        <p className="quiet-empty">
          {t("Belum ada laporan pengantaran.", "No delivery issues reported.")}
        </p>
      )}
      {state.data.map((i) => (
        <article className="support-case" key={i.id}>
          <div className="section-heading">
            <h3>{i.subject}</h3>
            <Status status={i.status} />
          </div>
          <p>
            {i.package_name} · {i.service_date} · {mealLabel(i.meal, locale)}
          </p>
          {!catererId && (
            <Link href={"/deliveries/" + i.day_id}>
              {t("Lihat pengantaran", "View delivery")}
            </Link>
          )}
          <ol>
            {i.events.map((event) => (
              <li key={event.id}>
                <p>{event.body}</p>
                <small>
                  {new Date(event.created_at).toLocaleString(
                    locale === "id" ? "id-ID" : "en-GB",
                  )}
                </small>
              </li>
            ))}
          </ol>
          {i.case_id ? (
            <p className="notice">
              {t(
                "Diteruskan ke Catera. Lihat kasus untuk keputusan dan status penyelesaiannya.",
                "Sent to Catera. View the case for its decision and resolution status.",
              )}
              {i.case_id && (
                <Link
                  href={
                    (catererId ? "/seller/support?case=" : "/support?case=") +
                    i.case_id
                  }
                >
                  {" "}
                  {t("Lihat kasus", "View case")}
                </Link>
              )}
            </p>
          ) : (
            <>
              {catererId && i.status !== "resolved" && (
                <ActionForm
                  key={i.version}
                  submit={t("Simpan tanggapan", "Save response")}
                  onSubmit={async (f) => {
                    await perform(String(f.get("action")), {
                      id: i.id,
                      version: i.version,
                      body: f.get("body"),
                    });
                  }}
                >
                  <Field label={t("Tindakan", "Action")}>
                    <Select name="action">
                      <SelectOption value="deliveryIssue.respond">
                        {t("Tanggapi", "Respond")}
                      </SelectOption>
                      <SelectOption value="deliveryIssue.resolve">
                        {t(
                          "Selesai secara operasional",
                          "Resolved operationally",
                        )}
                      </SelectOption>
                    </Select>
                  </Field>
                  <Field
                    label={t(
                      "Tanggapan dan langkah penyelesaian",
                      "Response and resolution steps",
                    )}
                  >
                    <TextArea
                      name="body"
                      required
                      minLength={5}
                      maxLength={2000}
                    />
                  </Field>
                  <p className="field-hint">
                    {t(
                      "Tidak mengubah pembayaran atau jadwal. Untuk refund atau kasus belum selesai, gunakan eskalasi.",
                      "Does not change payment or delivery schedules. Escalate refunds or unresolved cases.",
                    )}
                  </p>
                </ActionForm>
              )}
              <details>
                <summary>
                  {t("Minta Catera meninjau", "Ask Catera to review")}
                </summary>
                <ActionForm
                  submit={t("Eskalasi ke Catera", "Escalate to Catera")}
                  onSubmit={async (f) => {
                    await perform("deliveryIssue.escalate", {
                      id: i.id,
                      version: i.version,
                      body: f.get("body"),
                    });
                  }}
                >
                  <Field label={t("Alasan eskalasi", "Escalation reason")}>
                    <TextArea
                      name="body"
                      required
                      minLength={5}
                      maxLength={2000}
                    />
                  </Field>
                  <p>
                    {t(
                      "Catera meninjau permintaan sesuai aturan bantuan dan penahanan dana yang berlaku. Tidak ada refund otomatis.",
                      "Catera reviews the request under the existing support and funds-hold rules. No automatic refund.",
                    )}
                  </p>
                </ActionForm>
              </details>
            </>
          )}
        </article>
      ))}
      {state.data.length === 100 && (
        <p>
          {t(
            "Menampilkan 100 laporan terbaru. Tautan notifikasi membuka laporan terkait.",
            "Showing the latest 100 reports. Notification links open the relevant report.",
          )}
        </p>
      )}
    </section>
  );
}
