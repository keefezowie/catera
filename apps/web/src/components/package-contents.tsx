"use client";
import {
  compositionPreview,
  componentLabel,
  menuItems,
  menuSourceLabel,
  menuSummary,
  mealLabel,
  nutritionSummary,
  packageNutrition,
  packageTypeLabel,
  type Offer,
} from "@catera/domain";
import { useApp } from "./context";
import { DishGallery } from "./dish-gallery";

export function PackageContents({
  offer,
  compact = false,
  presentation = "default",
  coverImage,
  preview = false,
}: {
  offer: Pick<Offer, "menus" | "packageType" | "nutrition">;
  compact?: boolean;
  presentation?: "default" | "gallery";
  coverImage?: string;
  preview?: boolean;
}) {
  const { locale, t } = useApp();
  const nutrition = packageNutrition(offer);
  if (presentation === "gallery")
    return (
      <DishGallery offer={offer} coverImage={coverImage} preview={preview} />
    );
  return (
    <div className={compact ? "contents-summary" : "package-contents"}>
      <strong>{packageTypeLabel(offer.packageType, locale)}</strong>
      {(nutritionSummary(nutrition, locale) || !compact) && (
        <p className="nutrition-line">
          {nutritionSummary(nutrition, locale) ||
            t("Informasi gizi belum tersedia", "Nutrition unavailable")}
          {nutritionSummary(nutrition, locale) && (
            <small>
              {t(
                "Per porsi makan · estimasi katerer",
                "Per meal portion · caterer estimate",
              )}
            </small>
          )}
        </p>
      )}
      {offer.menus.map((m) => (
        <section key={m.meal} className="meal-contents">
          <p className="contents-caption">
            {mealLabel(m.meal, locale)} · {menuSourceLabel(m, locale)}
          </p>
          {!!m.composition?.length && (
            <p>{compositionPreview(m, offer.packageType, locale)}</p>
          )}
          {compact ? (
            <p>{menuSummary(m, locale)}</p>
          ) : (
            <ul className="dish-list">
              {menuItems(m).map((i) => (
                <li key={i.id}>
                  {i.image && (
                    <img
                      src={i.image}
                      alt=""
                      loading="lazy"
                      width={64}
                      height={64}
                    />
                  )}
                  <div>
                    {i.groupId && (
                      <small>
                        {(() => {
                          const group = m.composition?.find(
                            (g) => g.id === i.groupId,
                          );
                          return group ? componentLabel(group, locale) : null;
                        })()}
                      </small>
                    )}
                    <strong>{i.name}</strong>
                    {i.serving && <span> · {i.serving}</span>}
                    {i.description && <p>{i.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export { MealContentsEditor } from "./meal-contents-editor";
