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
} from "lucide-react";
import { useState, useEffect } from "react";
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
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const notify = () => {
      setSaved(true);
      clearTimeout(timer);
      timer = setTimeout(() => setSaved(false), 5000);
    };
    window.addEventListener("catera:saved", notify);
    return () => {
      window.removeEventListener("catera:saved", notify);
      clearTimeout(timer);
    };
  }, []);
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
        ["today", "schedule", "production", "delivery"],
        ["customers", "packages", "menus", "settings"],
      ];
  const nav = (key: string) => {
    const Icon = icons[key as keyof typeof icons];
    const href = base + (subscriber ? "" : "/admin") + "/" + key;
    const selected =
      pathname === href ||
      pathname.startsWith(href + "/") ||
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
        <aside className={"sidebar " + (open ? "mobile-open" : "")}>
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
            aria-label={t("close")}
            onClick={() => setOpen(false)}
          />
        )}
        <div className="main-column">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="icon-button mobile-menu"
                aria-label={t("workspace")}
                onClick={() => setOpen(true)}
              >
                <MenuIcon />
              </button>
              <span>{t(subscriber ? "subscriberView" : "adminView")}</span>
            </div>
            <div className="topbar-right">
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
            {saved ? t("saved") : ""}
          </div>
          <main className="main-content">{children}</main>
          {demo && <footer className="demo-footer">{t("demo")}</footer>}
        </div>
        {subscriber && <nav className="bottom-nav">{groups[0].map(nav)}</nav>}
      </div>
    </PolicyVersionContext>
  );
}
