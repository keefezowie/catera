import { describe, expect, it } from "vitest";
import {
  catalogDefaults,
  readCatalogQuery,
  updateCatalogQuery,
} from "../apps/web/src/lib/catalog-query";

describe("shareable discovery state", () => {
  it("restores supported filters from a shared URL", () => {
    expect(
      readCatalogQuery(
        new URLSearchParams(
          "q=Ayam&meal=lunch&type=nasi_box&flexible=1&trial=1&plantBased=1&maxPrice=35000&sort=price",
        ),
      ),
    ).toEqual({
      search: "Ayam",
      meal: "lunch",
      packageType: "nasi_box",
      flex: true,
      trial: true,
      diet: true,
      max: "35000",
      sort: "price",
    });
  });
  it("ignores unsupported enum and non-finite price inputs", () => {
    for (const max of [
      "NaN",
      "Infinity",
      "-50",
      "2e9",
      "999999999999999999999",
    ]) {
      expect(
        readCatalogQuery(
          new URLSearchParams(
            `meal=invalid&type=invalid&sort=invalid&maxPrice=${max}`,
          ),
        ),
      ).toEqual(catalogDefaults);
    }
  });
  it("clears package type along with other filters while keeping sort and attribution", () => {
    const query = updateCatalogQuery(
      new URLSearchParams(
        "q=Ayam&type=nasi_box&meal=lunch&flexible=1&trial=1&maxPrice=10000&sort=price&invite=synthetic",
      ),
      { ...catalogDefaults, sort: "price" },
    );
    expect(query.toString()).toBe("sort=price&invite=synthetic");
  });
  it("removes one filter without losing the others", () => {
    const query = updateCatalogQuery(
      new URLSearchParams("q=Ayam&type=nasi_box&sort=rating"),
      { packageType: "all" },
    );
    expect(readCatalogQuery(query)).toMatchObject({
      search: "Ayam",
      packageType: "all",
      sort: "rating",
    });
    expect(query.has("type")).toBe(false);
  });
});
