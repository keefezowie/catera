"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Plus,
  ArrowUpRight,
  Search,
  Mail,
  CalendarDays,
  ArrowLeft,
} from "lucide-react";
import type {
  Snapshot,
  Customer,
  Package,
  Menu,
  Address,
  Pattern,
} from "@/lib/types";
import {
  PageHeading,
  FormDialog,
  DateInput,
  type FormReviewActions,
  AddressFields,
  addressFrom,
  Quota,
  Empty,
  Status,
  useFormat,
} from "./ui";
import { previewSchedule, type ScheduleInput } from "@/lib/scheduling";
const value = (f: FormData, key: string) => String(f.get(key) || "");
function businessDate(s: Snapshot) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: s.business.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(s.now));
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)?.value)
    .join("-");
}
function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function cutoffElapsed(s: Snapshot, date: string) {
  const exception = s.exceptions.find((e) => e.service_date === date);
  if (exception?.cutoff_at)
    return new Date(s.now) >= new Date(exception.cutoff_at);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: s.business.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(s.now));
  const time = ["hour", "minute", "second"]
    .map((key) => parts.find((p) => p.type === key)?.value)
    .join(":");
  return (
    businessDate(s) + "T" + time >=
    addDays(date, -1) + "T" + s.business.cutoff.padEnd(8, ":00")
  );
}
function scheduleDefaults(s: Snapshot, c: Customer) {
  const tomorrow = addDays(businessDate(s), 1);
  const earliest = cutoffElapsed(s, tomorrow) ? addDays(tomorrow, 1) : tomorrow;
  const grants = s.grants.filter(
    (g) =>
      g.customer_id === c.id &&
      g.remaining > g.reserved &&
      (!g.expires_on || g.expires_on >= earliest),
  );
  const starts =
    grants
      .map((g) => (g.starts_on > earliest ? g.starts_on : earliest))
      .sort()[0] || earliest;
  const weekEnd = addDays(starts, 6);
  const eligible = grants.filter(
    (g) => g.starts_on <= weekEnd && (!g.expires_on || g.expires_on >= starts),
  );
  // A later grant can fund later dates; the earliest expiry is not a universal deadline.
  const lastExpiry = eligible.some((g) => !g.expires_on)
    ? null
    : eligible
        .map((g) => g.expires_on!)
        .sort()
        .at(-1);
  return {
    starts,
    ends: lastExpiry && lastExpiry < weekEnd ? lastExpiry : weekEnd,
    capacity: grants.length > 0,
  };
}
function CustomerContext({ c }: { c: Customer }) {
  const t = useTranslations();
  return (
    <section
      className="record-customer-context"
      aria-label={t("scheduleCustomerContext")}
    >
      <h3>{c.name}</h3>
      <p>{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
      <div className="record-saved-address">
        <h4>{t("savedStartingAddress")}</h4>
        <p>
          {c.address.line}
          <br />
          {c.address.city}
        </p>
        {c.address.instructions && <p>{c.address.instructions}</p>}
      </div>
    </section>
  );
}
function ScheduleContext({ s, c }: { s: Snapshot; c: Customer }) {
  const t = useTranslations(),
    fmt = useFormat();
  const grants = s.grants.filter((g) => g.customer_id === c.id);
  return (
    <section
      className="schedule-context"
      aria-label={t("scheduleCustomerContext")}
    >
      <h3>{c.name}</h3>
      <p className="schedule-customer-contact">
        {[c.email, c.phone].filter(Boolean).join(" · ")}
      </p>
      <div className="quota-summary">
        {(["remaining", "reserved", "available"] as const).map((key) => (
          <div key={key}>
            <strong>{grants.reduce((total, g) => total + g[key], 0)}</strong>
            <span>{t(key)}</span>
          </div>
        ))}
      </div>
      {grants.length > 0 && (
        <div className="schedule-validity">
          <strong>{t("packageValidity")}</strong>
          <ul>
            {grants.map((g) => (
              <li key={g.id}>
                <strong>
                  {s.purchases.find((p) => p.id === g.purchase_id)?.terms
                    .name || t("purchasedPackage")}
                </strong>
                <span>
                  {fmt.date(g.starts_on)} →{" "}
                  {g.expires_on ? fmt.date(g.expires_on) : t("noExpiry")}
                </span>
                <small>
                  {Math.max(0, g.remaining - g.reserved)}{" "}
                  {t("unreservedDeliveries")}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="schedule-allocation-help">
        <summary>{t("scheduleAllocationHow")}</summary>
        <p>{t("quotaExplanation")}</p>
        <p>{t("scheduleValidityHelp")}</p>
      </details>
    </section>
  );
}
function scheduleBounds(s: Snapshot, c: Customer, pattern?: Pattern) {
  const grants = s.grants.filter((g) => g.customer_id === c.id);
  const latest = grants.some((g) => !g.expires_on)
    ? undefined
    : grants
        .map((g) => g.expires_on!)
        .sort()
        .at(-1);
  return {
    // Retained recurrence dates may be historical; only added/removed occurrences need an open cutoff.
    min: pattern ? undefined : grants.map((g) => g.starts_on).sort()[0],
    max:
      latest && pattern && pattern.ends_on > latest ? pattern.ends_on : latest,
  };
}
function scheduleFormError(s: Snapshot, input: ScheduleInput, p?: Pattern) {
  if (!input.starts_on || !input.ends_on) return "scheduleDatesRequired";
  if (input.ends_on < input.starts_on) return "scheduleRangeError";
  if (!input.weekdays.length) return "scheduleWeekdaysRequired";
  if (!input.slot_ids.length) return "scheduleSlotsRequired";
  const { rows, removed } = p
    ? revisionPreview(s, input, p)
    : { rows: previewSchedule(s, input), removed: [] };
  if (
    rows.some((row) => cutoffElapsed(s, row.date)) ||
    removed.some((d) => new Date(s.now) >= new Date(d.cutoff_at))
  )
    return "scheduleCutoffHelp";
  // Quantity shortages remain reviewable; dates outside every grant's validity cannot be funded.
  if (
    rows.some(
      (row) =>
        !s.grants.some(
          (g) =>
            g.customer_id === input.customer_id &&
            g.starts_on <= row.date &&
            (!g.expires_on || g.expires_on >= row.date),
        ),
    )
  )
    return "scheduleValidityError";
  return undefined;
}
function ScheduleFields({
  s,
  c,
  pattern,
}: {
  s: Snapshot;
  c: Customer;
  pattern?: Pattern;
}) {
  const t = useTranslations(),
    locale = useLocale(),
    id = useId(),
    defaults = scheduleDefaults(s, c),
    bounds = scheduleBounds(s, c, pattern);
  const [starts, setStarts] = useState(pattern?.starts_on || defaults.starts),
    [ends, setEnds] = useState(pattern?.ends_on || defaults.ends),
    [weekdays, setWeekdays] = useState(pattern?.weekdays || [1, 2, 3, 4, 5]),
    [slots, setSlots] = useState(
      pattern?.slots ||
        s.slots
          .filter((slot) => slot.active)
          .slice(0, 1)
          .map((slot) => slot.id),
    );
  const input = {
    customer_id: c.id,
    starts_on: starts,
    ends_on: ends,
    weekdays,
    slot_ids: slots,
  };
  const error = scheduleFormError(s, input, pattern);
  const dateError =
    error &&
    !["scheduleWeekdaysRequired", "scheduleSlotsRequired"].includes(error);
  return (
    <>
      <div className="form-grid schedule-date-fields">
        <label>
          {t("scheduleStartsOn")}
          <DateInput
            aria-label={t("scheduleStartsOn")}
            name="starts_on"
            required
            min={bounds.min}
            max={bounds.max}
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={id + "-dates"}
          />
        </label>
        <label>
          {t("endsOn")}
          <DateInput
            aria-label={t("endsOn")}
            name="ends_on"
            required
            min={starts || bounds.min}
            max={bounds.max}
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={id + "-dates"}
          />
        </label>
      </div>
      <p
        id={id + "-dates"}
        className={
          dateError ? "error schedule-field-help" : "muted schedule-field-help"
        }
        aria-live="polite"
      >
        {t(
          dateError
            ? error
            : pattern
              ? "scheduleRevisionDateHelp"
              : "scheduleDateHelp",
        )}
      </p>
      <fieldset
        aria-describedby={!weekdays.length ? id + "-weekdays" : undefined}
      >
        <legend>{t("weekdays")}</legend>
        <div className="weekday-options">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <label key={day}>
              <input
                type="checkbox"
                name="weekdays"
                value={day}
                checked={weekdays.includes(day)}
                onChange={(e) =>
                  setWeekdays(
                    e.target.checked
                      ? [...weekdays, day]
                      : weekdays.filter((value) => value !== day),
                  )
                }
              />
              {new Intl.DateTimeFormat(locale, {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2026, 8, 6 + day)))}
            </label>
          ))}
        </div>
        {!weekdays.length && (
          <p
            id={id + "-weekdays"}
            className="error schedule-field-help"
            role="alert"
          >
            {t("scheduleWeekdaysRequired")}
          </p>
        )}
      </fieldset>
      <fieldset aria-describedby={!slots.length ? id + "-slots" : undefined}>
        <legend>{t("slots")}</legend>
        <div className="schedule-slot-options">
          {s.slots
            .filter((slot) => slot.active)
            .map((slot) => (
              <label className="checkbox-row" key={slot.id}>
                <input
                  type="checkbox"
                  name="slot_ids"
                  value={slot.id}
                  checked={slots.includes(slot.id)}
                  onChange={(e) =>
                    setSlots(
                      e.target.checked
                        ? [...slots, slot.id]
                        : slots.filter((value) => value !== slot.id),
                    )
                  }
                />
                {slot.name}
              </label>
            ))}
        </div>
        {!slots.length && (
          <p
            id={id + "-slots"}
            className="error schedule-field-help"
            role="alert"
          >
            {t("scheduleSlotsRequired")}
          </p>
        )}
      </fieldset>
    </>
  );
}
function revisionPreview(s: Snapshot, input: ScheduleInput, p: Pattern) {
  const copy = structuredClone(s);
  const removed = copy.deliveries.filter(
    (d) =>
      d.pattern_id === p.id &&
      d.service_date >= input.starts_on &&
      !["cancelled", "delivered"].includes(d.status) &&
      (d.service_date > input.ends_on ||
        !input.weekdays.includes(
          new Date(d.service_date + "T12:00:00Z").getUTCDay(),
        ) ||
        !input.slot_ids.includes(d.slot_id)),
  );
  for (const d of removed) {
    d.status = "cancelled";
    const grant = copy.grants.find((g) => g.id === d.grant_id);
    if (grant) grant.reserved -= 1;
  }
  return { removed, rows: previewSchedule(copy, input) };
}
function AllocationReview({
  s,
  rows,
  editFields,
  allowShorten = false,
}: {
  s: Snapshot;
  rows: ReturnType<typeof previewSchedule>;
  editFields?: FormReviewActions["editFields"];
  allowShorten?: boolean;
}) {
  const t = useTranslations(),
    fmt = useFormat();
  const allocated = rows.filter((r) => r.grant_id).length;
  const elapsed = rows.some((r) => cutoffElapsed(s, r.date));
  const firstShortfall = rows.find((row) => !row.grant_id);
  // A date with only some funded slots cannot be proposed as a fully funded endpoint.
  const lastFundedDate = firstShortfall
    ? rows
        .filter((row) => row.date < firstShortfall.date && row.grant_id)
        .at(-1)?.date
    : undefined;
  return (
    <>
      <dl className="allocation-summary" aria-live="polite" aria-atomic="true">
        <div>
          <dt>{t("requiredDeliveries")}</dt>
          <dd>{rows.length}</dd>
        </div>
        <div>
          <dt>{t("allocatableDeliveries")}</dt>
          <dd>{allocated}</dd>
        </div>
        <div>
          <dt>{t("unallocatedDeliveries")}</dt>
          <dd>{rows.length - allocated}</dd>
        </div>
      </dl>
      {firstShortfall && (
        <div className="schedule-repair">
          <p className="error" role="alert">
            {t("insufficientPreview")}
          </p>
          <p>
            {t("scheduleFirstShortfall", {
              date: fmt.date(firstShortfall.date, true),
              slot:
                s.slots.find((slot) => slot.id === firstShortfall.slot_id)
                  ?.name || "",
            })}
          </p>
          {editFields && (
            <>
              <div className="schedule-repair-actions">
                {allowShorten && lastFundedDate && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      editFields({ ends_on: lastFundedDate }, "ends_on")
                    }
                  >
                    {t("scheduleUseFundedEnd", {
                      date: fmt.date(lastFundedDate),
                    })}
                  </button>
                )}
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => editFields({}, "ends_on")}
                >
                  {t("scheduleRepairChoices")}
                </button>
              </div>
              <p className="muted">
                {t(
                  allowShorten
                    ? "scheduleRepairReviewHelp"
                    : "scheduleRevisionRepairHelp",
                )}
              </p>
            </>
          )}
        </div>
      )}
      {elapsed && (
        <p className="error" role="alert">
          {t("scheduleCutoffHelp")}
        </p>
      )}
      <ul
        className="schedule-preview"
        tabIndex={0}
        aria-label={t("scheduleAllocationDatesLabel")}
      >
        {rows.map((r) => (
          <li key={r.date + r.slot_id}>
            <span>
              <time dateTime={r.date}>{fmt.date(r.date, true)}</time> ·{" "}
              {s.slots.find((x) => x.id === r.slot_id)?.name}
            </span>
            <span>
              {r.grant_id ? t("allocationReady") : t("allocationMissing")}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
function CustomerForm({ s, c }: { s: Snapshot; c?: Customer }) {
  const t = useTranslations();
  return (
    <FormDialog
      slug={s.business.slug}
      action="save_customer"
      layout="wide"
      context={c ? <CustomerContext c={c} /> : undefined}
      description={t(
        c ? "customerEditDescription" : "customerCreateDescription",
      )}
      title={t(c ? "edit" : "newCustomer")}
      triggerVariant={c ? "ghost" : "primary"}
      trigger={
        c ? (
          t("edit")
        ) : (
          <>
            <Plus size={17} />
            {t("newCustomer")}
          </>
        )
      }
      build={(f) => ({
        ...(c ? { id: c.id, version: c.version } : {}),
        name: value(f, "name"),
        email: value(f, "email"),
        phone: value(f, "phone"),
        address: addressFrom(f),
      })}
    >
      <label>
        {t("name")}
        <input name="name" defaultValue={c?.name} required />
      </label>
      <div className="form-grid">
        <label>
          {t("email")}
          <input name="email" type="email" defaultValue={c?.email} />
        </label>
        <label>
          {t("phone")}
          <input name="phone" defaultValue={c?.phone} />
        </label>
      </div>
      <AddressFields address={c?.address} />
    </FormDialog>
  );
}
export function PurchaseForm({
  s,
  c,
  primary = false,
}: {
  s: Snapshot;
  c: Customer;
  primary?: boolean;
}) {
  const t = useTranslations(),
    fmt = useFormat();
  return (
    <FormDialog
      slug={s.business.slug}
      action="purchase"
      layout="wide"
      context={<CustomerContext c={c} />}
      title={t("recordPurchase")}
      triggerVariant={primary ? "primary" : "secondary"}
      description={t("purchaseDescription")}
      build={(f) => ({
        customer_id: c.id,
        package_id: value(f, "package_id"),
        starts_on: value(f, "starts_on"),
        external_reference: value(f, "external_reference"),
      })}
      review={(v) => {
        const d = v as {
          package_id: string;
          starts_on: string;
          external_reference: string;
        };
        const p = s.packages.find((x) => x.id === d.package_id);
        const expires = p?.validity_days
          ? addDays(d.starts_on, p.validity_days - 1)
          : null;
        return (
          <dl className="purchase-review">
            <div>
              <dt>{t("purchasedPackage")}</dt>
              <dd>{p?.name}</dd>
            </div>
            <div>
              <dt>{t("purchaseQuotaAdded")}</dt>
              <dd>
                +{p?.deliveries} {t("deliveriesUnit")}
              </dd>
            </div>
            <div>
              <dt>{t("packageValidity")}</dt>
              <dd>
                <span className="purchase-validity-range">
                  {fmt.date(d.starts_on)} →{" "}
                  {expires ? fmt.date(expires) : t("noExpiry")}
                </span>
                {p?.validity_days && (
                  <small>
                    {t("purchaseValidForDays", { days: p.validity_days })}
                  </small>
                )}
              </dd>
            </div>
            <div>
              <dt>{t("externalReference")}</dt>
              <dd className="purchase-reference">
                {d.external_reference || t("purchaseReferenceEmpty")}
              </dd>
            </div>
          </dl>
        );
      }}
    >
      <label>
        {t("purchasedPackage")}
        <select name="package_id" required>
          <option value="">{t("choose")}</option>
          {s.packages
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.deliveries}
              </option>
            ))}
        </select>
      </label>
      <label>
        {t("startsOn")}
        <DateInput
          aria-label={t("startsOn")}
          name="starts_on"
          required
          defaultValue={businessDate(s)}
        />
      </label>
      <label>
        {t("externalReference")}
        <input name="external_reference" />
      </label>
    </FormDialog>
  );
}
export function ScheduleForm({
  s,
  c,
  primary = true,
}: {
  s: Snapshot;
  c: Customer;
  primary?: boolean;
}) {
  const t = useTranslations();
  return (
    <FormDialog
      slug={s.business.slug}
      action="generate_schedule"
      layout="wide"
      validate={(v) => {
        const error = scheduleFormError(s, v as ScheduleInput);
        return error ? t(error) : undefined;
      }}
      title={t("createSchedule")}
      description={t("scheduleDraftHelp")}
      validationSummary={t("scheduleCheckFields")}
      triggerVariant={primary ? "primary" : "secondary"}
      context={<ScheduleContext s={s} c={c} />}
      confirmDisabled={(v) => {
        const rows = previewSchedule(s, v as ScheduleInput);
        return (
          !rows.length ||
          rows.some((r) => !r.grant_id || cutoffElapsed(s, r.date))
        );
      }}
      build={(f) => ({
        customer_id: c.id,
        starts_on: value(f, "starts_on"),
        ends_on: value(f, "ends_on"),
        weekdays: f.getAll("weekdays").map(Number),
        slot_ids: f.getAll("slot_ids").map(String),
      })}
      review={(v, { editFields }) => {
        const rows = previewSchedule(s, v as ScheduleInput);
        return (
          <>
            {!rows.length && (
              <p className="error" role="alert">
                {t("scheduleEmptyPreview")}
              </p>
            )}
            <AllocationReview
              s={s}
              rows={rows}
              editFields={editFields}
              allowShorten
            />
            <p className="muted">{t("skipExisting")}</p>
          </>
        );
      }}
    >
      <ScheduleFields s={s} c={c} />
    </FormDialog>
  );
}
export function Customers({ s, id }: { s: Snapshot; id?: string }) {
  const t = useTranslations(),
    fmt = useFormat(),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    c = s.customers.find((c) => c.id === id),
    base = "/w/" + s.business.slug + "/admin/";
  if (id && !c) return <Empty title={t("notFound")} />;
  if (c) {
    const grants = s.grants.filter((g) => g.customer_id === c.id),
      deliveries = s.deliveries.filter((d) => d.customer_id === c.id),
      capacity = scheduleDefaults(s, c).capacity;
    return (
      <>
        <Link className="back-link" href={base + "customers"}>
          <ArrowLeft size={16} />
          {t("customers")}
        </Link>
        <PageHeading
          title={c.name}
          description={[c.email, c.phone].filter(Boolean).join(" · ")}
        >
          <CustomerForm s={s} c={c} />
          <PurchaseForm s={s} c={c} primary={!capacity} />
          <ScheduleForm s={s} c={c} primary={capacity} />
        </PageHeading>
        <div className="customer-next-step">
          <h2>
            {t(
              !grants.length
                ? "customerBeginTitle"
                : capacity
                  ? "customerScheduleTitle"
                  : "customerTopUpTitle",
            )}
          </h2>
          <p>
            {t(
              !grants.length
                ? "customerBeginHelp"
                : capacity
                  ? "customerScheduleHelp"
                  : "customerTopUpHelp",
            )}
          </p>
        </div>
        <section className="account-overview">
          <div>
            <h2>{t("quota")}</h2>
            <Quota grants={grants} />
          </div>
          <div>
            <h3>{t("address")}</h3>
            <p>
              {c.address.line}
              <br />
              {c.address.city}
            </p>
            <small>{c.address.instructions}</small>
          </div>
        </section>
        <h2 className="section-heading">{t("schedule")}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("date")}</th>
                <th>{t("slots")}</th>
                <th>{t("meal")}</th>
                <th>{t("status")}</th>
                <th>
                  <span className="sr-only">{t("viewDetails")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>{fmt.date(d.service_date, true)}</td>
                  <td>{s.slots.find((x) => x.id === d.slot_id)?.name}</td>
                  <td>{d.menu_name || t("menuMissing")}</td>
                  <td>
                    <Status status={d.status} />
                  </td>
                  <td>
                    <Link
                      className="icon-button"
                      href={base + "deliveries/" + d.id}
                      aria-label={t("viewDetails")}
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(s.patterns || [])
          .filter((p) => p.customer_id === c.id)
          .map((p) => (
            <RecurringForm key={p.id} s={s} c={c} pattern={p} />
          ))}
        <PackageHistory s={s} customerId={c.id} />
        {s.role === "owner" && grants.length > 0 && (
          <details className="owner-adjustments">
            <summary>{t("ownerAdjustments")}</summary>
            <p className="muted">{t("ownerAdjustmentsHelp")}</p>
            <FormDialog
              slug={s.business.slug}
              action="adjust_quota"
              title={t("adjustQuota")}
              build={(f) => ({
                grant_id: value(f, "grant_id"),
                amount: Number(f.get("amount")),
                reason: value(f, "reason"),
              })}
              review={(v) => (
                <p>
                  {(v as { amount: number }).amount > 0 ? "+" : ""}
                  {(v as { amount: number }).amount} {t("deliveriesUnit")}
                  <br />
                  {(v as { reason: string }).reason}
                </p>
              )}
            >
              <label>
                {t("purchasedPackage")}
                <select name="grant_id">
                  {grants.map((g) => (
                    <option key={g.id} value={g.id}>
                      {
                        s.purchases.find((p) => p.id === g.purchase_id)?.terms
                          .name
                      }{" "}
                      · {fmt.date(g.starts_on, true)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("amount")}
                <input name="amount" type="number" required step="1" />
              </label>
              <label>
                {t("reason")}
                <textarea name="reason" required />
              </label>
            </FormDialog>
          </details>
        )}
      </>
    );
  }
  const rows = s.customers.filter((c) =>
    (c.name + " " + c.email + " " + c.phone)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={t("customers")}
        description={t("customersDescription")}
      >
        <CustomerForm s={s} />
      </PageHeading>
      <section className="list-surface">
        <div className="list-toolbar">
          <h2>
            {s.customers.length} {t("customers").toLowerCase()}
          </h2>
          <label className="search-control">
            <Search size={17} />
            <input
              aria-label={t("customerSearch")}
              placeholder={t("customerSearch")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
        </div>
        {!rows.length ? (
          <Empty title={t("noRecords")} description={t("noRecordsHint")} />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("customer")}</th>
                    <th>{t("email")}</th>
                    <th>{t("remaining")}</th>
                    <th>{t("reserved")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(page * 20, page * 20 + 20).map((c) => {
                    const g = s.grants.filter((g) => g.customer_id === c.id);
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link
                            className="customer-link"
                            href={base + "customers/" + c.id}
                          >
                            <span className="customer-avatar">
                              {c.name.slice(0, 1)}
                            </span>
                            <strong>{c.name}</strong>
                          </Link>
                        </td>
                        <td>{c.email || "—"}</td>
                        <td>{g.reduce((n, x) => n + x.remaining, 0)}</td>
                        <td>{g.reduce((n, x) => n + x.reserved, 0)}</td>
                        <td>
                          <Link
                            href={base + "customers/" + c.id}
                            className="icon-button"
                            aria-label={t("viewDetails")}
                          >
                            <ArrowUpRight size={18} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {rows.length} {t("customers")}
              </span>
              <div>
                <button
                  className="button ghost"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  {t("previous")}
                </button>
                <span>{page + 1}</span>
                <button
                  className="button ghost"
                  disabled={(page + 1) * 20 >= rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  {t("next")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
function RecurringForm({
  s,
  c,
  pattern: p,
}: {
  s: Snapshot;
  c: Customer;
  pattern: Pattern;
}) {
  const t = useTranslations(),
    fmt = useFormat();
  return (
    <div className="recurrence-controls">
      <span>
        {fmt.date(p.starts_on, true)} — {fmt.date(p.ends_on, true)}
      </span>
      <FormDialog
        slug={s.business.slug}
        action="revise_schedule"
        layout="wide"
        validate={(v) => {
          const error = scheduleFormError(s, v as ScheduleInput, p);
          return error ? t(error) : undefined;
        }}
        title={t("editSchedule")}
        description={t("skipExisting")}
        validationSummary={t("scheduleCheckFields")}
        build={(f) => ({
          id: p.id,
          version: p.version,
          customer_id: c.id,
          starts_on: value(f, "starts_on"),
          ends_on: value(f, "ends_on"),
          weekdays: f.getAll("weekdays").map(Number),
          slot_ids: f.getAll("slot_ids").map(String),
        })}
        triggerVariant="secondary"
        context={<ScheduleContext s={s} c={c} />}
        confirmDisabled={(v) => {
          const { removed, rows } = revisionPreview(s, v as ScheduleInput, p);
          return (
            !(rows.length + removed.length) ||
            rows.some((r) => !r.grant_id || cutoffElapsed(s, r.date)) ||
            removed.some((d) => new Date(s.now) >= new Date(d.cutoff_at))
          );
        }}
        review={(v, { editFields }) => {
          const { removed, rows } = revisionPreview(s, v as ScheduleInput, p);
          return (
            <>
              <h3>
                {t("skip")}: {removed.length}
              </h3>
              <ul
                className="schedule-preview"
                tabIndex={0}
                aria-label={t("scheduleRemovedDeliveriesLabel")}
              >
                {removed.map((d) => (
                  <li key={d.id}>
                    {fmt.date(d.service_date, true)} ·{" "}
                    {s.slots.find((x) => x.id === d.slot_id)?.name}
                  </li>
                ))}
              </ul>
              {removed.some(
                (d) => new Date(s.now) >= new Date(d.cutoff_at),
              ) && (
                <p className="error" role="alert">
                  {t("scheduleCutoffHelp")}
                </p>
              )}
              {!rows.length && !removed.length && (
                <p className="error" role="alert">
                  {t("scheduleEmptyPreview")}
                </p>
              )}
              <AllocationReview s={s} rows={rows} editFields={editFields} />
              <p className="muted">{t("skipExisting")}</p>
            </>
          );
        }}
      >
        <ScheduleFields s={s} c={c} pattern={p} />
      </FormDialog>
    </div>
  );
}
export function PackageHistory({
  s,
  customerId,
}: {
  s: Snapshot;
  customerId: string;
}) {
  const t = useTranslations(),
    fmt = useFormat(),
    grants = s.grants.filter((g) => g.customer_id === customerId),
    ids = new Set(grants.map((g) => g.id)),
    purchases = s.purchases.filter((p) => p.customer_id === customerId);
  return (
    <>
      <h2 className="section-heading">{t("purchaseHistory")}</h2>
      {!purchases.length ? (
        <Empty title={t("noPackage")} description={t("noPackageDescription")} />
      ) : (
        <div className="purchase-list">
          {purchases.map((p) => {
            const g = grants.find((g) => g.purchase_id === p.id);
            return (
              <article key={p.id}>
                <div>
                  <h3>{p.terms.name}</h3>
                  <p>
                    {fmt.date(p.starts_on)} →{" "}
                    {g?.expires_on ? fmt.date(g.expires_on) : t("noExpiry")}
                  </p>
                  <small>
                    {t("termsSnapshot")}: {p.terms.deliveries}{" "}
                    {t("deliveriesUnit")}
                  </small>
                </div>
                <strong>
                  {g?.remaining} <span>{t("remaining").toLowerCase()}</span>
                </strong>
              </article>
            );
          })}
        </div>
      )}
      <h2 className="section-heading">{t("quotaHistory")}</h2>
      <div className="ledger-list">
        {s.ledger
          .filter((l) => ids.has(l.grant_id))
          .map((l) => (
            <div key={l.id}>
              <div>
                <strong>{t(l.kind)}</strong>
                <small>
                  {fmt.datetime(l.created_at, s.business.timezone)}
                  {l.reason ? " · " + l.reason : ""}
                </small>
              </div>
              <b className={l.amount > 0 ? "positive" : ""}>
                {l.amount > 0 ? "+" : ""}
                {l.amount}
              </b>
            </div>
          ))}
      </div>
    </>
  );
}
function PackageForm({ s, p }: { s: Snapshot; p?: Package }) {
  const t = useTranslations();
  return (
    <FormDialog
      slug={s.business.slug}
      action="save_package"
      title={t(p ? "edit" : "newPackage")}
      build={(f) => ({
        ...(p ? { id: p.id, version: p.version } : {}),
        name: value(f, "name"),
        deliveries: Number(f.get("deliveries")),
        validity_days: value(f, "validity_days")
          ? Number(f.get("validity_days"))
          : null,
        active: f.get("active") === "on",
      })}
    >
      <label>
        {t("name")}
        <input name="name" required defaultValue={p?.name} />
      </label>
      <div className="form-grid">
        <label>
          {t("deliveryCount")}
          <input
            name="deliveries"
            type="number"
            min="1"
            required
            defaultValue={p?.deliveries}
          />
        </label>
        <label>
          {t("validityDays")}
          <input
            name="validity_days"
            type="number"
            min="1"
            defaultValue={p?.validity_days || ""}
            placeholder={t("noExpiry")}
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          name="active"
          type="checkbox"
          defaultChecked={p?.active ?? true}
        />
        {t("active")}
      </label>
    </FormDialog>
  );
}
export function Packages({ s }: { s: Snapshot }) {
  const t = useTranslations();
  return (
    <>
      <PageHeading title={t("packages")} description={t("packagesDescription")}>
        <PackageForm s={s} />
      </PageHeading>
      {!s.packages.length ? (
        <Empty title={t("noRecords")} />
      ) : (
        <div className="package-grid">
          {s.packages.map((p) => (
            <article className="package-definition" key={p.id}>
              <Status status={p.active ? "active" : "inactive"} />
              <h2>{p.name}</h2>
              <div className="package-count">
                <strong>{p.deliveries}</strong>
                <span>{t("deliveriesUnit")}</span>
              </div>
              <p>
                {p.validity_days
                  ? p.validity_days + " " + t("validityDays").toLowerCase()
                  : t("noExpiry")}
              </p>
              <PackageForm s={s} p={p} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
function MenuForm({ s, m }: { s: Snapshot; m?: Menu }) {
  const t = useTranslations();
  return (
    <FormDialog
      slug={s.business.slug}
      action="save_menu"
      title={t(m ? "edit" : "newMenu")}
      build={(f) => ({
        ...(m ? { id: m.id, version: m.version } : {}),
        name: value(f, "name"),
        description: value(f, "description"),
        active: f.get("active") === "on",
      })}
    >
      <label>
        {t("name")}
        <input name="name" required defaultValue={m?.name} />
      </label>
      <label>
        {t("description")}
        <textarea name="description" defaultValue={m?.description} rows={3} />
      </label>
      <label className="checkbox-row">
        <input
          name="active"
          type="checkbox"
          defaultChecked={m?.active ?? true}
        />
        {t("active")}
      </label>
    </FormDialog>
  );
}
export function Menus({ s }: { s: Snapshot }) {
  const t = useTranslations(),
    fmt = useFormat();
  const groups = [
    ...new Set(s.offerings.map((o) => o.service_date + "|" + o.slot_id)),
  ].sort();
  return (
    <>
      <PageHeading title={t("menus")} description={t("menusDescription")}>
        <MenuForm s={s} />
        <FormDialog
          slug={s.business.slug}
          action="publish_menu"
          title={t("publishMenu")}
          build={(f) => ({
            service_date: value(f, "service_date"),
            slot_id: value(f, "slot_id"),
            menu_ids: f.getAll("menu_ids").map(String),
            default_menu_id: value(f, "default_menu_id"),
            reason: value(f, "reason"),
          })}
          review={(v) => {
            const p = v as {
              service_date: string;
              default_menu_id: string;
              menu_ids: string[];
            };
            return (
              <>
                <h3>{fmt.date(p.service_date)}</h3>
                <p>
                  {t("defaultMeal")}:{" "}
                  {s.menus.find((m) => m.id === p.default_menu_id)?.name}
                </p>
                <p>
                  {p.menu_ids.length} {t("options").toLowerCase()}
                </p>
              </>
            );
          }}
        >
          <div className="form-grid">
            <label>
              {t("date")}
              <DateInput aria-label={t("date")} name="service_date" required />
            </label>
            <label>
              {t("slots")}
              <select name="slot_id">
                {s.slots
                  .filter((x) => x.active)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend>{t("options")}</legend>
            {s.menus
              .filter((m) => m.active)
              .map((m) => (
                <label key={m.id} className="checkbox-row">
                  <input
                    name="menu_ids"
                    type="checkbox"
                    value={m.id}
                    defaultChecked
                  />
                  {m.name}
                </label>
              ))}
          </fieldset>
          <label>
            {t("defaultMeal")}
            <select name="default_menu_id" required>
              {s.menus
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t("reason")}
            <textarea name="reason" rows={2} />
            <small>{t("overrideHint")}</small>
          </label>
        </FormDialog>
      </PageHeading>
      <div className="menu-library">
        {s.menus.map((m, i) => (
          <article key={m.id}>
            <div className={"menu-symbol tone-" + (i % 3)}>
              <span>{m.name.slice(0, 1)}</span>
            </div>
            <div>
              <h2>{m.name}</h2>
              <p>{m.description}</p>
              <Status status={m.active ? "active" : "inactive"} />
            </div>
            <MenuForm s={s} m={m} />
          </article>
        ))}
      </div>
      <h2 className="section-heading">{t("published")}</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("date")}</th>
              <th>{t("slots")}</th>
              <th>{t("defaultMeal")}</th>
              <th>{t("options")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((key) => {
              const [date, slot] = key.split("|"),
                o = s.offerings.filter(
                  (o) => o.service_date === date && o.slot_id === slot,
                );
              return (
                <tr key={key}>
                  <td>{fmt.date(date, true)}</td>
                  <td>{s.slots.find((x) => x.id === slot)?.name}</td>
                  <td>
                    {s.menus.find(
                      (m) => m.id === o.find((x) => x.is_default)?.menu_id,
                    )?.name || "—"}
                  </td>
                  <td>{o.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
