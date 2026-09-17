"use client";
import Link from "next/link";
import { useState } from "react";
import { CircleAlert, ArrowRight } from "lucide-react";
import type { SellerAttention } from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, Dialog, Field, ErrorNotice, Loading } from "./ui";
import { Button, TextArea } from "./form-controls";

export function NeedsAttention({ catererId }: { catererId: string }) {
  const { t, locale, perform } = useApp();
  const [handled, setHandled] = useState<
    SellerAttention["items"][number] | null
  >(null);
  const state = useResource<SellerAttention>(
    "seller-attention:" + catererId,
    () => api.request("seller-attention/" + catererId),
  );
  const labels = {
    production_changed: [
      t("Daftar produksi sudah berubah", "Production list has changed"),
      t(
        "Periksa dan simpan revisi terbaru",
        "Review and save the latest revision",
      ),
    ],
    delivery_issue: [
      t("Laporan pengantaran belum selesai", "Unresolved delivery report"),
      t("Tanggapi atau selesaikan", "Respond or resolve"),
    ],
    support: [
      t("Permintaan pelanggan menunggu", "Customer request waiting"),
      t("Tinjau permintaan", "Review request"),
    ],
    delivery: [
      t("Pengantaran bermasalah", "Delivery problem"),
      t("Perbarui status pengantaran", "Update delivery status"),
    ],
    choice_deadline: [
      t("Batas pilihan menu mendekat", "Menu cutoff approaching"),
      t("Periksa pilihan pelanggan", "Review customer choices"),
    ],
    choice_fallback: [
      t("Katerer memilih", "Caterer chooses"),
      t(
        "Tentukan hidangan dan hubungi pelanggan",
        "Choose dishes and contact customer",
      ),
    ],
    payment: [
      t(
        "Pembayaran memerlukan peninjauan Catera",
        "Payment needs Catera review",
      ),
      t("Tinjau kasus pembayaran", "Review payment case"),
    ],
  };
  return (
    <section
      className="panel spaced"
      aria-label={t("Perlu perhatian", "Needs attention")}
    >
      <h2>
        <CircleAlert size={20} aria-hidden="true" />{" "}
        {t("Perlu perhatian", "Needs attention")}
        {state.data && ` (${state.data.total})`}
      </h2>
      {state.error ? (
        <ErrorNotice message={state.error} retry={state.reload} />
      ) : !state.data ? (
        <Loading />
      ) : (
        <>
          {!state.data.total && (
            <p className="quiet-empty">
              {t(
                "Tidak ada kendala yang memerlukan tindakan saat ini.",
                "No exceptions require action right now.",
              )}
            </p>
          )}
          {state.data.items.map((item) => (
            <div key={item.id}>
              <Link className="queue-row" href={item.href}>
                <span>
                  <strong>{labels[item.kind][0]}</strong>
                  <small>{item.context}</small>
                  {(item.kind === "choice_deadline" ||
                    item.kind === "choice_fallback") && (
                    <small>
                      {t("Batas pilihan", "Selection cutoff")}:{" "}
                      {new Date(item.at_time).toLocaleString(
                        locale === "id" ? "id-ID" : "en-GB",
                        { timeZone: state.data!.timezone },
                      )}{" "}
                      · {state.data!.timezone}
                    </small>
                  )}
                  <small>
                    {item.priority < 2
                      ? t("Perlu ditangani", "Action needed")
                      : t(
                          "Sebelum produksi / pengantaran",
                          "Before production / delivery",
                        )}{" "}
                    · {labels[item.kind][1]}
                  </small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              {item.kind === "choice_fallback" && (
                <Button
                  className="text-button"
                  onClick={() => setHandled(item)}
                >
                  {t(
                    "Hidangan sudah disiapkan & dikomunikasikan",
                    "Dishes planned & customer informed",
                  )}
                </Button>
              )}
            </div>
          ))}
          {state.data.total > state.data.items.length && (
            <p>
              {t(
                "Menampilkan 100 prioritas pertama. Selesaikan kendala untuk melihat berikutnya.",
                "Showing the first 100 priorities. Resolve items to see the next ones.",
              )}
            </p>
          )}
        </>
      )}
      <Dialog
        open={!!handled}
        onOpenChange={(open) => {
          if (!open) setHandled(null);
        }}
        title={t("Tandai tindak lanjut selesai", "Complete this follow-up")}
      >
        {handled && (
          <ActionForm
            submit={t("Simpan tindak lanjut", "Save follow-up")}
            onSubmit={async (f) => {
              const separator = handled.id.lastIndexOf("-");
              await perform("attention.choiceHandled", {
                deliveryId: handled.id.slice(7, separator),
                meal: handled.id.slice(separator + 1),
                date: handled.context.slice(0, 10),
                body: f.get("body"),
              });
              setHandled(null);
            }}
          >
            <p>{handled.context}</p>
            <p>
              {t(
                "Catat hidangan yang dipilih dan komunikasi dengan pelanggan. Ini tidak mengubah pilihan pelanggan atau status pengantaran.",
                "Record the dishes chosen and communication with the customer. This does not change customer selections or delivery status.",
              )}
            </p>
            <Field label={t("Catatan tindak lanjut", "Follow-up note")}>
              <TextArea name="body" minLength={5} maxLength={2000} required />
            </Field>
          </ActionForm>
        )}
      </Dialog>
    </section>
  );
}
