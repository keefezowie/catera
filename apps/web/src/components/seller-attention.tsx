"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleAlert, ArrowRight } from "lucide-react";
import {
  mealLabel,
  type SellerAttentionItem,
  type SellerAttentionPage,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ActionForm, Dialog, Field, ErrorNotice } from "./ui";
import { Button, TextArea } from "./form-controls";
import { Select, SelectOption } from "./select";

type AttentionScope = "selected" | "future" | "all";

export function NeedsAttention({
  catererId,
  date,
  meal,
}: {
  catererId: string;
  date: string;
  meal: string;
}) {
  const { t, locale, perform } = useApp();
  const [scope, setScope] = useState<AttentionScope>("selected");
  const [mealScope, setMealScope] = useState<"" | "lunch" | "dinner">(
    meal === "dinner" ? "dinner" : "lunch",
  );
  const [expanded, setExpanded] = useState(false);
  const [handled, setHandled] = useState<SellerAttentionItem | null>(null);
  const [items, setItems] = useState<SellerAttentionItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState("");
  const params = {
    scope,
    ...(scope !== "all" ? { date } : {}),
    ...(mealScope ? { meal: mealScope } : {}),
    limit: 20,
  } as const;
  const state = useResource<SellerAttentionPage>(
    `seller-attention:${catererId}:${scope}:${date}:${mealScope}`,
    () => api.sellerAttention(catererId, params),
  );

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    setPageError("");
    setExpanded(false);
  }, [catererId, scope, date, mealScope]);
  useEffect(() => {
    if (!state.data) return;
    setItems(state.data.items);
    setNextCursor(state.data.nextCursor);
  }, [state.data]);

  const labels: Record<SellerAttentionItem["kind"], [string, string]> = {
    production_changed: [
      t("Daftar produksi sudah berubah", "Production list has changed"),
      t("Periksa dan simpan daftar terbaru", "Review and save the latest list"),
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
      t("Katerer perlu memilih hidangan", "Caterer must choose dishes"),
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

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setPageError("");
    try {
      const page = await api.sellerAttention(catererId, {
        ...params,
        cursor: nextCursor,
      });
      setItems((current) => [
        ...current,
        ...page.items.filter(
          (next) => !current.some((existing) => existing.id === next.id),
        ),
      ]);
      setNextCursor(page.nextCursor);
    } catch {
      setPageError(
        t(
          "Masalah berikutnya belum berhasil dimuat.",
          "More issues could not be loaded.",
        ),
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const total = state.data?.total ?? items.length;
  const visible = expanded ? items : items.slice(0, 3);
  return (
    <section
      className="panel spaced seller-attention"
      data-empty={(!state.loading && !state.error && total === 0) || undefined}
      aria-busy={state.loading || loadingMore || undefined}
      aria-label={t("Perlu perhatian", "Needs attention")}
    >
      <div className="section-heading">
        <div>
          <h2>
            <CircleAlert size={20} aria-hidden="true" />{" "}
            {t("Perlu perhatian", "Needs attention")}{" "}
            {!state.loading && `(${total})`}
          </h2>
          <p>
            {t(
              "Tiga masalah teratas ditampilkan lebih dulu.",
              "The top three issues appear first.",
            )}
          </p>
        </div>
      </div>
      <div
        className="attention-scope"
        aria-label={t("Cakupan masalah", "Issue scope")}
      >
        {(["selected", "future", "all"] as const).map((value) => (
          <Button
            key={value}
            variant="secondary"
            aria-pressed={scope === value}
            className={scope === value ? "is-selected" : ""}
            onClick={() => setScope(value)}
          >
            {value === "selected"
              ? t("Tanggal terpilih", "Selected day")
              : value === "future"
                ? t("Mendatang", "Future")
                : t("Semua tanggal", "All dates")}
          </Button>
        ))}
        <Select
          aria-label={t("Waktu makan masalah", "Issue meal")}
          value={mealScope}
          onValueChange={(value) =>
            setMealScope(value as "" | "lunch" | "dinner")
          }
        >
          <SelectOption value="">
            {t("Siang + malam", "Lunch + dinner")}
          </SelectOption>
          <SelectOption value="lunch">{t("Siang", "Lunch")}</SelectOption>
          <SelectOption value="dinner">{t("Malam", "Dinner")}</SelectOption>
        </Select>
      </div>
      <p className="muted attention-scope-summary">
        {scope === "selected"
          ? `${date} · ${mealScope ? mealLabel(mealScope, locale) : t("siang + malam", "lunch + dinner")}`
          : scope === "future"
            ? t(`Mulai ${date}`, `From ${date}`)
            : t("Seluruh tanggal", "All dates")}
        {state.data?.timezone ? ` · ${state.data.timezone}` : ""}
      </p>
      {state.error ? (
        <ErrorNotice message={state.error} retry={state.reload} />
      ) : state.loading || !state.data ? (
        <p role="status">
          {t(
            "Memeriksa pekerjaan yang perlu ditangani…",
            "Checking for tasks that need attention…",
          )}
        </p>
      ) : (
        <>
          {!total && (
            <p className="quiet-empty">
              {t(
                "Tidak ada kendala yang memerlukan tindakan pada cakupan ini.",
                "No exceptions require action in this scope.",
              )}
            </p>
          )}
          <div id="attention-tasks">
            {visible.map((item) => (
              <article className="attention-item" key={item.id}>
                <Link
                  className="queue-row"
                  href={item.destination || item.href}
                >
                  <span>
                    <strong>{labels[item.kind][0]}</strong>
                    <small>
                      {[
                        item.serviceDate,
                        item.meal ? mealLabel(item.meal, locale) : null,
                        item.packageName,
                      ]
                        .filter(Boolean)
                        .join(" · ") || item.context}
                    </small>
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
                        ? t("Mendesak", "Urgent")
                        : t(
                            "Sebelum produksi / pengantaran",
                            "Before production / delivery",
                          )}{" "}
                      · {labels[item.kind][1]}
                    </small>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                {item.kind === "choice_fallback" &&
                  item.deliveryId &&
                  item.serviceDate &&
                  item.meal && (
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
              </article>
            ))}
          </div>
          {!expanded && total > 3 && (
            <Button
              className="text-button"
              aria-expanded="false"
              aria-controls="attention-tasks"
              onClick={() => setExpanded(true)}
            >
              {t("Lihat semua masalah", "View all issues")} · {total}
            </Button>
          )}
          {expanded && (
            <div className="attention-more">
              {nextCursor ? (
                <Button
                  variant="secondary"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore
                    ? t("Memuat…", "Loading…")
                    : t("Muat masalah berikutnya", "Load more issues")}
                </Button>
              ) : total > 3 ? (
                <span role="status">
                  {t(
                    `Semua ${items.length} masalah sudah ditampilkan.`,
                    `All ${items.length} issues are shown.`,
                  )}
                </span>
              ) : null}
              <Button
                className="text-button"
                onClick={() => setExpanded(false)}
              >
                {t("Tampilkan tiga teratas", "Show top three")}
              </Button>
            </div>
          )}
          {pageError && (
            <p className="notice error" role="alert">
              {pageError}
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
        {handled &&
          handled.deliveryId &&
          handled.serviceDate &&
          handled.meal && (
            <ActionForm
              submit={t("Simpan tindak lanjut", "Save follow-up")}
              onSubmit={async (form) => {
                await perform("attention.choiceHandled", {
                  deliveryId: handled.deliveryId,
                  meal: handled.meal,
                  date: handled.serviceDate,
                  body: form.get("body"),
                });
                setHandled(null);
                state.reload();
              }}
            >
              <p>
                {[
                  handled.serviceDate,
                  mealLabel(handled.meal, locale),
                  handled.packageName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
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
