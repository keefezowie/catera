"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, useRef, useTransition, useContext } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { X, Check, AlertCircle, ArrowUpRight, PackageOpen } from "lucide-react";
import { command } from "@/app/actions";
import { PolicyVersionContext } from "@/lib/workspace-context";
import type { Address, Grant } from "@/lib/types";
export function useFormat() {
  const locale = useLocale();
  return {
    date: (value: string, short = false) =>
      new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        day: "numeric",
        month: short ? "short" : "long",
        year: short ? undefined : "numeric",
        timeZone: "UTC",
      }).format(new Date(value.slice(0, 10) + "T12:00:00Z")),
    datetime: (value: string, zone = "Asia/Jakarta") =>
      new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: zone,
      }).format(new Date(value)),
  };
}
export function Status({ status }: { status: string }) {
  const t = useTranslations();
  return (
    <span className={"status status-" + status}>
      <span />
      {t.has(status) ? t(status) : status}
    </span>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <PackageOpen size={32} strokeWidth={1.4} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function Quota({ grants }: { grants: Grant[] }) {
  const t = useTranslations(),
    sum = (key: "remaining" | "reserved" | "available") =>
      grants.reduce((n, g) => n + g[key], 0);
  return (
    <div className="quota-summary">
      {(["remaining", "reserved", "available"] as const).map((k) => (
        <div key={k}>
          <strong>{sum(k)}</strong>
          <span>{t(k)}</span>
        </div>
      ))}
    </div>
  );
}
export function AddressFields({
  address,
  prefix = "",
}: {
  address?: Address;
  prefix?: string;
}) {
  const t = useTranslations();
  return (
    <>
      <label>
        {t("line")}
        <input
          name={prefix + "line"}
          defaultValue={address?.line}
          required
          minLength={5}
          maxLength={500}
        />
      </label>
      <label>
        {t("city")}
        <input
          name={prefix + "city"}
          defaultValue={address?.city}
          required
          minLength={2}
          maxLength={100}
        />
      </label>
      <label>
        {t("instructions")}
        <textarea
          name={prefix + "instructions"}
          defaultValue={address?.instructions}
          maxLength={1000}
          rows={2}
        />
      </label>
    </>
  );
}
export const addressFrom = (f: FormData): Address => ({
  line: String(f.get("line") || ""),
  city: String(f.get("city") || ""),
  instructions: String(f.get("instructions") || ""),
});
export function FormDialog({
  slug,
  action,
  title,
  trigger,
  children,
  build,
  description,
  review,
  buttonLabel,
  onDone,
  disabled = false,
}: {
  slug: string;
  action: string;
  title: string;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  build: (f: FormData) => unknown;
  description?: string;
  review?: (data: unknown) => React.ReactNode;
  buttonLabel?: string;
  onDone?: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations(),
    router = useRouter(),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [pending, start] = useTransition(),
    [draft, setDraft] = useState<unknown>(null),
    policyVersion = useContext(PolicyVersionContext),
    form = useRef<HTMLFormElement>(null),
    key = useRef(""),
    openedBuild = useRef(build),
    openedReview = useRef(review),
    openedPolicyVersion = useRef(policyVersion);
  function changeOpen(value: boolean) {
    if (pending) return;
    if (value) {
      // Keep the reviewed versions from opening the form, even if background refresh updates props.
      openedBuild.current = build;
      openedReview.current = review;
      openedPolicyVersion.current = policyVersion;
    }
    setOpen(value);
    if (!value) {
      setError("");
      setDraft(null);
      key.current = "";
    }
  }
  function submit(data: unknown) {
    if (!key.current) key.current = crypto.randomUUID();
    setError("");
    start(async () => {
      try {
        const result = await command(slug, action, data, key.current);
        if (result.ok) {
          setOpen(false);
          setDraft(null);
          key.current = "";
          router.refresh();
          window.dispatchEvent(new Event("catera:saved"));
          onDone?.();
        } else setError(result.code);
      } catch {
        setError("SAVE_FAILED");
      }
    });
  }
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button disabled={disabled} className="button secondary">
          {trigger || title}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-heading">
            <Dialog.Title>{draft ? t("review") : title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="icon-button"
                aria-label={t("close")}
                disabled={pending}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">
            {description || t("review")}
          </Dialog.Description>
          <form
            ref={form}
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const input = openedBuild.current(new FormData(e.currentTarget));
              const data = [
                "save_settings",
                "save_slot",
                "save_exception",
                "publish_menu",
                "invite",
                "set_role",
              ].includes(action)
                ? {
                    ...(input as object),
                    policy_version: openedPolicyVersion.current,
                  }
                : input;
              if (review) {
                setDraft(data);
                setError("");
              } else submit(data);
            }}
            style={{ display: draft ? "none" : undefined }}
          >
            {children}
            {error && (
              <p className="error" role="alert">
                <AlertCircle size={16} />
                {t("error." + error)}
              </p>
            )}
            <div className="form-actions">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="button ghost"
                  disabled={pending}
                >
                  {t("cancel")}
                </button>
              </Dialog.Close>
              <button className="button primary" disabled={pending}>
                {pending
                  ? t("saving")
                  : review
                    ? t("review")
                    : buttonLabel || t("save")}
              </button>
            </div>
          </form>
          {draft !== null && (
            <div className="stack">
              <div className="review-content">
                {openedReview.current?.(draft)}
              </div>
              {error && (
                <p className="error" role="alert">
                  {t("error." + error)}
                </p>
              )}
              <div className="form-actions">
                <button
                  className="button secondary"
                  disabled={pending}
                  onClick={() => {
                    setDraft(null);
                    key.current = "";
                  }}
                >
                  {t("back")}
                </button>
                <button
                  className="button primary"
                  disabled={pending}
                  onClick={() => submit(draft)}
                >
                  {pending ? t("saving") : t("confirm")}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </header>
  );
}
export function downloadCsv(filename: string, rows: unknown[][]) {
  const text =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let value = String(cell ?? "");
            if (/^[=+\-@\t\r]/.test(value)) value = "'" + value;
            return '"' + value.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
