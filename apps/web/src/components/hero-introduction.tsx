import { Asterisk, ArrowUpRight, Check, Sun } from "lucide-react";
import { useApp } from "./context";

export function HeroIntroduction() {
  const { t } = useApp();
  return (
    <section className="market-hero">
      <div className="hero-copy">
        <h1>
          {t("Makan enak.", "Eat well.")}
          <br />
          {t("Setiap hari.", "Every day.")}
          <Asterisk className="hero-dot" aria-hidden="true" />
        </h1>
        <p>
          {t(
            "Katering yang pas untuk keseharian Anda. Pilih makanannya, atur jadwalnya, nikmati harinya.",
            "Catering that fits your everyday. Choose your meals, set your schedule, enjoy your day.",
          )}
        </p>
        <a className="button cream" href="#packages">
          {t("Temukan paketmu", "Find your meals")}
          <ArrowUpRight size={19} />
        </a>
        <div className="hero-benefits">
          <span>
            <Check size={15} />
            {t("Pengantaran termasuk", "Delivery included")}
          </span>
          <span>
            <Check size={15} />
            {t("Bisa coba dulu", "Try before subscribing")}
          </span>
        </div>
      </div>
      <div className="hero-food">
        <img
          src="/assets/food/ayam-panggang.png"
          alt={t(
            "Ayam panggang, nasi hangat, dan sayuran segar",
            "Roast chicken, warm rice and fresh vegetables",
          )}
          fetchPriority="high"
          width="724"
          height="543"
        />
        <div className="hero-food-caption">
          <span>
            <Sun size={18} />
            {t("Satu urusan berkurang.", "One less thing to plan.")}
          </span>
          <strong>
            {t("Satu hari lebih menyenangkan.", "A little more joy every day.")}
          </strong>
        </div>
      </div>
    </section>
  );
}
