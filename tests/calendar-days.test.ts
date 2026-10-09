import { describe, expect, it } from "vitest";
import { calendarDays, type Delivery, type MealMenu, type Offer } from "@catera/domain";

// Synthetic fixtures: only the fields calendarDays reads are filled in.
const PACKAGE_IMAGE = "https://images.example.test/package.jpg";

const menu = (meal: "lunch" | "dinner", extra: Partial<MealMenu> = {}): MealMenu => ({
  meal,
  name: meal === "lunch" ? "Ayam bakar" : "Ikan bakar",
  description: "",
  image: "",
  items: [{ id: `${meal}-1`, name: "Nasi", description: "", image: "", serving: "" }],
  ...extra,
});

const delivery = (
  date: string,
  meals: { meal: "lunch" | "dinner"; status?: string }[],
  menus: MealMenu[],
  extra: Partial<Delivery> = {},
): Delivery =>
  ({
    id: `d-${date}`,
    service_date: date,
    status: "scheduled",
    offer: { image: PACKAGE_IMAGE, menus } as unknown as Offer,
    meals: meals.map((m) => ({ status: "scheduled", ...m })),
    ...extra,
  }) as unknown as Delivery;

describe("calendarDays", () => {
  it("uses the lunch menu's own image", () => {
    const days = calendarDays([
      delivery("2026-10-09", [{ meal: "lunch" }], [menu("lunch", { image: "https://images.example.test/ayam.jpg" })]),
    ]);
    expect(days.get("2026-10-09")).toEqual({
      lunch: { image: "https://images.example.test/ayam.jpg", menuSet: true, delivered: false },
      dinner: null,
    });
  });

  it("falls back to a dish photo when the menu has none", () => {
    const withDish = menu("lunch", {
      items: [
        { id: "a", name: "Nasi", description: "", image: "", serving: "" },
        { id: "b", name: "Ayam", description: "", image: "https://images.example.test/dish.jpg", serving: "" },
      ],
    });
    const days = calendarDays([delivery("2026-10-09", [{ meal: "lunch" }], [withDish])]);
    expect(days.get("2026-10-09")?.lunch?.image).toBe("https://images.example.test/dish.jpg");
  });

  it("falls back to the package image when the menu image is empty, with the menu still set", () => {
    const days = calendarDays([delivery("2026-10-09", [{ meal: "lunch" }], [menu("lunch", { image: "" })])]);
    // No menu photo and no dish photo: the package photo stands in, and the menu counts as set.
    expect(days.get("2026-10-09")?.lunch).toEqual({ image: PACKAGE_IMAGE, menuSet: true, delivered: false });
  });

  it("marks a slot menu with no items as not set while keeping the package image", () => {
    const pending = menu("lunch", { contentModel: "slots", items: [] });
    const days = calendarDays([delivery("2026-10-09", [{ meal: "lunch" }], [pending])]);
    expect(days.get("2026-10-09")?.lunch).toEqual({ image: PACKAGE_IMAGE, menuSet: false, delivered: false });
  });

  it("gives an empty image when the package has none either", () => {
    const bare = delivery("2026-10-09", [{ meal: "lunch" }], [menu("lunch")]);
    (bare.offer as { image: string }).image = "";
    expect(calendarDays([bare]).get("2026-10-09")?.lunch?.image).toBe("");
  });

  it("treats a meal without a menu entry as not set", () => {
    const days = calendarDays([delivery("2026-10-09", [{ meal: "dinner" }], [menu("lunch")])]);
    expect(days.get("2026-10-09")?.dinner).toEqual({ image: PACKAGE_IMAGE, menuSet: false, delivered: false });
  });

  it("leaves a cancelled day out", () => {
    const days = calendarDays([
      delivery("2026-10-09", [{ meal: "lunch" }], [menu("lunch")], { status: "cancelled" }),
    ]);
    expect(days.has("2026-10-09")).toBe(false);
  });

  it("leaves a cancelled meal out", () => {
    const days = calendarDays([
      delivery("2026-10-09", [{ meal: "lunch", status: "cancelled" }], [menu("lunch")]),
    ]);
    expect(days.has("2026-10-09")).toBe(false);
  });

  it("gives a failed dinner as null and keeps the lunch", () => {
    const days = calendarDays([
      delivery(
        "2026-10-09",
        [{ meal: "lunch" }, { meal: "dinner", status: "issue" }],
        [menu("lunch"), menu("dinner")],
      ),
    ]);
    expect(days.get("2026-10-09")?.dinner).toBeNull();
    expect(days.get("2026-10-09")?.lunch).not.toBeNull();
  });

  it("leaves a day of only failed meals out", () => {
    const days = calendarDays([delivery("2026-10-09", [{ meal: "lunch", status: "issue" }], [menu("lunch")])]);
    expect(days.has("2026-10-09")).toBe(false);
  });

  it("gives both meals for lunch plus dinner on one day, in either storage order", () => {
    const days = calendarDays([
      delivery(
        "2026-10-09",
        [{ meal: "dinner" }, { meal: "lunch", status: "delivered" }],
        [menu("lunch", { image: "https://images.example.test/l.jpg" }), menu("dinner", { image: "https://images.example.test/d.jpg" })],
      ),
    ]);
    expect(days.get("2026-10-09")).toEqual({
      lunch: { image: "https://images.example.test/l.jpg", menuSet: true, delivered: true },
      dinner: { image: "https://images.example.test/d.jpg", menuSet: true, delivered: false },
    });
  });

  it("merges two deliveries of the same day, one per meal", () => {
    const days = calendarDays([
      delivery("2026-10-09", [{ meal: "lunch" }], [menu("lunch")]),
      { ...delivery("2026-10-09", [{ meal: "dinner" }], [menu("dinner")]), id: "d-second" },
    ]);
    const day = days.get("2026-10-09");
    expect(day?.lunch).not.toBeNull();
    expect(day?.dinner).not.toBeNull();
  });

  it("copes with a delivery whose meals list is missing", () => {
    const bare = { ...delivery("2026-10-09", [], [menu("lunch")]), meals: null } as unknown as Delivery;
    expect(calendarDays([bare]).size).toBe(0);
  });
});
