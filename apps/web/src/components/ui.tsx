"use client";
import Link from "next/link";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ArrowRight, LoaderCircle, Check, AlertCircle } from "lucide-react";
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useId,
  createContext,
  useContext,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
import { errorLabel, statusLabel } from "@catera/domain";
import { useApp } from "./context";
import { MascotLoading } from "./mascot-loading";
import { Button } from "./form-controls";
import { FormPending, OverlayLevel, useDialogLayer } from "./overlay";
import { useExitPresence } from "./motion";
const DialogBusy = createContext<((change: number) => void) | null>(null);
const focusReturns = new WeakMap<HTMLElement, HTMLElement[]>();
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link
      href="/"
      className={"brand " + (small ? "small" : "")}
      aria-label="Catera — Good Food on Repeat"
    >
      <Image
        src="/assets/wordmark.png"
        alt="Catera"
        width={180}
        height={60}
        sizes="180px"
      />
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
  const { t } = useApp();
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={20} />
      <div>
        {message}
        {retry && (
          <Button variant="text" onClick={retry}>
            {t("Coba lagi", "Try again")}
          </Button>
        )}
      </div>
    </div>
  );
}
export function RefreshNotice({
  error,
  reload,
}: {
  error: string;
  reload: () => void;
}) {
  const { t } = useApp();
  return error ? (
    <ErrorNotice
      message={
        t("Tampilan belum diperbarui. ", "This view could not be refreshed. ") +
        error
      }
      retry={reload}
    />
  ) : null;
}
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
  closeLabel,
  onCloseAutoFocus,
  onOpenAutoFocus,
  size = "form",
  busy = false,
  id,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  onCloseAutoFocus?: (event: Event) => void;
  onOpenAutoFocus?: (event: Event) => void;
  size?: "confirmation" | "form" | "editor" | "media";
  busy?: boolean;
  id?: string;
}) {
  const { t } = useApp();
  const present = useExitPresence(open);
  const { level, inactive } = useDialogLayer(present);
  const returnTargets = useRef<HTMLElement[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const target = document.activeElement;
    if (target instanceof HTMLElement) {
      const parent = target.closest<HTMLElement>(".dialog");
      returnTargets.current = [
        target,
        ...(parent ? focusReturns.get(parent) || [] : []),
      ];
    }
  }, [open]);
  const [pendingForms, setPendingForms] = useState(0);
  const changeBusy = useCallback(
    (change: number) => setPendingForms((count) => Math.max(0, count + change)),
    [],
  );
  const pending = busy || pendingForms > 0;
  return (
    <DialogPrimitive.Root
      open={present}
      onOpenChange={(next) => {
        if (!pending && !inactive && (open || next)) onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="dialog-overlay"
          data-motion-state={open ? "open" : "closed"}
          style={{ zIndex: level }}
        />
        <DialogPrimitive.Content
          id={id}
          ref={panel}
          className={"dialog dialog-" + size + " " + className}
          style={{ zIndex: level + 1 }}
          data-dialog-size={size}
          data-motion-state={open ? "open" : "closed"}
          onClickCapture={(event) => {
            if (!open) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onSubmitCapture={(event) => {
            // Exit presence retains forms briefly after dismissal; they must not submit.
            if (!open) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          inert={inactive || undefined}
          aria-busy={pending || undefined}
          {...(!description ? { "aria-describedby": undefined } : {})}
          onInteractOutside={(event) => {
            if (!open || size === "confirmation" || pending || inactive)
              event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (!open || pending || inactive) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            if (panel.current)
              focusReturns.set(panel.current, returnTargets.current);
            onOpenAutoFocus?.(event);
            if (event.defaultPrevented) return;
            if (size === "confirmation") {
              event.preventDefault();
              (
                panel.current?.querySelector<HTMLElement>(
                  "[data-dialog-safe]",
                ) ||
                panel.current?.querySelector<HTMLElement>(".close") ||
                panel.current
              )?.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented) {
              event.preventDefault();
              // Both child and parent can unmount together (discard/save).
              // Wait for Radix to release focus traps and parent inert state.
              const targets = returnTargets.current;
              requestAnimationFrame(() => {
                targets
                  .find(
                    (target) =>
                      target.isConnected && !target.closest("[inert]"),
                  )
                  ?.focus({ preventScroll: true });
              });
            }
          }}
        >
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description>
              {description}
            </DialogPrimitive.Description>
          )}
          <DialogPrimitive.Close
            className="icon-button close"
            disabled={pending || !open}
            aria-label={closeLabel || t("Tutup", "Close")}
          >
            <X size={20} />
          </DialogPrimitive.Close>
          <OverlayLevel.Provider value={level + 1}>
            <DialogBusy.Provider value={changeBusy}>
              {size === "editor" &&
              !className.split(" ").includes("package-dialog") ? (
                <div className="dialog-body">{children}</div>
              ) : (
                children
              )}
            </DialogBusy.Provider>
          </OverlayLevel.Provider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function ActionForm({
  onSubmit,
  children,
  submit,
  className = "",
  disabled = false,
  noValidate = false,
  submitIcon,
  actions,
  successMessage,
  onPendingChange,
  onDirtyChange,
  validate,
}: {
  onSubmit: (f: FormData) => Promise<void>;
  children: ReactNode;
  submit?: string;
  className?: string;
  disabled?: boolean;
  noValidate?: boolean;
  submitIcon?: ReactNode;
  actions?: (submitButton: ReactNode, busy: boolean) => ReactNode;
  successMessage?: string;
  onPendingChange?: (pending: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  validate?: (form: FormData) => string | undefined;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { t, locale } = useApp();
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const changeDialogBusy = useContext(DialogBusy);
  useEffect(() => {
    onPendingChange?.(busy);
    return () => {
      if (busy) onPendingChange?.(false);
    };
  }, [busy, onPendingChange]);
  useEffect(() => {
    if (!busy || !changeDialogBusy) return;
    changeDialogBusy(1);
    return () => changeDialogBusy(-1);
  }, [busy, changeDialogBusy]);
  useEffect(() => {
    if (!error) return;
    const field = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    if (field) {
      let parent = field.parentElement;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
    }
    (field || errorRef.current)?.focus();
  }, [error]);
  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current || disabled) return;
    submitting.current = true;
    const f = new FormData(e.currentTarget);
    const validation = validate?.(f);
    if (validation) {
      setError(validation);
      submitting.current = false;
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await onSubmit(f);
      onDirtyChange?.(false);
      setSaved(true);
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
            : errorLabel(code, locale) ||
              t(
                "Belum berhasil. Silakan coba lagi.",
                "It did not work. Please try again.",
              ),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const submitButton = (
    <Button
      type="submit"
      variant="primary"
      className="form-submit"
      data-pending={busy}
      disabled={busy || disabled}
    >
      <span className="form-submit-label" aria-hidden={busy}>
        {submitIcon || <Check size={17} aria-hidden="true" />}
        {submit || t("Simpan", "Save")}
      </span>
      <span className="form-submit-pending" aria-hidden={!busy}>
        <LoaderCircle className="spin" size={18} aria-hidden="true" />
        {t("Memproses…", "Processing…")}
      </span>
    </Button>
  );
  return (
    <form
      ref={formRef}
      onSubmit={handle}
      noValidate={noValidate}
      aria-busy={busy || undefined}
      className={"form " + className}
      onChange={() => {
        setSaved(false);
        onDirtyChange?.(true);
      }}
    >
      <FormPending.Provider value={busy}>{children}</FormPending.Provider>
      {error && (
        <div ref={errorRef} tabIndex={-1} className="form-error">
          <ErrorNotice message={error} />
        </div>
      )}
      {saved && successMessage && (
        <p className="save-status" role="status">
          <Check size={18} aria-hidden="true" />
          {successMessage}
        </p>
      )}
      {actions ? actions(submitButton, busy) : submitButton}
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
