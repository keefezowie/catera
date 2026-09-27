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
import type { Caterer, SellerOffer } from "@catera/domain";
import { useApp } from "./context";

export function SellerReadiness({
  caterer,
  offers,
  always = false,
}: {
  caterer: Caterer;
  offers: SellerOffer[];
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
  const available = approved && published;
  if (available && !always) return null;

  const draft = offers.find((offer) => offer.status === "draft");
  const draftHref = draft
    ? "/seller/packages?edit=" + encodeURIComponent(draft.id)
    : "/seller/packages?new=1";
  const verificationHref = "/seller/profile#verification";
  const submitted = caterer.status === "submitted";
  const corrections = caterer.status === "corrections";
  const suspended = caterer.status === "suspended";
  // Review requires one saved package, even if its commercial fields are incomplete.
  const canRequestReview =
    profile &&
    offers.length > 0 &&
    ["draft", "corrections"].includes(caterer.status);

  let next: { label: string; href: string };
  let message: string;
  if (suspended) {
    next = {
      label: t("Lihat status katerer", "View caterer status"),
      href: verificationHref,
    };
    message = t(
      "Penjualan sedang ditangguhkan. Periksa catatan Catera pada profil Anda.",
      "Sales are paused. Check Catera's notes on your profile.",
    );
  } else if (corrections) {
    next = {
      label: t("Periksa catatan perbaikan", "Review requested changes"),
      href: verificationHref,
    };
    message = t(
      "Periksa catatan Catera, simpan perbaikan, lalu ajukan verifikasi kembali.",
      "Review Catera's notes, save your corrections, then request verification again.",
    );
  } else if (!profile) {
    next = {
      label: t("Lengkapi profil", "Complete your profile"),
      href: "/seller/profile",
    };
    message = t(
      "Simpan nama, deskripsi, dan area pengantaran sebelum mengajukan verifikasi.",
      "Save your name, description and delivery areas before requesting verification.",
    );
  } else if (!offers.length) {
    next = {
      label: t("Buat paket pertama", "Create your first package"),
      href: draftHref,
    };
    message = t(
      "Simpan paket pertama sebagai draf. Isian yang belum lengkap dapat dilanjutkan nanti.",
      "Save your first package as a draft. You can finish incomplete fields later.",
    );
  } else if (canRequestReview) {
    next = {
      label: t("Ajukan verifikasi", "Request verification"),
      href: verificationHref,
    };
    message = t(
      "Profil dan paket sudah tersimpan. Anda dapat mengajukan verifikasi sekarang.",
      "Your profile and package are saved. You can request verification now.",
    );
  } else if (!published) {
    next = {
      label: draft
        ? t("Lanjutkan draf paket", "Continue your package draft")
        : t("Buat paket baru", "Create a new package"),
      href: draftHref,
    };
    message = submitted
      ? t(
          "Catera sedang meninjau profil. Lengkapi paket sambil menunggu hasil verifikasi.",
          "Catera is reviewing your profile. Finish your package while you wait for verification.",
        )
      : t(
          "Lengkapi dan periksa ketentuan paket sebelum menayangkannya.",
          "Complete and review your package terms before publishing.",
        );
  } else if (!approved) {
    next = {
      label: t("Lihat status verifikasi", "View verification status"),
      href: verificationHref,
    };
    message = t(
      "Paket telah disiapkan untuk tayang. Pelanggan dapat membeli setelah Catera menyetujui profil Anda.",
      "Your package is prepared for publication. Customers can buy after Catera approves your profile.",
    );
  } else {
    next = {
      label: t("Lihat paket", "View your packages"),
      href: "/seller/packages",
    };
    message = t(
      "Paket sudah tersedia bagi pelanggan.",
      "Your package is available to customers.",
    );
  }

  const state = suspended
    ? t("Penjualan ditangguhkan", "Sales paused")
    : corrections
      ? t("Perlu perbaikan", "Changes requested")
      : available
        ? t("Tersedia bagi pelanggan", "Available to customers")
        : published
          ? t(
              "Paket tayang, menunggu persetujuan katerer",
              "Published, awaiting caterer approval",
            )
          : submitted
            ? t("Menunggu verifikasi katerer", "Awaiting caterer verification")
            : draft
              ? t("Draf paket tersimpan", "Package draft saved")
              : t("Belum ada paket tayang", "No published package");
  const steps = [
    {
      title: t("Profil & area pengantaran", "Profile & delivery area"),
      done: profile,
      href: "/seller/profile",
      Icon: Store,
    },
    {
      title: t("Simpan draf paket", "Save a package draft"),
      done: offers.length > 0,
      href: offers.length ? "/seller/packages" : draftHref,
      Icon: Package,
    },
    {
      title: submitted
        ? t("Verifikasi sedang ditinjau", "Verification under review")
        : t("Verifikasi katerer", "Caterer verification"),
      done: approved,
      href: verificationHref,
      Icon: ShieldCheck,
    },
    {
      title:
        published && suspended
          ? t("Paket tayang, penjualan ditangguhkan", "Published; sales paused")
          : published && !approved
            ? t(
                "Paket tayang, penjualan belum dibuka",
                "Published; sales not open yet",
              )
            : t("Tayangkan paket", "Publish a package"),
      done: published,
      href: published ? "/seller/packages" : draftHref,
      Icon: Package,
    },
  ];

  return (
    <section
      className="seller-readiness"
      aria-label={t("Siap berjualan", "Ready to sell")}
    >
      <div className="section-heading">
        <div>
          <h2>{t("Siap berjualan", "Ready to sell")}</h2>
          <p className="seller-readiness-state" role="status">
            {state}
          </p>
        </div>
      </div>
      <p>{message}</p>
      {caterer.review_note && (corrections || suspended) && (
        <p className="notice">{caterer.review_note}</p>
      )}
      <Link className="button seller-readiness-next" href={next.href}>
        {next.label}
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <details className="seller-readiness-checklist">
        <summary>
          {t("Lihat langkah persiapan", "View setup checklist")} ·{" "}
          {steps.filter((step) => step.done).length}/4{" "}
          {t("selesai", "complete")}
        </summary>
        <ol>
          {steps.map(({ title, done, href, Icon }) => (
            <li key={href + title} data-complete={done}>
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
        {caterer.review_note && !corrections && !suspended && (
          <p className="notice">{caterer.review_note}</p>
        )}
        <p className="field-hint">
          {t(
            "Aktivasi pencairan diperiksa terpisah di Pengaturan.",
            "Payout activation is checked separately in Settings.",
          )}
        </p>
      </details>
    </section>
  );
}
