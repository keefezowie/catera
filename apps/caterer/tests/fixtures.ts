import type { SellerOperationsState } from "@catera/domain";

/** The canvas day: 28 portions of Makan Siang Rumahan and 6 of Paket Hemat Kantor. */
export const DATE = "2026-10-07";
const composition = (lauk: number) => [
  { id: "g-nasi", name: "Nasi", slots: 1 },
  { id: "g-lauk", name: "Lauk", slots: lauk },
  { id: "g-sayur", name: "Sayur", slots: 1 },
];
const offer = (id: string, name: string, lauk: number) => ({
  id,
  name,
  menus: [{ meal: "lunch", name, description: "", image: "", composition: composition(lauk) }],
});
const rumahan = offer("p-rumahan", "Makan Siang Rumahan", 2);
const hemat = offer("p-hemat", "Paket Hemat Kantor", 1);

let seq = 0;
export function delivery(
  pkg: { id: string; name: string },
  name: string,
  portions: number,
  extra: { status?: string; recordId?: string; cutoffAt?: string } = {},
) {
  seq += 1;
  return {
    id: `d-${seq}`,
    subscription_id: `s-${seq}`,
    service_date: DATE,
    status: extra.status ?? "scheduled",
    version: 3,
    portions,
    trial: false,
    offer: pkg,
    meals: [{ meal: "lunch", status: extra.status ?? "scheduled" }],
    cutoff_at: extra.cutoffAt ?? "2026-10-06T10:00:00Z",
    canChange: false,
    customer: { id: `c-${seq}`, name, recordId: extra.recordId },
    address: {
      id: `a-${seq}`,
      label: "",
      line: `Jl. Melati ${seq}`,
      area: "Tebet",
      city: "Jakarta Selatan",
      instructions: "",
      version: 1,
    },
  };
}

export function canvasDay(): SellerOperationsState {
  return {
    caterer: { id: "k-1", name: "Dapur Bu Rina" },
    offers: [rumahan, hemat],
    customers: [{ id: "c-x", name: "x", source: "seller" }],
    cases: [],
    transactions: [],
    staff: [],
    payouts: [],
    operationalDate: DATE,
    today: DATE,
    deliveries: [
      delivery(rumahan, "Bu Sari Wulandari", 2, { recordId: "r-1", cutoffAt: "2099-01-01T00:00:00Z" }),
      delivery(rumahan, "Keluarga Hartono", 3),
      delivery(rumahan, "Kost Damai", 23),
      delivery(hemat, "Kantor PT Sinar Rasa", 6),
    ],
    datedMenus: [],
  } as unknown as SellerOperationsState;
}

/** A brand-new kitchen: no packages, no customers, nothing to deliver. */
export function emptyDay(): SellerOperationsState {
  return { ...canvasDay(), deliveries: [], customers: [], offers: [] } as unknown as SellerOperationsState;
}
/** Packages and customers imported without Catera accounts, but nothing to deliver on this day. */
export function quietDay(): SellerOperationsState {
  return { ...canvasDay(), deliveries: [], customers: [] } as unknown as SellerOperationsState;
}
