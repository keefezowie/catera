"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, X } from "lucide-react";
import { command } from "@/app/actions";
import { commandOutcomeUnknown } from "@/lib/command-attempt";
import type { Snapshot } from "@/lib/types";
import { Status, useFormat } from "./ui";

import {
  batchBlocker,
  reviewBatch,
  reviewIsStale,
  remainingBatchRows,
  type BatchReviewRow,
  type BatchResult,
  type BatchTarget,
} from "./operations-batch-model";

export function OperationsBatch({
  s,
  ids,
  clear,
  removeCompleted,
  handoff,
}: {
  s: Snapshot;
  ids: string[];
  clear: () => void;
  removeCompleted: (ids: string[]) => void;
  handoff?: { target: BatchTarget; ids: string[]; label: string };
}) {
  const t = useTranslations(),
    fmt = useFormat(),
    router = useRouter();
  const [review, setReview] = useState<{
    target: BatchTarget;
    rows: BatchReviewRow[];
  } | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const current = useRef(s);
  const opener = useRef<HTMLButtonElement | null>(null);
  current.current = s;
  const readyCount = ids.filter((id) => {
    const d = s.deliveries.find((d) => d.id === id);
    return d && !batchBlocker(s, d, "ready");
  }).length;
  const dispatchCount = ids.filter(
    (id) => s.deliveries.find((d) => d.id === id)?.status === "ready",
  ).length;
  const eligible = review?.rows.filter((r) => !r.blocker) || [];
  const remaining = remainingBatchRows(eligible, results);
  const unresolved = remaining.filter((row) =>
    results.some((r) => r.id === row.delivery.id && r.unknown),
  );
  const stale = remaining.some((r) => reviewIsStale(s, r, review!.target));
  const successes = results.filter((r) => r.ok).length;
  const failures = results.filter((r) => !r.ok).length;
  function open(
    target: BatchTarget,
    trigger: HTMLButtonElement,
    reviewedIds = ids,
  ) {
    opener.current = trigger;
    setReviewOpen(true);
    if (unresolved.length) return;
    setResults([]);
    setReview({ target, rows: reviewBatch(s, reviewedIds, target) });
  }
  async function submit() {
    if (
      !review ||
      pending ||
      (!unresolved.length && stale) ||
      !remaining.length
    )
      return;
    setPending(true);
    const nextResults = results.filter(
      (result) => result.ok || (unresolved.length && !result.unknown),
    );
    // Each record uses its own authorized atomic transaction and stable request key.
    // Never replay successful rows when retrying a partially completed batch.
    for (const row of unresolved.length ? unresolved : remaining) {
      // Unknown responses must replay the original UUID before checking stale
      // versions: execute_command resolves a successful receipt first.
      if (
        !results.some((r) => r.id === row.delivery.id && r.unknown) &&
        reviewIsStale(current.current, row, review.target)
      ) {
        nextResults.push({ id: row.delivery.id, ok: false, code: "CONFLICT" });
        continue;
      }
      try {
        const result = await command(
          s.business.slug,
          "transition",
          {
            id: row.delivery.id,
            version: row.delivery.version,
            status: review.target,
            ...(review.target === "ready"
              ? { production_id: row.productionId }
              : {}),
          },
          row.requestId,
        );
        nextResults.push(
          result.ok
            ? { id: row.delivery.id, ok: true }
            : {
                id: row.delivery.id,
                ok: false,
                code: result.code,
                unknown: commandOutcomeUnknown(
                  result.code,
                  results.some((r) => r.id === row.delivery.id && r.unknown),
                ),
              },
        );
      } catch {
        nextResults.push({
          id: row.delivery.id,
          ok: false,
          code: "SAVE_FAILED",
          unknown: true,
        });
      }
      setResults([...nextResults]);
    }
    setResults([...nextResults]);
    removeCompleted(nextResults.filter((r) => r.ok).map((r) => r.id));
    setPending(false);
    router.refresh();
  }
  if (!ids.length && !review && !handoff) return null;
  return (
    <>
      {handoff && (
        <button
          className="button primary batch-handoff-trigger"
          disabled={!handoff.ids.length || pending}
          onClick={(event) =>
            open(handoff.target, event.currentTarget, handoff.ids)
          }
        >
          {handoff.label}
        </button>
      )}
      {!!unresolved.length && !reviewOpen && (
        <div className="batch-actionbar" role="status">
          <p>{t("saveOutcomeUnknown")}</p>
          <button
            className="button secondary"
            onClick={() => setReviewOpen(true)}
          >
            {t("batchResolveUnknown")}
          </button>
        </div>
      )}
      {ids.length > 0 && (
        <div
          className="batch-actionbar"
          role="region"
          aria-label={t("batchActions")}
        >
          <strong>{t("batchSelected", { count: ids.length })}</strong>
          <button className="button ghost" onClick={clear}>
            {t("batchClear")}
          </button>
          <p className="batch-action-hint">
            {t(
              !readyCount && !dispatchCount
                ? "batchNoneEligible"
                : "batchSafety",
            )}
          </p>
          <div className="batch-actions">
            <button
              className="button secondary"
              disabled={!readyCount}
              onClick={(e) => open("ready", e.currentTarget)}
            >
              {t("batchReviewReady", { count: readyCount })}
            </button>
            <button
              className="button primary"
              disabled={!dispatchCount}
              onClick={(e) => open("out_for_delivery", e.currentTarget)}
            >
              {t("batchReviewDispatch", { count: dispatchCount })}
            </button>
          </div>
        </div>
      )}
      <Dialog.Root
        open={!!review && reviewOpen}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setReviewOpen(false);
            if (!unresolved.length) setReview(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="dialog-content batch-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target =
                opener.current?.isConnected && !opener.current.disabled
                  ? opener.current
                  : document.querySelector<HTMLElement>(
                      ".batch-handoff-trigger:not(:disabled), .production-next-step a, .operations-list input[type=checkbox]",
                    );
              target?.focus();
            }}
            onEscapeKeyDown={(e) => {
              if (pending) e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              if (pending) e.preventDefault();
            }}
          >
            <div className="dialog-heading">
              <Dialog.Title>
                {t(
                  review?.target === "ready"
                    ? "batchReadyTitle"
                    : "batchDispatchTitle",
                )}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="icon-button"
                  disabled={pending}
                  aria-label={t("close")}
                >
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="muted">
              {t("batchDescription")}
            </Dialog.Description>
            <div className="batch-review-body">
              <p className="batch-review-summary">
                {t("batchEligible", {
                  count: eligible.length,
                  excluded: (review?.rows.length || 0) - eligible.length,
                })}
              </p>
              <ul className="batch-review-list">
                {review?.rows.map((row) => {
                  const result = results.find((r) => r.id === row.delivery.id);
                  return (
                    <li
                      key={row.delivery.id}
                      className={row.blocker ? "batch-blocked" : ""}
                    >
                      <div className="batch-review-identity">
                        <strong>{row.customer}</strong>
                        <span>
                          {fmt.date(row.delivery.service_date, true)} ·{" "}
                          {row.slot}
                        </span>
                      </div>
                      <div>
                        <span>
                          {row.delivery.menu_name || t("menuMissing")}
                        </span>
                        {row.revision && (
                          <small>
                            {t("revision")} {row.revision}
                          </small>
                        )}
                      </div>
                      <div className="batch-review-state">
                        {row.blocker ? (
                          <span>
                            {t("batchExcluded")}: {t(row.blocker)}
                          </span>
                        ) : (
                          <>
                            <Status status={row.delivery.status} />
                            <span aria-hidden="true">→</span>
                            <Status status={review.target} />
                          </>
                        )}
                        {result && (
                          <p className={result.ok ? "batch-success" : "error"}>
                            {result.unknown
                              ? t("saveOutcomeUnknown")
                              : result.ok
                                ? t("batchUpdated")
                                : t.has("error." + result.code)
                                  ? t("error." + result.code)
                                  : t("error.SAVE_FAILED")}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {stale && !pending && (
                <p className="notice warning" role="alert">
                  <AlertCircle size={18} />
                  {t("batchStale")}
                </p>
              )}
              {!!results.length && (
                <p role="status" aria-live="polite">
                  {pending
                    ? t("batchProgress", {
                        count: results.length,
                        total: eligible.length,
                      })
                    : t("batchResult", {
                        success: successes,
                        failed: failures,
                      })}
                </p>
              )}
            </div>
            <div className="form-actions batch-review-footer">
              <Dialog.Close asChild>
                <button className="button secondary" disabled={pending}>
                  {t(results.length ? "close" : "cancel")}
                </button>
              </Dialog.Close>
              {stale && !pending && !unresolved.length ? (
                <button
                  className="button primary"
                  onClick={() => {
                    const remainingIds = remaining.map((r) => r.delivery.id);
                    setReview({
                      target: review!.target,
                      rows: reviewBatch(s, remainingIds, review!.target),
                    });
                    setResults([]);
                  }}
                >
                  {t("batchReviewAgain")}
                </button>
              ) : (
                <button
                  className="button primary"
                  disabled={
                    pending ||
                    !remaining.length ||
                    (stale && !unresolved.length)
                  }
                  onClick={submit}
                >
                  {pending
                    ? t("saving")
                    : unresolved.length
                      ? t("batchResolveUnknown")
                      : t(results.length ? "batchRetry" : "batchConfirm", {
                          count: remaining.length,
                        })}
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
