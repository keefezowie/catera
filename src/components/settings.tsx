"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Snapshot } from "@/lib/types";
import { PageHeading, FormDialog, Status, useFormat } from "./ui";
const val = (f: FormData, k: string) => String(f.get(k) || "");
export function Settings({ s }: { s: Snapshot }) {
  const t = useTranslations(),
    fmt = useFormat(),
    [role, setRole] = useState("admin"),
    b = s.business;
  if (s.role !== "owner")
    return (
      <>
        <PageHeading
          title={t("settings")}
          description={t("settingsDescription")}
        />
        <p>{t("accessDenied")}</p>
      </>
    );
  return (
    <>
      <PageHeading
        title={t("settings")}
        description={t("settingsDescription")}
      />
      <section className="settings-section">
        <div>
          <h2>{t("operations")}</h2>
          <p>{t("timeZoneHint")}</p>
        </div>
        <div>
          <dl className="settings-values">
            <dt>{t("businessName")}</dt>
            <dd>{b.name}</dd>
            <dt>{t("timezone")}</dt>
            <dd>{b.timezone}</dd>
            <dt>{t("cutoffTime")}</dt>
            <dd>{b.cutoff.slice(0, 5)}</dd>
          </dl>
          <FormDialog
            slug={b.slug}
            action="save_settings"
            title={t("edit")}
            build={(f) => ({
              name: val(f, "name"),
              timezone: val(f, "timezone"),
              cutoff: val(f, "cutoff"),
            })}
            review={(v) => (
              <p>
                {(v as { timezone: string }).timezone} ·{" "}
                {(v as { cutoff: string }).cutoff}
              </p>
            )}
          >
            <label>
              {t("businessName")}
              <input name="name" defaultValue={b.name} required />
            </label>
            <label>
              {t("timezone")}
              <select name="timezone" defaultValue={b.timezone}>
                {[
                  "Asia/Jakarta",
                  "Asia/Makassar",
                  "Asia/Jayapura",
                  "Asia/Singapore",
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <label>
              {t("cutoffTime")}
              <input
                name="cutoff"
                type="time"
                required
                defaultValue={b.cutoff.slice(0, 5)}
              />
            </label>
          </FormDialog>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>{t("slots")}</h2>
        </div>
        <div>
          {s.slots.map((x) => (
            <div className="setting-row" key={x.id}>
              <strong>{x.name}</strong>
              <span>{x.start_time.slice(0, 5)}</span>
              <Status status={x.active ? "active" : "inactive"} />
              <FormDialog
                slug={b.slug}
                action="save_slot"
                title={t("edit")}
                build={(f) => ({
                  id: x.id,
                  name: val(f, "name"),
                  start_time: val(f, "start_time"),
                  active: f.get("active") === "on",
                })}
              >
                <label>
                  {t("name")}
                  <input name="name" defaultValue={x.name} required />
                </label>
                <label>
                  {t("startTime")}
                  <input
                    name="start_time"
                    type="time"
                    defaultValue={x.start_time.slice(0, 5)}
                    required
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={x.active}
                  />
                  {t("active")}
                </label>
              </FormDialog>
            </div>
          ))}
          <FormDialog
            slug={b.slug}
            action="save_slot"
            title={t("addSlot")}
            build={(f) => ({
              name: val(f, "name"),
              start_time: val(f, "start_time"),
            })}
          >
            <label>
              {t("name")}
              <input name="name" required />
            </label>
            <label>
              {t("startTime")}
              <input name="start_time" type="time" required />
            </label>
          </FormDialog>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>{t("exceptions")}</h2>
        </div>
        <div>
          {s.exceptions.map((e) => (
            <div className="setting-row" key={e.service_date}>
              <strong>{fmt.date(e.service_date, true)}</strong>
              <span>
                {e.closed
                  ? t("closedDate")
                  : e.cutoff_at
                    ? fmt.datetime(e.cutoff_at, b.timezone)
                    : b.cutoff}
              </span>
            </div>
          ))}
          <FormDialog
            slug={b.slug}
            action="save_exception"
            title={t("addException")}
            build={(f) => ({
              service_date: val(f, "service_date"),
              cutoff_local: val(f, "cutoff_local"),
              closed: f.get("closed") === "on",
            })}
          >
            <label>
              {t("date")}
              <input name="service_date" type="date" required />
            </label>
            <label>
              {t("exceptionCutoff")}
              <input name="cutoff_local" type="datetime-local" />
              <small>
                {t("timezone")}: {b.timezone}
              </small>
            </label>
            <label className="checkbox-row">
              <input name="closed" type="checkbox" />
              {t("closedDate")}
            </label>
          </FormDialog>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>{t("team")}</h2>
          <p>{t("invitationHint")}</p>
        </div>
        <div>
          {s.memberships.map((m) => (
            <div className="setting-row" key={m.user_id}>
              <div>
                <strong>{m.email}</strong>
                <small>{t(m.role)}</small>
              </div>
              {m.role !== "owner" && (
                <FormDialog
                  slug={b.slug}
                  action="set_role"
                  title={t("revoke")}
                  build={() => ({ user_id: m.user_id, role: "revoked" })}
                  review={() => (
                    <p>
                      {m.email} · {t("revoke")}
                    </p>
                  )}
                />
              )}
            </div>
          ))}
          {s.invitations.map((i) => (
            <div className="setting-row" key={i.id}>
              <span>{i.email}</span>
              <Status status={i.accepted_at ? "accepted" : "pending"} />
            </div>
          ))}
          <FormDialog
            slug={b.slug}
            action="invite"
            title={t("invite")}
            description={t("invitationHint")}
            build={(f) => ({
              email: val(f, "email"),
              role: val(f, "role"),
              customer_id: val(f, "customer_id"),
            })}
          >
            <label>
              {t("email")}
              <input name="email" type="email" required />
            </label>
            <label>
              {t("role")}
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="admin">{t("admin")}</option>
                <option value="subscriber">{t("subscriber")}</option>
              </select>
            </label>
            {role === "subscriber" && (
              <label>
                {t("customer")}
                <select name="customer_id" required>
                  <option value="">{t("choose")}</option>
                  {s.customers
                    .filter((c) => !c.user_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </FormDialog>
        </div>
      </section>
    </>
  );
}
