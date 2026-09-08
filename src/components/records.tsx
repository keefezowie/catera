"use client";
import Link from "next/link";
import { useState } from "react";
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
  AddressFields,
  addressFrom,
  Quota,
  Empty,
  Status,
  useFormat,
} from "./ui";
import { previewSchedule, type ScheduleInput } from "@/lib/scheduling";
const value = (f: FormData, key: string) => String(f.get(key) || "");
function CustomerForm({ s, c }: { s: Snapshot; c?: Customer }) {
  const t = useTranslations();
  return (
    <FormDialog
      slug={s.business.slug}
      action="save_customer"
      title={t(c ? "edit" : "newCustomer")}
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
export function PurchaseForm({ s, c }: { s: Snapshot; c: Customer }) {
  const t = useTranslations(),
    fmt = useFormat();
  return (
    <FormDialog
      slug={s.business.slug}
      action="purchase"
      title={t("recordPurchase")}
      description={t("purchaseDescription")}
      build={(f) => ({
        customer_id: c.id,
        package_id: value(f, "package_id"),
        starts_on: value(f, "starts_on"),
        external_reference: value(f, "external_reference"),
      })}
      review={(v) => {
        const d = v as { package_id: string; starts_on: string };
        const p = s.packages.find((x) => x.id === d.package_id);
        return (
          <>
            <h3>{c.name}</h3>
            <p>
              {p?.name} · +{p?.deliveries} {t("deliveriesUnit")}
            </p>
            <p>
              {t("startsOn")}: {fmt.date(d.starts_on)}
            </p>
            <p>
              {p?.validity_days
                ? p.validity_days + " " + t("validityDays").toLowerCase()
                : t("noExpiry")}
            </p>
            <p className="muted">{t("purchaseDescription")}</p>
          </>
        );
      }}
    >
      <label>
        {t("package")}
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
        <input
          name="starts_on"
          type="date"
          required
          defaultValue={s.now.slice(0, 10)}
        />
      </label>
      <label>
        {t("externalReference")}
        <input name="external_reference" />
      </label>
    </FormDialog>
  );
}
export function ScheduleForm({ s, c }: { s: Snapshot; c: Customer }) {
  const t = useTranslations(),
    locale = useLocale(),
    fmt = useFormat();
  return (
    <FormDialog
      slug={s.business.slug}
      action="generate_schedule"
      title={t("createSchedule")}
      description={t("skipExisting")}
      build={(f) => ({
        customer_id: c.id,
        starts_on: value(f, "starts_on"),
        ends_on: value(f, "ends_on"),
        weekdays: f.getAll("weekdays").map(Number),
        slot_ids: f.getAll("slot_ids").map(String),
      })}
      review={(v) => {
        const rows = previewSchedule(s, v as ScheduleInput);
        return (
          <>
            <h3>
              {rows.length} {t("occurrences")}
            </h3>
            {rows.some((r) => !r.grant_id) && (
              <p className="error">{t("insufficientPreview")}</p>
            )}
            <ul className="schedule-preview">
              {rows.map((r) => (
                <li key={r.date + r.slot_id}>
                  {fmt.date(r.date, true)}
                  <span>{s.slots.find((x) => x.id === r.slot_id)?.name}</span>
                </li>
              ))}
            </ul>
            <p className="muted">{t("skipExisting")}</p>
          </>
        );
      }}
    >
      <div className="form-grid">
        <label>
          {t("startsOn")}
          <input type="date" name="starts_on" required />
        </label>
        <label>
          {t("endsOn")}
          <input type="date" name="ends_on" required />
        </label>
      </div>
      <fieldset>
        <legend>{t("weekdays")}</legend>
        <div className="weekday-options">
          {[1, 2, 3, 4, 5, 6, 0].map((n) => (
            <label key={n}>
              <input
                type="checkbox"
                name="weekdays"
                value={n}
                defaultChecked={n >= 1 && n <= 5}
              />
              {new Intl.DateTimeFormat(locale, {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2026, 8, 6 + n)))}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("slots")}</legend>
        {s.slots
          .filter((x) => x.active)
          .map((x, i) => (
            <label className="checkbox-row" key={x.id}>
              <input
                type="checkbox"
                name="slot_ids"
                value={x.id}
                defaultChecked={i === 0}
              />
              {x.name}
            </label>
          ))}
      </fieldset>
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
      deliveries = s.deliveries.filter((d) => d.customer_id === c.id);
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
          <PurchaseForm s={s} c={c} />
          <ScheduleForm s={s} c={c} />
        </PageHeading>
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
                <th />
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
              {t("package")}
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
              aria-label={t("search")}
              placeholder={t("search")}
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
    fmt = useFormat(),
    locale = useLocale();
  return (
    <div className="recurrence-controls">
      <span>
        {fmt.date(p.starts_on, true)} — {fmt.date(p.ends_on, true)}
      </span>
      <FormDialog
        slug={s.business.slug}
        action="revise_schedule"
        title={t("editSchedule")}
        description={t("skipExisting")}
        build={(f) => ({
          id: p.id,
          version: p.version,
          customer_id: c.id,
          starts_on: value(f, "starts_on"),
          ends_on: value(f, "ends_on"),
          weekdays: f.getAll("weekdays").map(Number),
          slot_ids: f.getAll("slot_ids").map(String),
        })}
        review={(v) => {
          const input = v as ScheduleInput,
            copy = structuredClone(s);
          const removed = copy.deliveries.filter(
            (d) =>
              d.pattern_id === p.id &&
              d.service_date >= input.starts_on &&
              !["cancelled", "delivered"].includes(d.status) &&
              (d.service_date > input.ends_on ||
                !input.weekdays.includes(
                  new Date(d.service_date).getUTCDay(),
                ) ||
                !input.slot_ids.includes(d.slot_id)),
          );
          for (const d of removed) {
            d.status = "cancelled";
            const grant = copy.grants.find((g) => g.id === d.grant_id);
            if (grant) grant.reserved -= 1;
          }
          const rows = previewSchedule(copy, input);
          return (
            <>
              <h3>
                {t("skip")}: {removed.length}
              </h3>
              <ul className="schedule-preview">
                {removed.map((d) => (
                  <li key={d.id}>
                    {fmt.date(d.service_date, true)} ·{" "}
                    {s.slots.find((x) => x.id === d.slot_id)?.name}
                  </li>
                ))}
              </ul>
              <h3>
                {rows.length} {t("occurrences")}
              </h3>
              <ul className="schedule-preview">
                {rows.map((r) => (
                  <li key={r.date + r.slot_id}>
                    {fmt.date(r.date, true)} ·{" "}
                    {s.slots.find((x) => x.id === r.slot_id)?.name}
                  </li>
                ))}
              </ul>
              {rows.some((r) => !r.grant_id) && (
                <p className="error">{t("insufficientPreview")}</p>
              )}
              <p>{t("skipExisting")}</p>
            </>
          );
        }}
      >
        <div className="form-grid">
          <label>
            {t("startsOn")}
            <input
              name="starts_on"
              type="date"
              required
              defaultValue={p.starts_on}
            />
          </label>
          <label>
            {t("endsOn")}
            <input
              name="ends_on"
              type="date"
              required
              defaultValue={p.ends_on}
            />
          </label>
        </div>
        <fieldset>
          <legend>{t("weekdays")}</legend>
          <div className="weekday-options">
            {[1, 2, 3, 4, 5, 6, 0].map((n) => (
              <label key={n}>
                <input
                  name="weekdays"
                  type="checkbox"
                  value={n}
                  defaultChecked={p.weekdays.includes(n)}
                />
                {new Intl.DateTimeFormat(locale, {
                  weekday: "short",
                  timeZone: "UTC",
                }).format(new Date(Date.UTC(2026, 8, 6 + n)))}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t("slots")}</legend>
          {s.slots
            .filter((x) => x.active)
            .map((slot) => (
              <label key={slot.id} className="checkbox-row">
                <input
                  name="slot_ids"
                  type="checkbox"
                  value={slot.id}
                  defaultChecked={p.slots.includes(slot.id)}
                />
                {slot.name}
              </label>
            ))}
        </fieldset>
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
              <input name="service_date" type="date" required />
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
