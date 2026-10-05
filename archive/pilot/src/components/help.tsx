"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Search } from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { Empty, PageHeading, useFormat } from "./ui";

const topics = [
  {
    id: "packages",
    roles: ["owner", "admin"],
    path: "/admin/packages",
    action: "packages",
  },
  {
    id: "offerings",
    roles: ["owner", "admin"],
    path: "/admin/menus",
    action: "menus",
  },
  {
    id: "purchase",
    roles: ["owner", "admin"],
    path: "/admin/customers",
    action: "customers",
  },
  {
    id: "schedule",
    roles: ["owner", "admin"],
    path: "/admin/customers",
    action: "customers",
  },
  {
    id: "production",
    roles: ["owner", "admin"],
    path: "/admin/production",
    action: "production",
  },
  {
    id: "fulfillment",
    roles: ["owner", "admin"],
    path: "/admin/delivery",
    action: "delivery",
  },
  {
    id: "quota",
    roles: ["owner", "admin", "subscriber"],
    path: "/package",
    action: "package",
  },
  {
    id: "menu",
    roles: ["owner", "admin", "subscriber"],
    path: "/schedule",
    action: "schedule",
  },
  {
    id: "cutoff",
    roles: ["owner", "admin", "subscriber"],
    path: "/schedule",
    action: "schedule",
  },
  {
    id: "address",
    roles: ["owner", "admin", "subscriber"],
    path: "/profile",
    action: "profile",
  },
  {
    id: "recovery",
    roles: ["owner", "admin", "subscriber"],
    path: "/schedule",
    action: "schedule",
  },
];

const ownerGroups = [
  {
    label: "planningGroup",
    ids: ["packages", "purchase", "schedule", "quota"],
  },
  { label: "kitchenGroup", ids: ["offerings", "production", "menu", "cutoff"] },
  { label: "deliveryGroup", ids: ["fulfillment", "address", "recovery"] },
];
const customerGroups = [
  { label: "menuGroup", ids: ["menu", "cutoff"] },
  { label: "accountGroup", ids: ["quota", "address"] },
  { label: "recoveryGroup", ids: ["recovery"] },
];

export function Help({ s }: { s: Snapshot }) {
  const t = useTranslations(),
    fmt = useFormat(),
    query = useSearchParams(),
    [search, setSearch] = useState(""),
    selected =
      query.get("topic") || (s.role === "subscriber" ? "menu" : "schedule"),
    available = topics.filter((topic) => topic.roles.includes(s.role)),
    matches = available
      .filter((topic) =>
        ["title", "summary", "steps", "note"]
          .map((part) => t(`guide.${topic.id}.${part}`))
          .join(" ")
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase().trim()),
      )
      .sort(
        (a, b) =>
          Number(
            t(`guide.${b.id}.title`)
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase().trim()),
          ) -
          Number(
            t(`guide.${a.id}.title`)
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase().trim()),
          ),
      ),
    current = matches.find((topic) => topic.id === selected) || matches[0],
    base = "/w/" + s.business.slug;
  const delivery = s.deliveries.find((d) => d.id === query.get("delivery"));
  const customer = s.customers.find(
    (c) => c.id === (query.get("customer") || delivery?.customer_id),
  );
  const date =
    delivery?.service_date ||
    (/^\d{4}-\d{2}-\d{2}$/.test(query.get("date") || "")
      ? query.get("date")
      : null);
  const contextQuery = new URLSearchParams();
  if (date) contextQuery.set("date", date);
  if (delivery) contextQuery.set("delivery", delivery.id);
  if (customer) contextQuery.set("customer", customer.id);
  if (
    s.slots.some((slot) => slot.id === (query.get("slot") || delivery?.slot_id))
  )
    contextQuery.set("slot", query.get("slot") || delivery!.slot_id);
  function topicHref(id: string) {
    const next = new URLSearchParams(contextQuery);
    next.set("topic", id);
    return base + (s.role === "subscriber" ? "" : "/admin") + "/help?" + next;
  }
  function destination(topic: (typeof topics)[number]) {
    if (s.role === "subscriber") {
      if (delivery && ["menu", "cutoff", "recovery"].includes(topic.id))
        return { path: "/deliveries/" + delivery.id, action: "viewDetails" };
      return { path: topic.path, action: topic.action };
    }
    if (["quota", "address", "schedule", "purchase"].includes(topic.id))
      return {
        path: "/admin/customers" + (customer ? "/" + customer.id : ""),
        action: customer ? "viewDetails" : "customers",
      };
    if (
      delivery &&
      ["fulfillment", "recovery", "menu", "cutoff"].includes(topic.id)
    )
      return {
        path:
          "/admin/delivery?date=" +
          delivery.service_date +
          "&delivery=" +
          delivery.id,
        action: "viewDetails",
      };
    const dated = new URLSearchParams();
    if (date) dated.set("date", date);
    if (contextQuery.has("slot")) dated.set("slot", contextQuery.get("slot")!);
    return {
      path:
        (topic.id === "recovery"
          ? "/admin/delivery"
          : topic.path.startsWith("/admin")
            ? topic.path
            : "/admin/schedule") + (dated.size ? "?" + dated : ""),
      action: topic.id === "recovery" ? "delivery" : topic.action,
    };
  }
  return (
    <div className="help-page">
      <PageHeading title={t("help")} description={t("guide.description")} />
      <label className="search-control help-search">
        <Search size={18} />
        <input
          type="search"
          aria-label={t("guide.search")}
          placeholder={t("guide.search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {current ? (
        <div className="help-layout">
          <div className="help-sidebar">
            <nav aria-label={t("guide.topics")} className="help-topics">
              {(s.role === "subscriber" ? customerGroups : ownerGroups).map(
                (group) => {
                  const grouped = matches.filter((topic) =>
                    group.ids.includes(topic.id),
                  );
                  if (!grouped.length) return null;
                  return (
                    <details
                      className="help-topic-group"
                      key={group.label}
                      open={group.ids.includes(current.id)}
                    >
                      <summary>{t("guide." + group.label)}</summary>
                      {grouped.map((topic) => (
                        <Link
                          key={topic.id}
                          aria-current={
                            current.id === topic.id ? "page" : undefined
                          }
                          href={topicHref(topic.id)}
                        >
                          {t(`guide.${topic.id}.title`)}
                        </Link>
                      ))}
                    </details>
                  );
                },
              )}
            </nav>
            <KeyboardGuide />
          </div>
          <article className="help-article" key={current.id}>
            <h2>{t(`guide.${current.id}.title`)}</h2>
            <p>{t(`guide.${current.id}.summary`)}</p>
            {(customer || delivery || date) && (
              <p className="help-task-context">
                {t("guide.taskContext")}
                {customer ? " · " + customer.name : ""}
                {date ? " · " + fmt.date(date) : ""}
              </p>
            )}
            <ol>
              {t(`guide.${current.id}.steps`)
                .split("\n")
                .map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
            </ol>
            <p className="help-note">{t(`guide.${current.id}.note`)}</p>
            {current.id === "cutoff" && (
              <p className="help-policy">
                {t("guide.currentPolicy", {
                  zone: s.business.timezone,
                  time: s.business.cutoff.slice(0, 5),
                })}
              </p>
            )}
            <Link
              className="button primary"
              href={base + destination(current).path}
            >
              {t(destination(current).action)}
              <ArrowRight size={16} />
            </Link>
          </article>
        </div>
      ) : (
        <Empty title={t("guide.noResults")} description={t("guide.tryAgain")}>
          <button className="button secondary" onClick={() => setSearch("")}>
            {t("clearFilters")}
          </button>
        </Empty>
      )}
    </div>
  );
}

function KeyboardGuide() {
  const t = useTranslations();
  return (
    <details className="keyboard-guide">
      <summary>{t("guide.shortcuts")}</summary>
      <dl>
        <dt>
          <kbd>/</kbd>
        </dt>
        <dd>{t("guide.searchShortcut")}</dd>
        <dt>
          <kbd>?</kbd>
        </dt>
        <dd>{t("guide.helpShortcut")}</dd>
        <dt>
          <kbd>Esc</kbd>
        </dt>
        <dd>{t("guide.escapeShortcut")}</dd>
        <dt>
          <kbd>Tab</kbd>
        </dt>
        <dd>{t("guide.tabShortcut")}</dd>
      </dl>
    </details>
  );
}
