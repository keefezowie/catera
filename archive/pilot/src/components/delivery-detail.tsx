"use client";
import { useTranslations } from "next-intl";
import {
  MapPin,
  Clock,
  UtensilsCrossed,
  ArrowRight,
  PackageCheck,
} from "lucide-react";
import type { Snapshot, Delivery, Address } from "@/lib/types";
import {
  Status,
  FormDialog,
  AddressFields,
  addressFrom,
  useFormat,
  Quota,
} from "./ui";
export function DeliveryDetail({ s, d }: { s: Snapshot; d: Delivery }) {
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
    events = s.events.filter((x) => x.delivery_id === d.id);
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
      title={title}
      build={build}
      review={review}
      description={t(change + "Consequence")}
    >
      {children}
      {reason}
    </FormDialog>
  );
  return (
    <div className="delivery-detail">
      <div className="detail-title">
        <Status status={d.status} />
        <h2>{subscriber ? fmt.date(d.service_date) : customer?.name}</h2>
        <p>
          {subscriber
            ? slot?.name
            : fmt.date(d.service_date) + " · " + slot?.name}
        </p>
      </div>
      <section className="detail-section">
        <div className="section-label">
          <UtensilsCrossed size={18} />
          <h3>{t("meal")}</h3>
        </div>
        <p className="meal-name">{d.menu_name || t("selectionNeeded")}</p>
        {d.selection_source === "default" && (
          <small>{t("default_selected")}</small>
        )}
        {editable &&
          options.length > 0 &&
          action(
            "menu",
            t("selectMeal"),
            <label>
              {t("meal")}
              <select name="menu_id" defaultValue={d.menu_id || ""} required>
                <option value="" disabled>
                  {t("choose")}
                </option>
                {options.map((o) => (
                  <option key={o.menu_id} value={o.menu_id}>
                    {s.menus.find((m) => m.id === o.menu_id)?.name}
                  </option>
                ))}
              </select>
            </label>,
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
          <h3>{t("address")}</h3>
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
      <section className={"cutoff-notice " + (locked ? "is-locked" : "")}>
        <Clock size={18} />
        <div>
          <strong>{t(locked ? "locked" : "editable")}</strong>
          <p>
            {t("cutoff")}: {fmt.datetime(d.cutoff_at, s.business.timezone)} ·{" "}
            {s.business.timezone}
          </p>
        </div>
      </section>
      {editable && (
        <div className="detail-actions">
          {action(
            "reschedule",
            t("reschedule"),
            <>
              <label>
                {t("date")}
                <input
                  name="service_date"
                  type="date"
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
      {!subscriber && (
        <div className="fulfillment-actions">
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
              build={(f) => ({
                id: d.id,
                version: d.version,
                status,
                reason: String(f.get("reason") || ""),
              })}
              review={() => (
                <p>
                  {customer?.name} · {fmt.date(d.service_date)}
                  <br />
                  {t(d.status)} → {t(status)}
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
              review={() => <p>{t("reverseConsequence")}</p>}
            >
              <label>
                {t("reason")}
                <textarea name="reason" required />
              </label>
            </FormDialog>
          )}
        </div>
      )}
      <section className="detail-section">
        <h3>{t("quota")}</h3>
        <Quota grants={s.grants.filter((g) => g.id === d.grant_id)} />
      </section>
      <section className="detail-section">
        <h3>{t("history")}</h3>
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
      </section>
    </div>
  );
}
