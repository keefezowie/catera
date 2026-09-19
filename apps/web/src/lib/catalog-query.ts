export const catalogDefaults = {
  search: "",
  meal: "all",
  packageType: "all",
  flex: false,
  trial: false,
  diet: false,
  max: "",
  sort: "recommended",
};

export type CatalogQuery = typeof catalogDefaults;
const queryKeys: Record<keyof CatalogQuery, string> = {
  search: "q",
  meal: "meal",
  packageType: "type",
  flex: "flexible",
  trial: "trial",
  diet: "plantBased",
  max: "maxPrice",
  sort: "sort",
};

/** Only supported values affect discovery; unrelated attribution parameters survive edits. */
export function readCatalogQuery(
  params: Pick<URLSearchParams, "get">,
): CatalogQuery {
  const option = (key: string, allowed: string[], fallback: string) => {
    const value = params.get(key) || "";
    return allowed.includes(value) ? value : fallback;
  };
  const max = params.get("maxPrice") || "";
  return {
    search: (params.get("q") || "").slice(0, 200),
    meal: option("meal", ["lunch", "dinner", "both"], "all"),
    packageType: option("type", ["ala_carte", "nasi_box"], "all"),
    flex: params.get("flexible") === "1",
    trial: params.get("trial") === "1",
    diet: params.get("plantBased") === "1",
    max: /^\d{1,10}$/.test(max) ? max : "",
    sort: option("sort", ["price", "rating"], "recommended"),
  };
}

export function updateCatalogQuery(
  params: URLSearchParams,
  patch: Partial<CatalogQuery>,
) {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(patch) as (keyof CatalogQuery)[]) {
    const value = patch[key];
    if (value === catalogDefaults[key] || value === undefined)
      next.delete(queryKeys[key]);
    else next.set(queryKeys[key], value === true ? "1" : String(value));
  }
  return next;
}
