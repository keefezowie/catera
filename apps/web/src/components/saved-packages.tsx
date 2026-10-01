"use client";
import Link from "next/link";
import { useApp, CatalogProvider } from "./context";
import { errorLabel } from "@catera/domain";
import { useSaved, SaveButton } from "./saved-context";
import { PackageCard } from "./marketplace";
import { Heading, Empty, ErrorNotice, Loading } from "./ui";
import { Button } from "./form-controls";
import { FoodImage } from "./food-image";
export function SavedPackagesPage() {
  const { t, offers, locale } = useApp();
  const { items, ready, error, refresh, nextCursor, more, paging } = useSaved();
  const savedOffers = items.flatMap((item) => (item.offer ? [item.offer] : []));
  return (
    <div className="content saved-page">
      <Heading
        title={t("Paket tersimpan", "Saved packages")}
        description={t(
          "Pilih lagi saat Anda siap. Harga dan ketersediaan diperiksa saat checkout.",
          "Come back when you are ready. Prices and availability are checked at checkout.",
        )}
      >
        <Link className="button secondary" href="/#packages">
          {t("Jelajah paket", "Browse packages")}
        </Link>
      </Heading>
      {error && (
        <ErrorNotice
          message={
            errorLabel(error, locale) ||
            t(
              "Paket tersimpan belum berhasil dimuat.",
              "Saved packages could not be loaded.",
            )
          }
          retry={() => void refresh()}
        />
      )}
      {!ready && !error && <Loading />}
      {ready && !items.length && (
        <Empty
          title={t("Belum ada paket tersimpan", "No saved packages yet")}
          description={t(
            "Tekan Simpan pada paket yang menarik untuk Anda.",
            "Save a package you would like to try.",
          )}
          href="/#packages"
          label={t("Jelajah paket", "Browse packages")}
        />
      )}
      <CatalogProvider
        offers={[
          ...offers.filter(
            (offer) => !savedOffers.some((saved) => saved.id === offer.id),
          ),
          ...savedOffers,
        ]}
      >
        <div className="package-grid">
          {items.map((item) =>
            item.offer ? (
              <PackageCard key={item.packageId} offer={item.offer} />
            ) : (
              <article className="saved-unavailable" key={item.packageId}>
                <FoodImage
                  src={item.summary.image}
                  alt=""
                  width={724}
                  height={543}
                  sizes="(max-width:700px) 100vw, 400px"
                />
                <div>
                  <p>{item.summary.caterer}</p>
                  <h2>{item.summary.name}</h2>
                  <p className="badge">{t("Tidak tersedia", "Unavailable")}</p>
                  <p>
                    {t(
                      "Paket ini tidak menerima pesanan baru.",
                      "This package is not accepting new orders.",
                    )}
                  </p>
                  <SaveButton
                    packageId={item.packageId}
                    name={item.summary.name}
                  />
                </div>
              </article>
            ),
          )}
        </div>
      </CatalogProvider>
      {nextCursor && (
        <Button
          variant="secondary"
          disabled={paging}
          onClick={() => void more()}
        >
          {paging ? t("Memuat…", "Loading…") : t("Muat lainnya", "Load more")}
        </Button>
      )}
    </div>
  );
}
