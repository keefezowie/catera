"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MapPin, Clock, UtensilsCrossed, ArrowRight } from "lucide-react";
import type { Snapshot, Delivery, Address } from "@/lib/types";
import {
  Status,
  FormDialog,
  AddressFields,
  addressFrom,
  useFormat,
  Quota,
  DateInput,
} from "./ui";
export function DeliveryDetail({
  s,
  d,
  headingLevel = 1,
}: {
  s: Snapshot;
  d: Delivery;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const SectionHeading = headingLevel === 1 ? "h2" : "h3";
  const t = useTranslations(),
    fmt = useFormat(),
    customer = s.customers.find((c) => c.id === d.customer_id),
    slot = s.slots.find((x) => x.id === d.slot_id),
    subscriber = s.role === "subscriber",
    locked = new Date(s.now) >= new Date(d.cutoff_at),
    terminal = ["delivered", "cancelled"].includes(d.status),
    slug = s.business.slug;
  const editable = !terminal && (!subscriber || !locked),
    options = s.offerings.filter(
      (o) => o.service_date === d.service_date && o.slot_id === d.slot_id,
    ),
    events = s.events.filter((x) => x.delivery_id === d.id),
    production = s.production
      .filter(
        (p) => p.service_date === d.service_date && p.slot_id === d.slot_id,
      )
      .sort((a, b) => b.revision - a.revision)[0],
    readyBlocked = !production
      ? "detailProductionNotFrozen"
      : production.incomplete > 0
        ? "detailProductionIncomplete"
        : !production.entries.some((e) => e.id === d.id)
          ? "detailProductionMissingDelivery"
          : null,
    grant = s.grants.find((g) => g.id === d.grant_id),
    purchase = s.purchases.find((p) => p.id === grant?.purchase_id),
    selectedMenu = s.menus.find((menu) => menu.id === d.menu_id);
  const reason =
    !subscriber && locked ? (
      <label>
        {t("reason")}
        <textarea name="reason" required rows={2} />
        <small>{t("overrideHint")}</small>
      </label>
    ) : null;
  const base = (f: FormData) => ({
    id: d.id,
    version: d.version,
    reason: String(f.get("reason") || ""),
  });
  const action = (
    change: string,
    title: string,
    children: React.ReactNode,
    build: (f: FormData) => unknown,
    review: (v: unknown) => React.ReactNode,
  ) => (
    <FormDialog
      slug={slug}
      action="change_delivery"
      layout={change === "menu" ? "wide" : undefined}
      title={title}
      build={build}
      review={(value) => (
        <>
          {review(value)}
          {reason && (
            <p className="review-reason">
              <strong>{t("reason")}</strong>
              <br />
              {(value as { reason: string }).reason}
            </p>
          )}
        </>
      )}
      description={t(change + "Consequence")}
      startInReview={change === "skip" && !reason}
      triggerVariant={
        change === "skip"
          ? "danger"
          : change === "menu" && subscriber
            ? "primary"
            : "secondary"
      }
      context={
        <p>
          {subscriber ? fmt.date(d.service_date) : customer?.name} ·{" "}
          {slot?.name}
          <br />
          {t(locked ? "locked" : "editable")} · {t("cutoff")}:{" "}
          {fmt.datetime(d.cutoff_at, s.business.timezone)} ·{" "}
          {s.business.timezone}
        </p>
      }
    >
      {children}
      {reason}
    </FormDialog>
  );
  return (
    <div className="delivery-detail">
      <div className="detail-title">
        <Status status={d.status} />
        <Heading>
          {subscriber ? fmt.date(d.service_date, true) : customer?.name}
        </Heading>
        <p>
          {subscriber
            ? slot?.name
            : fmt.date(d.service_date) + " · " + slot?.name}
        </p>
      </div>
      {!subscriber &&
        (!terminal || (s.role === "owner" && d.status === "delivered")) && (
          <section className="fulfillment-actions" aria-label={t("nextStep")}>
            <SectionHeading>{t("nextStep")}</SectionHeading>
            {(d.status === "scheduled"
              ? [["ready", "markReady"]]
              : d.status === "ready"
                ? [["out_for_delivery", "dispatch"]]
                : d.status === "out_for_delivery"
                  ? [
                      ["delivered", "confirmDelivered"],
                      ["failed", "markFailed"],
                    ]
                  : d.status === "failed"
                    ? [["out_for_delivery", "retryDelivery"]]
                    : []
            ).map(([status, label]) => (
              <FormDialog
                key={status}
                slug={slug}
                action="transition"
                title={t(label)}
                description={t("deliverySummary")}
                startInReview={status !== "failed"}
                triggerVariant={status === "failed" ? "secondary" : "primary"}
                disabled={status === "ready" && !!readyBlocked}
                build={(f) => ({
                  id: d.id,
                  version: d.version,
                  status,
                  ...(status === "ready" && production
                    ? { production_id: production.id }
                    : {}),
                  reason: String(f.get("reason") || ""),
                })}
                review={(value) => (
                  <p>
                    {customer?.name} · {fmt.date(d.service_date)}
                    <br />
                    {t(d.status)} → {t(status)}
                    {status === "ready" && production && (
                      <>
                        <br />
                        {t("frozen")} · {t("revision")} {production.revision}
                      </>
                    )}
                    {status === "failed" && (
                      <>
                        <br />
                        {t("reason")}: {(value as { reason: string }).reason}
                      </>
                    )}
                    {status === "delivered" && (
                      <>
                        <br />
                        −1 {t("deliveriesUnit")}
                      </>
                    )}
                  </p>
                )}
              >
                {status === "failed" && (
                  <label>
                    {t("reason")}
                    <textarea name="reason" required />
                  </label>
                )}
              </FormDialog>
            ))}
            {d.status === "scheduled" && !readyBlocked && production && (
              <p className="fulfillment-prerequisite">
                {t("frozen")} · {t("revision")} {production.revision}
              </p>
            )}
            {d.status === "scheduled" && readyBlocked && (
              <p className="fulfillment-blocked">
                <span>{t(readyBlocked)}</span>{" "}
                <Link
                  href={
                    "/w/" + slug + "/admin/production?date=" + d.service_date
                  }
                >
                  {t("viewProduction")}
                  <ArrowRight size={14} />
                </Link>
              </p>
            )}
            {s.role === "owner" && d.status === "delivered" && (
              <FormDialog
                slug={slug}
                action="reverse_delivery"
                title={t("reverse")}
                description={t("reverseConsequence")}
                build={(f) => ({
                  id: d.id,
                  version: d.version,
                  reason: String(f.get("reason")),
                })}
                review={(value) => (
                  <>
                    <p>{t("reverseConsequence")}</p>
                    <p className="review-reason">
                      <strong>{t("reason")}</strong>
                      <br />
                      {(value as { reason: string }).reason}
                    </p>
                  </>
                )}
              >
                <label>
                  {t("reason")}
                  <textarea name="reason" required />
                </label>
              </FormDialog>
            )}
          </section>
        )}
      <section
        className={"cutoff-notice " + (locked && !terminal ? "is-locked" : "")}
      >
        <Clock size={18} />
        <div>
          <strong>
            {t(terminal ? "detailClosed" : locked ? "locked" : "editable")}
          </strong>
          <p>
            {terminal ? (
              t(
                d.status === "delivered"
                  ? "detailDeliveredAccounting"
                  : "detailCancelledAccounting",
              )
            ) : (
              <>
                {t("cutoff")}: {fmt.datetime(d.cutoff_at, s.business.timezone)}{" "}
                · {s.business.timezone}
              </>
            )}
          </p>
          {!terminal && locked && !subscriber && (
            <small>{t("overrideHint")}</small>
          )}
        </div>
      </section>
      <section className="detail-section">
        <div className="section-label">
          <UtensilsCrossed size={18} />
          <SectionHeading>{t("meal")}</SectionHeading>
        </div>
        <p className="meal-name">{d.menu_name || t("selectionNeeded")}</p>
        {selectedMenu?.description && (
          <p className="muted">{selectedMenu.description}</p>
        )}
        {d.selection_source === "default" && (
          <small>{t("default_selected")}</small>
        )}
        {editable &&
          options.length > 0 &&
          action(
            "menu",
            t("selectMeal"),
            <MenuChoice
              key={d.id}
              s={s}
              d={d}
              menuIds={options.map((o) => o.menu_id)}
            />,
            (f) => ({
              ...base(f),
              change: "menu",
              menu_id: String(f.get("menu_id")),
            }),
            (v) => (
              <>
                <span className="muted">{t("before")}</span>
                <p>{d.menu_name || t("selectionNeeded")}</p>
                <ArrowRight />
                <span className="muted">{t("after")}</span>
                <p>
                  {
                    s.menus.find(
                      (m) => m.id === (v as { menu_id: string }).menu_id,
                    )?.name
                  }
                </p>
              </>
            ),
          )}
        {!options.length && editable && (
          <p className="muted">{t("noMenuOptions")}</p>
        )}
      </section>
      <section className="detail-section">
        <div className="section-label">
          <MapPin size={18} />
          <SectionHeading>{t("address")}</SectionHeading>
        </div>
        <p>
          {d.address.line}
          <br />
          {d.address.city}
        </p>
        {d.address.instructions && (
          <p className="delivery-instructions">{d.address.instructions}</p>
        )}
        {editable &&
          action(
            "address",
            t("changeAddress"),
            <AddressFields address={d.address} />,
            (f) => ({ ...base(f), change: "address", address: addressFrom(f) }),
            (v) => (
              <>
                <p>
                  <strong>{t("before")}</strong>
                  <br />
                  {d.address.line}, {d.address.city}
                </p>
                <p>
                  <strong>{t("after")}</strong>
                  <br />
                  {(v as { address: Address }).address.line},{" "}
                  {(v as { address: Address }).address.city}
                </p>
              </>
            ),
          )}
      </section>
      {editable && (
        <div className="detail-actions">
          {action(
            "reschedule",
            t("reschedule"),
            <>
              <label>
                {t("date")}
                <DateInput
                  name="service_date"
                  defaultValue={d.service_date}
                  required
                />
              </label>
              <label>
                {t("slots")}
                <select name="slot_id" defaultValue={d.slot_id}>
                  {s.slots
                    .filter((x) => x.active)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
            </>,
            (f) => ({
              ...base(f),
              change: "reschedule",
              service_date: String(f.get("service_date")),
              slot_id: String(f.get("slot_id")),
            }),
            (v) => (
              <>
                <p>
                  {fmt.date(d.service_date)} · {slot?.name}
                </p>
                <ArrowRight />
                <p>
                  {fmt.date((v as { service_date: string }).service_date)} ·{" "}
                  {
                    s.slots.find(
                      (x) => x.id === (v as { slot_id: string }).slot_id,
                    )?.name
                  }
                </p>
                <p>{t("rescheduleConsequence")}</p>
              </>
            ),
          )}
          {action(
            "skip",
            t("skip"),
            null,
            (f) => ({ ...base(f), change: "skip" }),
            () => (
              <p>{t("skipConsequence")}</p>
            ),
          )}
        </div>
      )}
      <details className="detail-section detail-disclosure">
        <summary>{t("detailGrantQuota")}</summary>
        <p className="muted">{t("detailGrantQuotaHint")}</p>
        {purchase && (
          <p>
            <strong>{purchase.terms.name}</strong>
            {grant && (
              <>
                {" "}
                · {fmt.date(grant.starts_on, true)} →{" "}
                {grant.expires_on
                  ? fmt.date(grant.expires_on, true)
                  : t("noExpiry")}
              </>
            )}
          </p>
        )}
        <Quota grants={s.grants.filter((g) => g.id === d.grant_id)} />
      </details>
      <details className="detail-section detail-disclosure">
        <summary>
          {t("history")} · {events.length}
        </summary>
        <ol className="timeline">
          {events.map((e) => (
            <li key={e.id}>
              <span className="timeline-dot" />
              <div>
                <strong>{t.has(e.kind) ? t(e.kind) : e.kind}</strong>
                <small>{fmt.datetime(e.created_at, s.business.timezone)}</small>
                {typeof e.details.reason === "string" && e.details.reason && (
                  <p>{e.details.reason}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function MenuChoice({
  s,
  d,
  menuIds,
}: {
  s: Snapshot;
  d: Delivery;
  menuIds: string[];
}) {
  const t = useTranslations();
  const choices = menuIds
    .map((id) => s.menus.find((menu) => menu.id === id))
    .filter((menu) => menu !== undefined);
  const defaultId = s.offerings.find(
    (offering) =>
      offering.service_date === d.service_date &&
      offering.slot_id === d.slot_id &&
      offering.is_default,
  )?.menu_id;
  return (
    <fieldset className="menu-choice-list">
      <legend>{t("meal")}</legend>
      <p className="menu-choice-hint">{t("detailMenuChoiceHint")}</p>
      <div className="menu-choice-options">
        {choices.map((meal) => (
          <label className="menu-choice-option" key={meal.id}>
            <input
              type="radio"
              name="menu_id"
              value={meal.id}
              defaultChecked={d.menu_id === meal.id}
              required
              aria-labelledby={
                "meal-name-" +
                meal.id +
                (defaultId === meal.id ? " meal-default-" + meal.id : "")
              }
              aria-describedby={
                meal.description ? "meal-description-" + meal.id : undefined
              }
            />
            <span>
              <strong id={"meal-name-" + meal.id}>{meal.name}</strong>
              {defaultId === meal.id && (
                <small
                  className="menu-choice-default"
                  id={"meal-default-" + meal.id}
                >
                  {t("defaultMeal")}
                </small>
              )}
              {meal.description && (
                <span
                  className="menu-choice-description"
                  id={"meal-description-" + meal.id}
                >
                  {meal.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      {defaultId && new Date(s.now) < new Date(d.cutoff_at) && (
        <p className="menu-choice-hint">{t("defaultAtCutoff")}</p>
      )}
    </fieldset>
  );
}
