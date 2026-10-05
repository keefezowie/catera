"use client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  useState,
  useRef,
  useTransition,
  useContext,
  useId,
  type ComponentPropsWithRef,
} from "react";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { X, Check, AlertCircle, ArrowUpRight, PackageOpen } from "lucide-react";
import { command } from "@/app/actions";
import { PolicyVersionContext } from "@/lib/workspace-context";
import type { Address, Grant } from "@/lib/types";
import {
  prepareCommandAttempt,
  commandOutcomeUnknown,
  type CommandAttempt,
} from "@/lib/command-attempt";
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
export function DateInput({
  value,
  defaultValue,
  onChange,
  "aria-describedby": describedBy,
  lang,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "type">) {
  const locale = useLocale(),
    fmt = useFormat(),
    captionId = useId();
  const [selected, setSelected] = useState(String(defaultValue || ""));
  const current = value !== undefined ? String(value) : selected;
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(current) &&
    Number.isFinite(new Date(current + "T12:00:00Z").getTime());
  return (
    <span className="date-input-control">
      <input
        {...props}
        type="date"
        value={value}
        defaultValue={defaultValue}
        lang={lang || (locale === "id" ? "id-ID" : "en-GB")}
        aria-describedby={
          [describedBy, valid ? captionId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(event) => {
          setSelected(event.currentTarget.value);
          onChange?.(event);
        }}
      />
      {valid && (
        <span className="date-input-caption" aria-hidden="true">
          <time id={captionId} dateTime={current}>
            {fmt.date(current)}
          </time>
        </span>
      )}
    </span>
  );
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
    <div className="quota-info">
      <div className="quota-summary">
        {(["remaining", "reserved", "available"] as const).map((k) => (
          <div key={k}>
            <strong>{sum(k)}</strong>
            <span>{t(k)}</span>
          </div>
        ))}
      </div>
      <details className="quota-help">
        <summary>{t("quotaHow")}</summary>
        <p>{t("quotaExplanation")}</p>
      </details>
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
export type FormReviewActions = {
  editFields: (values?: Record<string, string>, focus?: string) => void;
};
type RetainedField = {
  name: string;
  label: string;
  kind: string;
  value: string;
  checked: boolean;
  multiple: boolean;
  options: { value: string; label: string; selected: boolean }[];
};

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
  triggerVariant = "secondary",
  startInReview = false,
  context,
  confirmDisabled,
  layout = "default",
  validate,
  validationSummary,
}: {
  slug: string;
  action: string;
  title: string;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  build: (f: FormData) => unknown;
  description?: string;
  review?: (data: unknown, actions: FormReviewActions) => React.ReactNode;
  buttonLabel?: string;
  onDone?: () => void;
  disabled?: boolean;
  triggerVariant?: "primary" | "secondary" | "ghost" | "danger";
  startInReview?: boolean;
  context?: React.ReactNode;
  confirmDisabled?: (data: unknown) => boolean;
  layout?: "default" | "wide";
  validate?: (data: unknown) => string | undefined;
  validationSummary?: string;
}) {
  const t = useTranslations(),
    router = useRouter(),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [validation, setValidation] = useState(""),
    [errorFields, setErrorFields] = useState<string[]>([]),
    [unknownOutcome, setUnknownOutcome] = useState(false),
    [pending, start] = useTransition(),
    [draft, setDraft] = useState<unknown>(null),
    policyVersion = useContext(PolicyVersionContext),
    form = useRef<HTMLFormElement>(null),
    retainedFields = useRef<RetainedField[]>([]),
    sessionFields = useRef<RetainedField[] | null>(null),
    dialogOpen = useRef(false),
    restoring = useRef(false),
    restoreScheduled = useRef(false),
    attempt = useRef<CommandAttempt<{
      slug: string;
      action: string;
      payload: unknown;
    }> | null>(null),
    openedBuild = useRef(build),
    attemptedReview = useRef(review),
    openedPolicyVersion = useRef(policyVersion);
  function captureFields() {
    return Array.from(
      form.current?.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input[name],textarea[name],select[name]") || [],
    )
      .filter(
        (element) =>
          !(
            element instanceof HTMLInputElement &&
            ["hidden", "submit", "button"].includes(element.type)
          ),
      )
      .map((element) => ({
        name: element.name,
        label: fieldLabel(element.name, element),
        kind:
          element instanceof HTMLSelectElement
            ? "select"
            : element instanceof HTMLTextAreaElement
              ? "textarea"
              : element.type,
        value: element.value,
        checked: element instanceof HTMLInputElement && element.checked,
        multiple: element instanceof HTMLSelectElement && element.multiple,
        options:
          element instanceof HTMLSelectElement
            ? Array.from(element.options).map((option) => ({
                value: option.value,
                label: option.label,
                selected: option.selected,
              }))
            : [],
      }));
  }
  function restoreSessionFields() {
    restoreScheduled.current = false;
    if (!dialogOpen.current || !form.current || !sessionFields.current) return;
    restoring.current = true;
    const saved = sessionFields.current;
    for (const field of saved) {
      const matches = Array.from(
        form.current.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >(`[name="${CSS.escape(field.name)}"]`),
      );
      const element = ["checkbox", "radio"].includes(field.kind)
        ? matches.find((node) => node.value === field.value)
        : matches[0];
      if (!element || element.disabled) continue;
      if (
        element instanceof HTMLInputElement &&
        ["checkbox", "radio"].includes(field.kind)
      ) {
        if (
          element.checked !== field.checked &&
          (field.kind !== "radio" || field.checked)
        )
          flushSync(() => element.click());
      } else {
        if (element instanceof HTMLSelectElement && field.multiple) {
          for (const option of element.options)
            option.selected = field.options.some(
              (saved) => saved.value === option.value && saved.selected,
            );
        } else {
          const prototype =
            element instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : element instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
            element,
            field.value,
          );
        }
        // Flush each field so callbacks for controlled checkbox groups and dates
        // see the preceding state update rather than stale mounting defaults.
        flushSync(() => {
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }
    }
    restoring.current = false;
    if (validate)
      setValidation(
        validate(openedBuild.current(new FormData(form.current))) || "",
      );
  }
  function changeOpen(value: boolean, discard = false) {
    if (pending) return;
    dialogOpen.current = value;
    if (value) {
      // Keep the reviewed versions from opening the form, even if background refresh updates props.
      if (!attempt.current?.unknown && !sessionFields.current) {
        openedBuild.current = build;
        openedPolicyVersion.current = policyVersion;
      }
      if (
        startInReview &&
        !sessionFields.current &&
        (attempt.current?.unknown ? attemptedReview.current : review)
      )
        setDraft(
          attempt.current?.unknown
            ? attempt.current.data.payload
            : build(new FormData()),
        );
      if (sessionFields.current && !attempt.current?.unknown) {
        restoreScheduled.current = true;
        requestAnimationFrame(restoreSessionFields);
      }
    }
    setOpen(value);
    if (!value) {
      setError("");
      setValidation("");
      setErrorFields([]);
      setDraft(null);
      if (!attempt.current?.unknown) {
        if (discard) {
          sessionFields.current = null;
          attempt.current = null;
        } else if (!restoreScheduled.current) {
          const captured = captureFields();
          sessionFields.current = captured.length ? captured : null;
        }
        retainedFields.current = [];
      }
    }
  }
  function submit(data: unknown, recover = false) {
    if (pending || (!recover && confirmDisabled?.(data))) return;
    const input =
      recover && attempt.current
        ? attempt.current.data
        : { slug, action, payload: data };
    const planned = prepareCommandAttempt(attempt.current, input);
    if (planned.blocked) {
      setUnknownOutcome(true);
      return;
    }
    if (!recover && !planned.attempt.unknown) {
      attemptedReview.current = review;
      // Capture the actual native controls, including controlled component values
      // and unchecked choices. Keep this presentation separate from the RPC input.
      retainedFields.current = captureFields();
    }
    const currentAttempt = { ...planned.attempt, unknown: true };
    attempt.current = currentAttempt;
    setError("");
    setErrorFields([]);
    start(async () => {
      try {
        const result = await command(
          currentAttempt.data.slug,
          currentAttempt.data.action,
          currentAttempt.data.payload,
          currentAttempt.requestId,
        );
        if (result.ok) {
          setOpen(false);
          setDraft(null);
          attempt.current = null;
          retainedFields.current = [];
          sessionFields.current = null;
          dialogOpen.current = false;
          setUnknownOutcome(false);
          router.refresh();
          window.dispatchEvent(
            new CustomEvent("catera:saved", {
              detail: { action, status: (data as { status?: string })?.status },
            }),
          );
          onDone?.();
        } else {
          const unknown = commandOutcomeUnknown(
            result.code,
            planned.attempt.unknown,
          );
          attempt.current = { ...currentAttempt, unknown };
          setUnknownOutcome(unknown);
          setError(result.code);
          setErrorFields(result.fields || []);
          if (result.fields?.length) {
            setDraft(null);
            requestAnimationFrame(() => focusField(result.fields![0]));
          }
        }
      } catch {
        attempt.current = currentAttempt;
        setUnknownOutcome(true);
        setError("SAVE_FAILED");
      }
    });
  }
  function fieldElement(path: string) {
    const names = [path, path.split(".").at(-1) || path];
    for (const name of names) {
      const element = form.current?.querySelector<HTMLElement>(
        `[name="${CSS.escape(name)}"]`,
      );
      if (element) return element;
    }
  }
  function focusField(path: string) {
    const element = fieldElement(path);
    element?.scrollIntoView({ block: "nearest" });
    element?.focus();
  }
  function fieldLabel(path: string, capturedElement?: HTMLElement) {
    const element = capturedElement || fieldElement(path),
      label = element?.closest("label"),
      text =
        label &&
        Array.from(label.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent)
          .join(" ")
          .trim();
    const key = path.split(".").at(-1) || path;
    return (
      text ||
      (label && !(element instanceof HTMLSelectElement)
        ? label.textContent?.trim()
        : "") ||
      element?.getAttribute("aria-label") ||
      (t.has(key) ? t(key) : t("fieldValue"))
    );
  }
  const reviewActions: FormReviewActions = {
    editFields(values = {}, focus) {
      if (pending || unknownOutcome) return;
      setDraft(null);
      setValidation("");
      setError("");
      setErrorFields([]);
      requestAnimationFrame(() => {
        for (const [name, value] of Object.entries(values)) {
          const element = fieldElement(name);
          if (!(element instanceof HTMLInputElement)) continue;
          // Native setter lets React observe the change in controlled date fields.
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )?.set?.call(element, value);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (form.current && validate)
          setValidation(
            validate(openedBuild.current(new FormData(form.current))) || "",
          );
        if (focus) focusField(focus);
      });
    },
  };
  const feedback = (unknownOutcome || validation || error) && (
    <div className="form-feedback">
      <p className="error" role="alert">
        <AlertCircle size={16} />
        <span>
          {unknownOutcome
            ? t("saveOutcomeUnknown")
            : (validation && (validationSummary || validation)) ||
              (t.has("error." + error)
                ? t("error." + error)
                : t("error.SAVE_FAILED"))}
        </span>
      </p>
      {unknownOutcome && <p className="muted">{t("retainedAttemptContext")}</p>}
      {unknownOutcome && (
        <button
          type="button"
          className="button secondary"
          disabled={pending}
          onClick={() => submit(attempt.current?.data.payload, true)}
        >
          {pending ? t("saving") : t("previousSaveRetry")}
        </button>
      )}
      {!!errorFields.length && (
        <div className="field-error-links">
          <span>{t("checkFields")}</span>
          {errorFields.map((path) => (
            <button type="button" key={path} onClick={() => focusField(path)}>
              {fieldLabel(path)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button
          disabled={disabled || pending}
          className={"button " + triggerVariant}
        >
          {trigger || title}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={
            "dialog-content form-dialog " +
            (layout === "wide" ? "dialog-wide" : "")
          }
        >
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
          {sessionFields.current && !unknownOutcome && draft === null && (
            <p className="draft-resumed-notice" role="status">
              {t("draftResumed")}
            </p>
          )}
          <div
            className={"dialog-workspace " + (context ? "with-context" : "")}
          >
            {context && (
              <div className="form-context">
                {context}
                {unknownOutcome && (
                  <p className="recovery-context-note">
                    {t("persistedContext")}
                  </p>
                )}
              </div>
            )}
            <div className="dialog-main">
              <form
                ref={form}
                className="stack"
                onChange={() => {
                  if (restoring.current) return;
                  if (form.current && validate)
                    setValidation(
                      validate(
                        openedBuild.current(new FormData(form.current)),
                      ) || "",
                    );
                  if (error === "INVALID_INPUT") {
                    setError("");
                    setErrorFields([]);
                  }
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = openedBuild.current(
                    new FormData(e.currentTarget),
                  );
                  const invalid = validate?.(input);
                  if (invalid) {
                    setValidation(invalid);
                    return;
                  }
                  setValidation("");
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
                <div
                  className="form-fields stack"
                  role={unknownOutcome ? "region" : undefined}
                  tabIndex={unknownOutcome ? 0 : undefined}
                  aria-label={
                    unknownOutcome ? t("retainedSaveValues") : undefined
                  }
                >
                  {unknownOutcome ? (
                    <fieldset
                      disabled
                      className="stack"
                      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                    >
                      <legend className="recovery-values-title">
                        {t("attemptedChanges")}
                      </legend>
                      {retainedFields.current.map((field, index) => (
                        <label key={field.name + index}>
                          {field.label}
                          {field.kind === "select" ? (
                            <select
                              name={field.name}
                              multiple={field.multiple}
                              value={
                                field.multiple
                                  ? field.options
                                      .filter((o) => o.selected)
                                      .map((o) => o.value)
                                  : field.value
                              }
                              disabled
                            >
                              {field.options.map((option, i) => (
                                <option
                                  key={option.value + i}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : field.kind === "textarea" ? (
                            <textarea
                              name={field.name}
                              value={field.value}
                              readOnly
                              disabled
                              rows={2}
                            />
                          ) : field.kind === "date" ? (
                            <DateInput
                              name={field.name}
                              value={field.value}
                              readOnly
                              disabled
                            />
                          ) : (
                            <input
                              name={field.name}
                              type={field.kind}
                              value={field.value}
                              checked={
                                ["checkbox", "radio"].includes(field.kind)
                                  ? field.checked
                                  : undefined
                              }
                              readOnly
                              disabled
                            />
                          )}
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    children
                  )}
                </div>
                {feedback}
                <div className="form-actions">
                  <button
                    type="button"
                    className="button ghost"
                    disabled={pending}
                    onClick={() => changeOpen(false, true)}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="button primary"
                    disabled={pending || !!validation || unknownOutcome}
                  >
                    {pending
                      ? t("saving")
                      : review
                        ? t("review")
                        : buttonLabel || t("save")}
                  </button>
                </div>
              </form>
              {draft !== null && (
                <div className="stack dialog-review">
                  <div className="review-content">
                    {unknownOutcome
                      ? attemptedReview.current?.(
                          attempt.current?.data.payload,
                          reviewActions,
                        )
                      : review?.(draft, reviewActions)}
                  </div>
                  {feedback}
                  <div className="form-actions">
                    <button
                      className="button secondary"
                      disabled={pending}
                      onClick={() => {
                        if (startInReview) changeOpen(false, true);
                        else {
                          setDraft(null);
                        }
                      }}
                    >
                      {t(startInReview ? "cancel" : "back")}
                    </button>
                    <button
                      className="button primary"
                      disabled={
                        pending || unknownOutcome || !!confirmDisabled?.(draft)
                      }
                      onClick={() => submit(draft)}
                    >
                      {pending ? t("saving") : t("confirm")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
