"use client";
import Link from "next/link";
import {
  Check,
  Store,
  Package,
  ShieldCheck,
  ArrowRight,
  Circle,
} from "lucide-react";
import type { Caterer, Offer } from "@catera/domain";
import { useApp } from "./context";
import { Status } from "./ui";

export function SellerReadiness({
  caterer,
  offers,
  always = false,
}: {
  caterer: Caterer;
  offers: Offer[];
  always?: boolean;
}) {
  const { actor, t } = useApp();
  if (actor?.role !== "owner") return null;
  const profile =
    caterer.name.trim().length >= 3 &&
    caterer.description.trim().length >= 10 &&
    caterer.area.length > 0;
  const approved = caterer.status === "approved";
  const published = offers.some((offer) => offer.status === "published");
  if (approved && published && !always) return null;
  const steps = [
    {
      title: t("Profil & area pengantaran", "Profile & delivery area"),
      done: profile,
      href: "/seller/settings",
      Icon: Store,
    },
    {
      title: t("Siapkan paket pertama", "Prepare your first package"),
      done: offers.length > 0,
      href: "/seller/packages",
      Icon: Package,
    },
    {
      title: t("Verifikasi katerer", "Caterer verification"),
      done: approved,
      href: "/seller/settings#verification",
      Icon: ShieldCheck,
    },
    {
      title: t("Tayangkan paket", "Publish a package"),
      done: published,
      href: "/seller/packages",
      Icon: Package,
    },
  ];
  const next = steps.find((step) => !step.done);
  return (
    <section
      className="seller-readiness"
      aria-label={t("Siap berjualan", "Ready to sell")}
    >
      <div className="section-heading">
        <div>
          <h2>{t("Siap berjualan", "Ready to sell")}</h2>
          <p>
            {steps.filter((step) => step.done).length} / 4{" "}
            {t("langkah selesai", "steps complete")}
          </p>
        </div>
        <Status status={caterer.status} />
      </div>
      <ol>
        {steps.map(({ title, done, href, Icon }) => (
          <li key={title} data-complete={done}>
            <Link href={href}>
              <Icon size={20} aria-hidden="true" />
              <span>{title}</span>
              {done ? (
                <Check size={19} aria-label={t("Selesai", "Complete")} />
              ) : (
                <Circle size={17} aria-hidden="true" />
              )}
            </Link>
          </li>
        ))}
      </ol>
      {caterer.review_note && <p className="notice">{caterer.review_note}</p>}
      {caterer.status === "submitted" ? (
        <p role="status">
          {t(
            "Profil sedang ditinjau Catera. Kamu dapat menyiapkan menu sambil menunggu.",
            "Catera is reviewing your profile. You can prepare menus while you wait.",
          )}
        </p>
      ) : (
        next && (
          <Link className="text-button" href={next.href}>
            {t("Langkah berikutnya: ", "Next: ")}
            {next.title}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        )
      )}
      {!approved && (
        <p className="field-hint">
          {t(
            "Penjualan dibuka setelah Catera menyetujui profil. Paket dapat disiapkan sebagai draf.",
            "Sales open after Catera approves your profile. You can prepare package drafts now.",
          )}
        </p>
      )}
    </section>
  );
}
