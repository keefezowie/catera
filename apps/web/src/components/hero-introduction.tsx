import { ArrowUpRight } from "lucide-react";
import { useApp } from "./context";
import { FoodImage } from "./food-image";

export function HeroIntroduction() {
  const { t } = useApp();
  return (
    <section className="market-hero">
      <div className="hero-copy">
        <h1>{t("Paket katering berlangganan", "Catering subscriptions")}</h1>
        <p>
          {t(
            "Bandingkan paket, pilih jumlah porsi, dan tentukan tanggal mulai pengantaran.",
            "Compare packages, choose portions, and select a delivery start date.",
          )}
        </p>
        <a className="button cream" href="#packages">
          {t("Lihat paket", "View packages")}
          <ArrowUpRight size={19} />
        </a>
      </div>
      <div className="hero-food">
        <FoodImage
          src="/assets/food/ayam-panggang.png"
          alt={t(
            "Ayam panggang, nasi hangat, dan sayuran segar",
            "Roast chicken, warm rice and fresh vegetables",
          )}
          fetchPriority="high"
          loading="eager"
          sizes="(max-width: 700px) 100vw, 620px"
          width="724"
          height="543"
        />
      </div>
    </section>
  );
}
