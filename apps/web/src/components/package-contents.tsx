"use client";
import {
  menuItems,
  menuSummary,
  mealLabel,
  nutritionSummary,
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
  offer: Pick<Offer, "menus" | "packageType">;
  compact?: boolean;
  presentation?: "default" | "gallery";
  coverImage?: string;
  preview?: boolean;
}) {
  const { locale, t } = useApp();
  if (presentation === "gallery")
    return (
      <DishGallery offer={offer} coverImage={coverImage} preview={preview} />
    );
  return (
    <div className={compact ? "contents-summary" : "package-contents"}>
      <strong>{packageTypeLabel(offer.packageType, locale)}</strong>
      {offer.menus.map((m) => (
        <section key={m.meal} className="meal-contents">
          <p className="contents-caption">
            {mealLabel(m.meal, locale)} ·{" "}
            {m.source === "dated"
              ? t("Menu tanggal ini", "Menu for this date")
              : t("Menu awal / contoh", "Initial / example menu")}
          </p>
          {!!m.composition?.length && (
            <p>
              {m.composition.map((g) => `${g.slots} ${g.name}`).join(" · ")}
            </p>
          )}
          {compact ? (
            <p>{menuSummary(m)}</p>
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
                        {m.composition?.find((g) => g.id === i.groupId)?.name}
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
          {(nutritionSummary(m.nutrition, locale) || !compact) && (
            <p className="nutrition-line">
              {nutritionSummary(m.nutrition, locale) ||
                t("Informasi gizi belum tersedia", "Nutrition unavailable")}
              {nutritionSummary(m.nutrition, locale) && (
                <small>
                  {t(
                    "Per porsi · estimasi katerer",
                    "Per portion · caterer estimate",
                  )}
                </small>
              )}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

export { MealContentsEditor } from "./meal-contents-editor";
