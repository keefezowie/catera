"use client";
import Link from "next/link";
import { Flame, Dumbbell, Wheat, Droplet, ArrowRight } from "lucide-react";
import {
  compositionPreview,
  nutritionMetrics,
  menuSourceLabel,
  type MealMenu,
  type Offer,
} from "@catera/domain";
import { useApp } from "./context";
import { Button } from "./form-controls";

const icons = [Flame, Dumbbell, Wheat, Droplet];
export function NutritionStrip({ menu }: { menu: MealMenu }) {
  const { locale, t } = useApp();
  const metrics = nutritionMetrics(menu.nutrition, locale);
  if (!metrics.length) return null;
  return (
    <div className="nutrition-strip">
      <dl>
        {metrics.map((metric, index) => {
          const Icon = icons[index];
          return (
            <div key={metric.key}>
              <dt>
                <Icon size={16} aria-hidden="true" />
                {metric.label}
              </dt>
              <dd
                aria-label={
                  !metric.available
                    ? t("Belum tersedia", "Unavailable")
                    : undefined
                }
              >
                {metric.value}
              </dd>
            </div>
          );
        })}
      </dl>
      <p>
        {t(
          "Estimasi katerer · per porsi makan",
          "Caterer estimate · per meal portion",
        )}
      </p>
    </div>
  );
}

export function PackagePreview({
  offer,
  meal,
  onMealChange,
  preview = false,
}: {
  offer: Offer;
  meal: string;
  onMealChange: (meal: string) => void;
  preview?: boolean;
}) {
  const { locale, t } = useApp();
  const menu = offer.menus.find((m) => m.meal === meal) || offer.menus[0];
  if (!menu) return null;
  return (
    <div className="package-preview">
      <div className="preview-heading">
        {offer.meal === "both" && (
          <div
            className="meal-switch"
            role="group"
            aria-label={t("Pratinjau menu", "Menu preview")}
          >
            {["lunch", "dinner"].map((value) => (
              <Button
                type="button"
                key={value}
                aria-pressed={menu.meal === value}
                disabled={!offer.menus.some((m) => m.meal === value)}
                onClick={() => onMealChange(value)}
              >
                {value === "lunch" ? t("Siang", "Lunch") : t("Malam", "Dinner")}
              </Button>
            ))}
          </div>
        )}
        <span className="preview-source">{menuSourceLabel(menu, locale)}</span>
      </div>
      <p className="composition-preview">
        {compositionPreview(menu, offer.packageType, locale)}
      </p>
      <Link
        href={`/packages/${offer.slug}#isi-paket-${menu.meal}`}
        aria-disabled={preview}
        tabIndex={preview ? -1 : undefined}
        onClick={(e) => {
          if (preview) e.preventDefault();
        }}
        className="contents-link"
      >
        {t("Lihat isi paket", "See included dishes")}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
      <NutritionStrip menu={menu} />
    </div>
  );
}
