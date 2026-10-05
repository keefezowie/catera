"use client";
import { PolicyVersionContext } from "@/lib/workspace-context";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  CalendarDays,
  LayoutDashboard,
  ChefHat,
  Truck,
  Users,
  Layers,
  UtensilsCrossed,
  Settings,
  Home,
  Package,
  User,
  LogOut,
  ChevronsUpDown,
  Menu as MenuIcon,
  X,
  ArrowUpRight,
  CircleHelp,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { logout, setLocale } from "@/app/actions";
import type { Snapshot } from "@/lib/types";
const icons = {
  today: LayoutDashboard,
  schedule: CalendarDays,
  production: ChefHat,
  delivery: Truck,
  customers: Users,
  packages: Layers,
  menus: UtensilsCrossed,
  settings: Settings,
  home: Home,
  package: Package,
  profile: User,
};
export function Shell({
  snapshot: s,
  demo,
  children,
}: {
  snapshot: Snapshot;
  demo: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations(),
    locale = useLocale(),
    pathname = usePathname(),
    query = useSearchParams(),
    [open, setOpen] = useState(false),
    subscriber = s.role === "subscriber",
    base = "/w/" + s.business.slug;
  const router = useRouter(),
    [saved, setSaved] = useState<{ key: string; sequence: number } | null>(
      null,
    ),
    savedSequence = useRef(0),
    sidebar = useRef<HTMLElement>(null),
    menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled)",
        ) || [],
      ).filter(
        (el) =>
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== "hidden",
      );
    sidebar.current
      ?.querySelector<HTMLButtonElement>(".sidebar-close")
      ?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "Tab") {
        const elements = focusable(),
          first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const resize = () => {
      if (window.innerWidth > 800) setOpen(false);
    };
    document.addEventListener("keydown", keyboard);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyboard);
      window.removeEventListener("resize", resize);
      menuButton.current?.focus();
    };
  }, [open]);
  useEffect(() => {
    const notify = (event: Event) => {
      const detail = (
          event as CustomEvent<{ action?: string; status?: string }>
        ).detail,
        key = detail?.status
          ? detail.status + "Success"
          : detail?.action + "Success";
      setSaved({ key, sequence: ++savedSequence.current });
    };
    window.addEventListener("catera:saved", notify);
    return () => {
      window.removeEventListener("catera:saved", notify);
    };
  }, []);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 7000);
    return () => clearTimeout(timer);
  }, [saved]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", refresh);
    const interval = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(interval);
    };
  }, [router]);
  const groups = subscriber
    ? [["home", "schedule", "package", "profile"]]
    : [
        ["today"],
        [
          "customers",
          "packages",
          "menus",
          ...(s.role === "owner" ? ["settings"] : []),
        ],
      ];
  const helpTopic = pathname.endsWith("/profile")
      ? "address"
      : pathname.endsWith("/package")
        ? "quota"
        : pathname.includes("production")
          ? "production"
          : pathname.includes("customers")
            ? "schedule"
            : pathname.includes("packages")
              ? "packages"
              : pathname.includes("menus")
                ? "offerings"
                : pathname.includes("deliver")
                  ? "fulfillment"
                  : subscriber
                    ? "menu"
                    : "schedule",
    helpParams = new URLSearchParams({
      topic: subscriber && helpTopic === "fulfillment" ? "cutoff" : helpTopic,
    }),
    contentClass = subscriber
      ? pathname.endsWith("/home")
        ? "customer-home"
        : pathname.endsWith("/schedule")
          ? "customer-schedule"
          : pathname.endsWith("/help")
            ? "customer-help"
            : ""
      : "";
  const focusedDelivery = s.deliveries.find(
    (d) =>
      d.id ===
      (query.get("delivery") || pathname.match(/\/deliveries\/([^/]+)$/)?.[1]),
  );
  const focusedCustomer = s.customers.find(
    (c) =>
      c.id ===
      (focusedDelivery?.customer_id ||
        pathname.match(/\/customers\/([^/]+)$/)?.[1]),
  );
  if (focusedDelivery) helpParams.set("delivery", focusedDelivery.id);
  if (focusedCustomer) helpParams.set("customer", focusedCustomer.id);
  const helpDate = focusedDelivery?.service_date || query.get("date");
  if (helpDate && /^\d{4}-\d{2}-\d{2}$/.test(helpDate))
    helpParams.set("date", helpDate);
  const helpSlot = focusedDelivery?.slot_id || query.get("slot");
  if (helpSlot && s.slots.some((slot) => slot.id === helpSlot))
    helpParams.set("slot", helpSlot);
  const helpHref = base + (subscriber ? "" : "/admin") + "/help?" + helpParams;
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest("input,textarea,select,[contenteditable=true]") ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (event.key === "/") {
        const search = document.querySelector<HTMLInputElement>(
          'main input[type="search"], main .search-control input',
        );
        if (search) {
          event.preventDefault();
          search.focus();
        }
      } else if (event.key === "?") {
        event.preventDefault();
        router.push(helpHref);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [helpHref, router]);
  const nav = (key: string) => {
    const Icon = icons[key as keyof typeof icons];
    const href = base + (subscriber ? "" : "/admin") + "/" + key;
    const selected =
      pathname === href ||
      pathname.startsWith(href + "/") ||
      (!subscriber &&
        key === "today" &&
        ["schedule", "production", "delivery", "deliveries"].some((stage) =>
          pathname.startsWith(base + "/admin/" + stage),
        )) ||
      (key === "schedule" && pathname.includes("/deliveries/"));
    const date =
      !subscriber &&
      ["today", "schedule", "production", "delivery"].includes(key) &&
      query.get("date")
        ? "?date=" + query.get("date")
        : "";
    return (
      <Link
        href={href + date}
        key={key}
        className={"nav-link " + (selected ? "selected" : "")}
        onClick={() => setOpen(false)}
        aria-current={selected ? "page" : undefined}
      >
        <Icon size={19} strokeWidth={1.7} />
        <span>{t(key)}</span>
      </Link>
    );
  };
  return (
    <PolicyVersionContext value={s.business.version}>
      <div className={"app-shell " + (subscriber ? "subscriber-shell" : "")}>
        <a className="skip-link" href="#main-content">
          {t("skipToContent")}
        </a>
        <aside
          ref={sidebar}
          id="workspace-navigation"
          className={"sidebar " + (open ? "mobile-open" : "")}
          role={open ? "dialog" : undefined}
          aria-modal={open || undefined}
          aria-label={t("navigation")}
        >
          <Link
            href={base + (subscriber ? "/home" : "/admin/today")}
            className="brand-logo"
            aria-label="Catera"
          />
          <button
            className="icon-button sidebar-close"
            onClick={() => setOpen(false)}
            aria-label={t("close")}
          >
            <X />
          </button>
          <Link href="/workspaces" className="business-switch">
            <span className="business-initial">
              {s.business.name.slice(0, 1)}
            </span>
            <span>
              <strong>{s.business.name}</strong>
              <small>{t(s.role)}</small>
            </span>
            <ChevronsUpDown size={16} />
          </Link>
          <nav>
            {groups.map((group, i) => (
              <div className="nav-group" key={i}>
                {!subscriber && <p>{t(i ? "records" : "operations")}</p>}
                {group.map(nav)}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <Link
              href={helpHref}
              className={
                "nav-link help-nav " +
                (pathname.endsWith("/help") ? "selected" : "")
              }
              onClick={() => setOpen(false)}
              aria-current={pathname.endsWith("/help") ? "page" : undefined}
            >
              <CircleHelp size={18} />
              {t("help")}
            </Link>
            <div className="brand-note">
              <span className="brand-mascot" />
              <p>
                Good Food
                <br />
                on Repeat.
              </p>
            </div>
            <form action={logout}>
              <button className="nav-link">
                <LogOut size={18} />
                {t("logout")}
              </button>
            </form>
          </div>
        </aside>
        {open && (
          <button
            className="sidebar-scrim"
            tabIndex={-1}
            aria-label={t("close")}
            onClick={() => setOpen(false)}
          />
        )}
        <div className="main-column" inert={open}>
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="icon-button mobile-menu"
                ref={menuButton}
                aria-label={t("navigation")}
                aria-controls="workspace-navigation"
                aria-expanded={open}
                onClick={() => setOpen(true)}
              >
                <MenuIcon />
              </button>
              <span>{t(subscriber ? "subscriberView" : "adminView")}</span>
            </div>
            <div className="topbar-right">
              <Link
                href={helpHref}
                className="icon-button contextual-help"
                aria-label={t("help")}
                title={t("help")}
              >
                <CircleHelp size={19} />
              </Link>
              {demo && <span className="demo-label">{t("synthetic")}</span>}
              <form action={setLocale} className="language-control">
                <button
                  name="locale"
                  value={locale === "id" ? "en" : "id"}
                  aria-label={
                    locale === "id"
                      ? "Switch to English"
                      : "Ganti ke Bahasa Indonesia"
                  }
                >
                  {locale.toUpperCase()}
                  <span> / {locale === "id" ? "EN" : "ID"}</span>
                </button>
              </form>
              <div className="avatar">
                {subscriber
                  ? s.customers[0]?.name.slice(0, 1)
                  : s.role === "owner"
                    ? "P"
                    : "A"}
              </div>
            </div>
          </header>
          <div className="save-notice" role="status" aria-live="polite">
            {saved && (t.has(saved.key) ? t(saved.key) : t("saved"))}
          </div>
          <main
            id="main-content"
            tabIndex={-1}
            className={"main-content " + contentClass}
          >
            {children}
          </main>
          {demo && <footer className="demo-footer">{t("demo")}</footer>}
        </div>
        {subscriber && (
          <nav className="bottom-nav" inert={open} aria-label={t("navigation")}>
            {groups[0].map(nav)}
          </nav>
        )}
      </div>
    </PolicyVersionContext>
  );
}
