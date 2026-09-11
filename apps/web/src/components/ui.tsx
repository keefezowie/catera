"use client";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ArrowRight, LoaderCircle, Check, AlertCircle } from "lucide-react";
import {
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
import { errors, statusLabel } from "@catera/domain";
import { useApp } from "./context";
import { MascotLoading } from "./mascot-loading";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link
      href="/"
      className={"brand " + (small ? "small" : "")}
      aria-label="Catera — Good Food on Repeat"
    >
      <img src="/assets/wordmark.png" alt="Catera" width="2172" height="724" />
    </Link>
  );
}
export function Status({ status }: { status: string }) {
  const { locale } = useApp();
  return (
    <span className={"status status-" + status}>
      <span />
      {statusLabel(status, locale)}
    </span>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <img src="/assets/empty-calendar.png" alt="" width="160" height="160" />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {href && (
        <Link className="button" href={href}>
          {label}
          <ArrowRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function Loading() {
  const { locale } = useApp();
  return (
    <MascotLoading
      label={
        locale === "en"
          ? "Getting Catera ready for you…"
          : "Menyiapkan Catera untuk Anda…"
      }
    />
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={20} />
      <div>
        {message}
        {retry && (
          <button className="text-button" onClick={retry}>
            Coba lagi
          </button>
        )}
      </div>
    </div>
  );
}
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
  closeLabel = "Tutup",
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className={"dialog " + className}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description>
            {description || "Periksa detail sebelum menyimpan perubahan."}
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            className="icon-button close"
            aria-label={closeLabel}
          >
            <X size={20} />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function ActionForm({
  onSubmit,
  children,
  submit = "Simpan",
  className = "",
  disabled = false,
  noValidate = false,
}: {
  onSubmit: (f: FormData) => Promise<void>;
  children: ReactNode;
  submit?: string;
  className?: string;
  disabled?: boolean;
  noValidate?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { t } = useApp();
  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || disabled) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSubmit(f);
    } catch (e) {
      const code =
        (e as { code?: string; message?: string }).code || (e as Error).message;
      setError(
        code === "INVALID_CREDENTIALS"
          ? t(
              "Email atau kata sandi tidak cocok. Silakan coba lagi.",
              "Email or password is incorrect. Please try again.",
            )
          : code === "AUTH_RATE_LIMITED"
            ? t(
                "Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.",
                "Too many sign-in attempts. Please wait and try again.",
              )
            : errors[code] || code || "Belum berhasil. Silakan coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={handle}
      noValidate={noValidate}
      className={"form " + className}
    >
      {children}
      {error && <ErrorNotice message={error} />}
      <button type="submit" className="button" disabled={busy || disabled}>
        {busy ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <Check size={17} />
        )}{" "}
        {busy ? t("Memproses…", "Processing…") : submit}
      </button>
    </form>
  );
}
export function Field({
  label,
  children,
  error,
  fieldKey,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  fieldKey?: string;
}) {
  const errorId = useId();
  const control = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{
          "aria-invalid"?: boolean;
          "aria-describedby"?: string;
          "aria-labelledby"?: string;
        }>,
        {
          "aria-labelledby": errorId + "-label",
          ...(error
            ? { "aria-invalid": true, "aria-describedby": errorId }
            : {}),
        },
      )
    : children;
  return (
    <label className="field" data-editor-field={fieldKey}>
      <span id={errorId + "-label"}>{label}</span>
      {control}
      {error && (
        <small id={errorId} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="facts">
      {rows.map(([a, b]) => (
        <div key={a}>
          <dt>{a}</dt>
          <dd>{b}</dd>
        </div>
      ))}
    </dl>
  );
}
