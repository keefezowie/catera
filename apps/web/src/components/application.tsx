"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bell,
  MapPin,
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
  Menu,
  X,
  Leaf,
  LayoutDashboard,
  Image as ImageIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  areaOptions,
  type Actor,
  type Offer,
  type Locale,
  type Workspace,
} from "@catera/domain";
import { Provider, CatalogProvider, useApp } from "./context";
import { Button } from "./form-controls";
import { Brand, ErrorNotice } from "./ui";
import { LocaleSwitch } from "./locale-switch";
import { catalogHref, howItWorksHref } from "@/lib/navigation";
import { validDay } from "@/lib/meal-calendar";
import { Catalog, PackagePage, Compare, CatererPage } from "./marketplace";
import { Customer, DeliveryPage, Messages, Account, Support } from "./customer";
import { CheckoutPage, PaymentPage, Login } from "./purchase";
import { ProfileMenu } from "./profile-menu";
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
  workspace,
  children,
}: {
  actor: Actor | null;
  demo: boolean;
  locale: Locale;
  workspace: Workspace;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const root = pathname.split("/")[1];
  return (
    <Provider
      actor={actor}
      workspace={workspace}
      offers={[]}
      demo={demo}
      initialLocale={locale}
    >
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
  const { t } = useApp();
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
        <ErrorNotice
          message={t(
            "Catera belum terhubung ke lingkungan V1. Konfigurasi Supabase diperlukan sebelum layanan tersedia.",
            "Catera is not connected to the V1 environment. Supabase configuration is required before the service is available.",
          )}
        />
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
  const { actor, demo, t, area, setArea, compare, clearCompare } = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const operationsPaths = ["/seller", "/seller/schedule"];
  function workspaceHref(href: string) {
    if (!operationsPaths.includes(pathname) || !operationsPaths.includes(href))
      return href;
    const query = new URLSearchParams();
    const date = searchParams.get("date") || "";
    const meal = searchParams.get("meal");
    if (validDay(date)) query.set("date", date);
    if (meal === "lunch" || meal === "dinner") query.set("meal", meal);
    return query.size ? href + "?" + query : href;
  }
  const [menu, setMenu] = useState(false);
  const [section, setSection] = useState("packages");
  useEffect(() => {
    if (pathname !== "/") return;
    let frame = 0;
    let initialAnchor = location.hash.slice(1);
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (["packages", "how-it-works"].includes(initialAnchor)) {
          const target = document.getElementById(initialAnchor);
          if (target) {
            target.scrollIntoView({ behavior: "instant" });
            initialAnchor = "";
          }
        }
        const how = document.getElementById("how-it-works");
        setSection(
          how &&
            (how.getBoundingClientRect().top <= innerHeight * 0.4 ||
              (scrollY + innerHeight >=
                document.documentElement.scrollHeight - 2 &&
                how.getBoundingClientRect().top < innerHeight))
            ? "how-it-works"
            : "packages",
        );
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("hashchange", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("hashchange", update);
    };
  }, [pathname]);
  const root = pathname.split("/")[1];
  const customerDestination = ["home", "subscriptions"].includes(root)
    ? "/home"
    : ["calendar", "deliveries"].includes(root)
      ? "/calendar"
      : ["messages", "support"].includes(root)
        ? "/messages"
        : ["account", "addresses", "notifications", "login"].includes(root)
          ? "/account"
          : [
                "",
                "discover",
                "search",
                "locations",
                "categories",
                "packages",
                "caterers",
                "compare",
                "checkout",
                "payment",
              ].includes(root)
            ? catalogHref
            : null;
  const exploring =
    customerDestination === catalogHref &&
    (pathname !== "/" || section !== "how-it-works");
  const howActive = pathname === "/" && section === "how-it-works";
  const isAdmin = pathname.startsWith("/admin");
  const links = isAdmin
    ? ([
        ["/admin/sellers", t("Katerer", "Caterers"), ShieldCheck],
        ["/admin/transactions", t("Transaksi", "Transactions"), Wallet],
        [
          "/admin/support",
          t("Bantuan & refund", "Support & refunds"),
          LifeBuoy,
        ],
        ["/admin/payouts", t("Pencairan", "Payouts"), Wallet],
        ["/admin/promotions", t("Promosi", "Promotions"), Leaf],
        [
          "/admin/reviews",
          t("Moderasi ulasan", "Review moderation"),
          MessageCircle,
        ],
        ["/admin/audit", t("Jejak audit", "Audit trail"), ClipboardList],
      ] as const)
    : ([
        ["/seller", t("Hari ini", "Today"), LayoutDashboard],
        ["/seller/schedule", t("Jadwal", "Schedule"), CalendarDays],
        ["/seller/packages", t("Paket", "Packages"), Package],
        ["/seller/menus", t("Menu", "Menus"), Leaf],
        ["/seller/customers", t("Pelanggan", "Customers"), Users],
        [
          "/seller/support",
          t("Pesan & bantuan", "Messages & support"),
          MessageCircle,
        ],
        ...(actor?.role === "owner"
          ? ([
              ["/seller/transactions", t("Transaksi", "Transactions"), Wallet],
              ["/seller/settings", t("Pengaturan", "Settings"), Settings],
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
                <strong>
                  {isAdmin
                    ? "Catera Admin"
                    : t("Ruang katerer", "Caterer workspace")}
                </strong>
                <small>{actor?.name}</small>
              </div>
            </div>
            <nav>
              {links.map(([href, label, Icon]) => (
                <Link
                  key={href}
                  className={pathname === href ? "selected" : ""}
                  href={workspaceHref(href)}
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
                {t("Lihat marketplace", "View marketplace")}{" "}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </aside>
          {menu && (
            <Button
              className="sidebar-backdrop"
              aria-label={t("Tutup menu", "Close menu")}
              onClick={() => setMenu(false)}
            />
          )}
          <header className="ops-topbar">
            <Button
              className="icon-button mobile-only"
              onClick={() => setMenu(!menu)}
              aria-label={t("Menu", "Menu")}
            >
              <Menu />
            </Button>
            <span>
              {isAdmin
                ? t("Marketplace & kepercayaan", "Marketplace & trust")
                : t(
                    "Makanan baik dimulai dari dapur yang tertata.",
                    "Good food starts with an organized kitchen.",
                  )}
            </span>
            <LocaleSwitch />
            <Link
              href="/notifications"
              className="icon-button"
              aria-label={t("Notifikasi", "Notifications")}
            >
              <Bell size={21} />
            </Link>
            <ProfileMenu />
          </header>
        </>
      ) : (
        <header className="site-header">
          <div className="header-inner">
            <Brand />
            <nav className="desktop-nav">
              <Link
                className={exploring ? "selected" : ""}
                aria-current={exploring ? "location" : undefined}
                href={catalogHref}
              >
                {t("Jelajah katering", "Explore catering")}
              </Link>
              {actor ? (
                <>
                  <Link
                    href="/home"
                    className={
                      customerDestination === "/home" ? "selected" : ""
                    }
                    aria-current={
                      customerDestination === "/home" ? "page" : undefined
                    }
                  >
                    {t("Makanan saya", "My meals")}
                  </Link>
                  <Link
                    href="/calendar"
                    className={
                      customerDestination === "/calendar" ? "selected" : ""
                    }
                    aria-current={
                      customerDestination === "/calendar" ? "page" : undefined
                    }
                  >
                    {t("Jadwal makan", "Meal calendar")}
                  </Link>
                </>
              ) : (
                <Link
                  href={howItWorksHref}
                  className={howActive ? "selected" : ""}
                  aria-current={howActive ? "location" : undefined}
                >
                  {t("Cara berlangganan", "How it works")}
                </Link>
              )}
              <Link href={actor?.catererId ? "/seller" : "/seller/onboarding"}>
                {t("Untuk katerer", "For caterers")} <ArrowUpRight size={13} />
              </Link>
            </nav>
            <div className="header-actions">
              <LocaleSwitch />
              {actor ? (
                <>
                  <Link
                    href="/notifications"
                    className="icon-button"
                  aria-label={t("Notifikasi", "Notifications")}
                  >
                    <Bell size={20} />
                  </Link>
                  <ProfileMenu />
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
          {actor && (
            <nav className="mobile-bottom">
              {customerNav.map(([href, id, en, Icon]) => (
                <Link
                  key={href}
                  href={href}
                  className={customerDestination === href ? "selected" : ""}
                  aria-current={
                    customerDestination === href ? "page" : undefined
                  }
                >
                  <Icon size={21} />
                  <span>{t(id, en)}</span>
                </Link>
              ))}
            </nav>
          )}
          {compare.length > 0 && !pathname.startsWith("/compare") && (
            <aside
              className="compare-floating"
              aria-label={t("Pilihan perbandingan", "Comparison selection")}
            >
              <span>
                {compare.length} {t("paket dipilih", "packages selected")}
              </span>
              <Link className="button small" href="/compare">
                {t("Bandingkan", "Compare")}
                <ArrowUpRight size={16} />
              </Link>
              <Button
                className="icon-button compare-clear"
                type="button"
                onClick={clearCompare}
                aria-label={t(
                  "Hapus semua paket dari perbandingan",
                  "Clear all packages from comparison",
                )}
                title={t(
                  "Hapus semua paket dari perbandingan",
                  "Clear all packages from comparison",
                )}
              >
                <X size={18} aria-hidden="true" />
              </Button>
            </aside>
          )}
        </>
      )}
    </div>
  );
}
function AssetGallery() {
  const { t } = useApp();
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
      <h1>{t("Identitas Catera", "Catera identity")}</h1>
      <p className="lead">
        {t(
          "Good Food on Repeat. Aset individual yang dapat digunakan kembali.",
          "Good Food on Repeat. Individual assets ready to reuse.",
        )}
      </p>
      <div className="asset-grid">
        {names.map((n) => (
          <a href={"/assets/" + n + ".png"} key={n} download>
            <img src={"/assets/" + n + ".png"} alt={n} />
            <strong>{n}</strong>
            <span>
              {t("PNG master", "PNG master")} <ImageIcon size={14} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
