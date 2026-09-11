"use client";
import { useRef, useState } from "react";
import {
  menuItems,
  mealLabel,
  menuSourceLabel,
  type Offer,
  type Dish,
} from "@catera/domain";
import { useApp } from "./context";
import { Button } from "./form-controls";
import { Dialog } from "./ui";
import { NutritionStrip } from "./package-preview";

function DishTile({
  dish,
  group,
  duplicate,
  onOpen,
}: {
  dish: Dish;
  group?: string;
  duplicate: boolean;
  onOpen: (dish: Dish, button: HTMLButtonElement) => void;
}) {
  const { t } = useApp();
  const [failed, setFailed] = useState(false);
  return (
    <li className="dish-tile">
      {!!dish.image && !failed && !duplicate && (
        <Button
          type="button"
          className="dish-photo"
          aria-label={t("Lihat foto ", "View photo ") + dish.name}
          onClick={(e) => onOpen(dish, e.currentTarget)}
        >
          <img
            src={dish.image}
            alt={dish.name}
            loading="lazy"
            width={400}
            height={300}
            onError={() => setFailed(true)}
          />
          <span>{t("Lihat foto", "View photo")}</span>
        </Button>
      )}
      <div className="dish-description">
        {group && <span className="dish-component">{group}</span>}
        <h4>{dish.name}</h4>
        {dish.serving && <p className="dish-serving">{dish.serving}</p>}
        {dish.description && <p>{dish.description}</p>}
        {duplicate && !failed && (
          <Button
            type="button"
            className="contents-link"
            onClick={(e) => onOpen(dish, e.currentTarget)}
          >
            {t("Lihat foto hidangan", "View dish photo")}
          </Button>
        )}
      </div>
    </li>
  );
}

export function DishGallery({
  offer,
  coverImage,
  preview = false,
}: {
  offer: Pick<Offer, "menus" | "packageType">;
  coverImage?: string;
  preview?: boolean;
}) {
  const { locale, t } = useApp();
  const [selected, setSelected] = useState<Dish | null>(null);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="package-contents dish-gallery">
      {offer.menus.map((menu) => {
        const dishes = menuItems(menu);
        return (
          <section
            key={menu.meal}
            id={preview ? undefined : `isi-paket-${menu.meal}`}
            className="gallery-meal"
            tabIndex={-1}
          >
            <div className="gallery-heading">
              <h3>{mealLabel(menu.meal, locale)}</h3>
              <span>{menuSourceLabel(menu, locale)}</span>
            </div>
            {!!menu.composition?.length && (
              <p className="gallery-composition">
                {menu.composition
                  .map((g) => `${g.slots} ${g.name}`)
                  .join(" · ")}
              </p>
            )}
            <ul
              className={
                "dish-grid " + (dishes.length === 1 ? "single-dish" : "")
              }
            >
              {dishes.map((dish) => (
                <DishTile
                  key={`${dish.id}:${dish.image}`}
                  dish={dish}
                  group={
                    menu.composition?.find((g) => g.id === dish.groupId)?.name
                  }
                  duplicate={
                    dishes.length === 1 &&
                    !!dish.image &&
                    dish.image === coverImage
                  }
                  onOpen={(value, button) => {
                    trigger.current = button;
                    setFailed(false);
                    setSelected(value);
                  }}
                />
              ))}
            </ul>
            <NutritionStrip menu={menu} />
          </section>
        );
      })}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.name || t("Foto hidangan", "Dish photo")}
        description={
          selected?.serving ||
          t(
            "Hidangan yang termasuk dalam menu ini.",
            "A dish included in this menu.",
          )
        }
        className="dish-viewer"
        closeLabel={t("Tutup", "Close")}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        {selected &&
          (failed ? (
            <p>
              {t(
                "Foto belum dapat ditampilkan.",
                "This photo could not be displayed.",
              )}
            </p>
          ) : (
            <img
              src={selected.image}
              alt={selected.name}
              onError={() => setFailed(true)}
            />
          ))}
      </Dialog>
    </div>
  );
}
