"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  MapPin,
  ChevronDown,
  Home,
  Compass,
  CalendarDays,
  MessageCircle,
  UserRound,
  ArrowUpRight,
  ChefHat,
  Truck,
  Package,
  Users,
  Settings,
  Wallet,
  ShieldCheck,
  ClipboardList,
  LifeBuoy,
  LogOut,
  Menu,
  X,
  Leaf,
  LayoutDashboard,
  Image as ImageIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  areaOptions,
  type Actor,
  type Offer,
  type Locale,
} from "@catera/domain";
import { Provider, CatalogProvider, useApp, api } from "./context";
import { Brand, ErrorNotice } from "./ui";
import { Select, SelectOption } from "./select";
import { catalogHref, howItWorksHref } from "@/lib/navigation";
import { Catalog, PackagePage, Compare, CatererPage } from "./marketplace";
import { Customer, DeliveryPage, Messages, Account, Support } from "./customer";
import { CheckoutPage, PaymentPage, Login } from "./purchase";
import dynamic from "next/dynamic";
const Seller = dynamic(() => import("./seller").then((m) => m.Seller));
const Onboarding = dynamic(() => import("./seller").then((m) => m.Onboarding));
const Admin = dynamic(() => import("./admin").then((m) => m.Admin));
export function Application({
  path,
  offers,
  issue,
}: {
  path: string[];
  offers: Offer[];
  issue: string | null;
}) {
  return (
    <CatalogProvider offers={offers}>
      <App path={path} issue={issue} />
    </CatalogProvider>
  );
}
// Lives above the route loading boundary so shared chrome keeps its DOM and state.
export function ApplicationLayout({
  actor,
  demo,
  locale,
  children,
}: {
  actor: Actor | null;
  demo: boolean;
  locale: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const root = pathname.split("/")[1];
  return (
    <Provider actor={actor} offers={[]} demo={demo} initialLocale={locale}>
      <Shell
        operational={
          ["seller", "admin"].includes(root) &&
          pathname !== "/seller/onboarding"
        }
      >
        {children}
      </Shell>
    </Provider>
  );
}
function App({ path, issue }: { path: string[]; issue: string | null }) {
  let body: ReactNode;
  const root = path[0] || "";
  const id = path[1];
  if (root === "login") body = <Login />;
  else if (root === "packages") body = <PackagePage slug={id} />;
  else if (root === "caterers") body = <CatererPage slug={id} />;
  else if (root === "compare") body = <Compare />;
  else if (root === "checkout") body = <CheckoutPage id={id} />;
  else if (root === "payment") body = <PaymentPage id={id} />;
  else if (root === "deliveries") body = <DeliveryPage id={id} />;
  else if (root === "messages") body = <Messages />;
  else if (["account", "addresses", "notifications"].includes(root))
    body = <Account view={root} />;
  else if (root === "support") body = <Support />;
  else if (root === "seller")
    body =
      id === "onboarding" ? <Onboarding /> : <Seller view={id || "today"} />;
  else if (root === "admin") body = <Admin view={id || "sellers"} />;
  else if (["home", "calendar", "subscriptions"].includes(root))
    body = <Customer view={root} id={id} />;
  else if (root === "brand") body = <AssetGallery />;
  else body = <Catalog caterer={root === "locations" ? id : undefined} />;
  return (
    <>
      {issue &&
      ["", "discover", "search", "locations", "categories"].includes(root) ? (
        <ErrorNotice message="Catera belum terhubung ke lingkungan V1. Konfigurasi Supabase diperlukan sebelum layanan tersedia." />
      ) : (
        body
      )}
    </>
  );
}
const customerNav = [
  ["/home", "Beranda", "Home", Home],
  [catalogHref, "Jelajah", "Discover", Compass],
  ["/calendar", "Jadwal", "Calendar", CalendarDays],
  ["/messages", "Pesan", "Messages", MessageCircle],
  ["/account", "Akun", "Account", UserRound],
] as const;
function Shell({
  children,
  operational,
}: {
  children: ReactNode;
  operational: boolean;
}) {
  const { actor, demo, t, locale, setLocale, area, setArea, compare } =
    useApp();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const isAdmin = pathname.startsWith("/admin");
  const links = isAdmin
    ? ([
        ["/admin/sellers", "Katerer", ShieldCheck],
        ["/admin/transactions", "Transaksi", Wallet],
        ["/admin/support", "Bantuan & refund", LifeBuoy],
        ["/admin/payouts", "Pencairan", Wallet],
        ["/admin/promotions", "Promosi", Leaf],
        ["/admin/reviews", "Moderasi ulasan", MessageCircle],
        ["/admin/audit", "Jejak audit", ClipboardList],
      ] as const)
    : ([
        ["/seller", "Hari ini", LayoutDashboard],
        ["/seller/schedule", "Jadwal", CalendarDays],
        ["/seller/production", "Produksi", ChefHat],
        ["/seller/delivery", "Pengiriman", Truck],
        ["/seller/packages", "Paket", Package],
        ["/seller/menus", "Menu", Leaf],
        ["/seller/capacity", "Kapasitas", ClipboardList],
        ["/seller/customers", "Pelanggan", Users],
        ["/seller/support", "Pesan & bantuan", MessageCircle],
        ...(actor?.role === "owner"
          ? ([
              ["/seller/transactions", "Transaksi", Wallet],
              ["/seller/settings", "Pengaturan", Settings],
            ] as const)
          : []),
      ] as const);
  return (
    <div className={operational ? "ops-layout" : "customer-layout"}>
      <a href="#main" className="skip-link">
        {t("Lewati ke konten", "Skip to content")}
      </a>
      {demo && (
        <div className="demo-ribbon">
          {t(
            "Demo eksplorasi · Katerer, menu, dan transaksi menggunakan data sintetis.",
            "Exploration demo · Caterers, meals, and transactions are synthetic.",
          )}
        </div>
      )}
      {operational ? (
        <>
          <aside className={"ops-sidebar " + (menu ? "open" : "")}>
            <Brand />
            <div className="workspace-label">
              <span className="workspace-icon">
                {isAdmin ? <ShieldCheck size={21} /> : <ChefHat size={21} />}
              </span>
              <div>
                <strong>{isAdmin ? "Catera Admin" : "Ruang katerer"}</strong>
                <small>{actor?.name}</small>
              </div>
            </div>
            <nav>
              {links.map(([href, label, Icon]) => (
                <Link
                  key={href}
                  className={pathname === href ? "selected" : ""}
                  href={href}
                  onClick={() => setMenu(false)}
                >
                  <Icon size={19} />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="sidebar-foot">
              <img src="/assets/mascot.png" alt="" />
              <strong>
                Good food.
                <br />
                Good days.
              </strong>
              <Link href="/">
                Lihat marketplace <ArrowUpRight size={16} />
              </Link>
            </div>
          </aside>
          {menu && (
            <button
              className="sidebar-backdrop"
              aria-label="Tutup menu"
              onClick={() => setMenu(false)}
            />
          )}
          <header className="ops-topbar">
            <button
              className="icon-button mobile-only"
              onClick={() => setMenu(!menu)}
              aria-label="Menu"
            >
              <Menu />
            </button>
            <span>
              {isAdmin
                ? "Marketplace & kepercayaan"
                : "Makanan baik dimulai dari dapur yang tertata."}
            </span>
            <Link
              href="/notifications"
              className="icon-button"
              aria-label="Notifikasi"
            >
              <Bell size={21} />
            </Link>
            <button
              className="avatar"
              onClick={() => {
                api.request("auth/logout", {}).then(() => location.assign("/"));
              }}
              title="Keluar"
            >
              {actor?.name[0]}
            </button>
          </header>
        </>
      ) : (
        <header className="site-header">
          <div className="header-inner">
            <Brand />
            <nav className="desktop-nav">
              <Link
                className={
                  ["/", "/discover"].includes(pathname) ? "selected" : ""
                }
                href={catalogHref}
              >
                {t("Jelajah katering", "Explore catering")}
              </Link>
              {actor ? (
                <>
                  <Link href="/home">{t("Makanan saya", "My meals")}</Link>
                  <Link href="/calendar">
                    {t("Jadwal makan", "Meal calendar")}
                  </Link>
                </>
              ) : (
                <Link href={howItWorksHref}>
                  {t("Cara berlangganan", "How it works")}
                </Link>
              )}
              <Link href={actor?.catererId ? "/seller" : "/seller/onboarding"}>
                {t("Untuk katerer", "For caterers")} <ArrowUpRight size={13} />
              </Link>
            </nav>
            <div className="header-actions">
              <Select
                className="locale-switch"
                aria-label={t("Bahasa", "Language")}
                value={locale}
                displayValue={locale.toUpperCase()}
                onValueChange={(value) => setLocale(value as Locale)}
              >
                <SelectOption value="id">Bahasa Indonesia</SelectOption>
                <SelectOption value="en">English</SelectOption>
              </Select>
              {actor ? (
                <>
                  <Link
                    href="/notifications"
                    className="icon-button"
                    aria-label="Notifikasi"
                  >
                    <Bell size={20} />
                  </Link>
                  <Link href="/account" className="avatar" aria-label="Akun">
                    {actor.name[0]}
                  </Link>
                </>
              ) : (
                <Link className="button small" href="/login">
                  {t("Masuk / Daftar", "Sign in")}
                </Link>
              )}
            </div>
          </div>
        </header>
      )}
      <main id="main" className={operational ? "ops-main" : "site-main"}>
        {children}
      </main>
      {!operational && (
        <>
          <footer className="site-footer">
            <div>
              <Brand small />
              <p>
                {t(
                  "Makanan baik, untuk hari-hari yang lebih baik.",
                  "Good meals, for better everyday living.",
                )}
              </p>
            </div>
            <div>
              <Link href={catalogHref}>
                {t("Jelajah katering", "Explore catering")}
              </Link>
              <Link href="/seller/onboarding">
                {t("Menjadi mitra", "Become a partner")}
              </Link>
              <Link href="/brand">
                {t("Identitas Catera", "Catera identity")}
              </Link>
            </div>
            <p>Good Food on Repeat.</p>
          </footer>
          <nav className="mobile-bottom">
            {customerNav.map(([href, id, en, Icon]) => (
              <Link
                key={href}
                href={href}
                className={
                  pathname === href ||
                  (href === catalogHref && pathname === "/")
                    ? "selected"
                    : ""
                }
              >
                <Icon size={21} />
                <span>{t(id, en)}</span>
              </Link>
            ))}
          </nav>
          {compare.length > 0 && !pathname.startsWith("/compare") && (
            <div className="compare-floating">
              <span>
                {compare.length} {t("paket dipilih", "packages selected")}
              </span>
              <Link className="button small" href="/compare">
                {t("Bandingkan", "Compare")}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
function AssetGallery() {
  const names = [
    "mascot",
    "wordmark",
    "lockup-horizontal",
    "lockup-stacked",
    "logo-forest",
    "logo-light",
    "app-icon",
    "adaptive-foreground",
    "leaf",
    "heart",
    "utensils",
    "repeat",
    "sparkle",
    "welcome",
    "empty-calendar",
    "confirmation",
  ];
  return (
    <div className="content">
      <h1>Identitas Catera</h1>
      <p className="lead">
        Good Food on Repeat. Aset individual yang dapat digunakan kembali.
      </p>
      <div className="asset-grid">
        {names.map((n) => (
          <a href={"/assets/" + n + ".png"} key={n} download>
            <img src={"/assets/" + n + ".png"} alt={n} />
            <strong>{n}</strong>
            <span>
              PNG master <ImageIcon size={14} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
