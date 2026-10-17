import { z } from "zod";
import { monthName } from "./kitchen";
import type { Locale } from "./index";

/** What still uses an address (the `address-use` read): upcoming days and live pending checkouts. */
export type AddressUse = {
  addressId: string;
  /** Delivery days dated today (Jakarta) or later, not delivered or cancelled, that carry this address. */
  count: number;
  from: string | null;
  to: string | null;
  kitchens: { id: string; name: string }[];
  pendingCheckouts: number;
};

/** The answer of `address.replace`: what moved, what stayed and why, and whether the old address is gone. */
export type AddressReplaceResult = {
  fromAddressId: string;
  toAddressId: string;
  moved: number;
  stayed: number;
  stayedUntil: string | null;
  /** Kitchens with a day that stayed: COVERAGE when the new address is outside their area, else CUTOFF. */
  kitchens: { id: string; name: string; reason: "COVERAGE" | "CUTOFF" }[];
  pendingCheckouts: number;
  deleted: boolean;
};

export const addressDeleteSchema = z.object({ addressId: z.uuid() }).strict();
export const addressReplaceSchema = z
  .object({ fromAddressId: z.uuid(), toAddressId: z.uuid() })
  .strict()
  .refine((p) => p.fromAddressId !== p.toAddressId);

export const addressInUse = (use: AddressUse) => use.count > 0 || use.pendingCheckouts > 0;

/** "13 Okt": the day and short month of a calendar date (YYYY-MM-DD). */
export function dayMonth(date: string, locale: Locale) {
  return `${Number(date.slice(8, 10))} ${monthName(date, locale)}`;
}

/** The in-use sentence of the delete sheet, from the read; a pending payment is named when no day is booked yet. */
export function addressUseLine(use: AddressUse, locale: Locale): string {
  const en = locale === "en";
  if (use.count > 0 && use.from && use.to) {
    const range =
      use.from === use.to
        ? dayMonth(use.from, locale)
        : `${dayMonth(use.from, locale)} ${en ? "to" : "sampai"} ${dayMonth(use.to, locale)}`;
    return en
      ? `This address is still used for ${use.count} ${use.count === 1 ? "delivery" : "deliveries"}, ${range}.`
      : `Alamat ini masih dipakai untuk ${use.count} pengantaran, ${range}.`;
  }
  return en
    ? "This address is still used by a payment that has not finished. Try again once it is paid or has expired."
    : "Alamat ini masih dipakai untuk pembayaran yang belum selesai. Coba lagi setelah dibayar atau kedaluwarsa.";
}

/** What the move left behind, for the sheet after `address.replace`. Empty when every day moved. */
export function addressReplaceLine(result: AddressReplaceResult, locale: Locale): string {
  if (!result.stayed) return "";
  const en = locale === "en";
  const until = result.stayedUntil ? dayMonth(result.stayedUntil, locale) : "";
  const outside = result.kitchens.filter((k) => k.reason === "COVERAGE").map((k) => k.name);
  const days = en
    ? `${result.stayed} ${result.stayed === 1 ? "delivery stays" : "deliveries stay"} at the old address until ${until}`
    : `${result.stayed} pengantaran tetap ke alamat lama sampai ${until}`;
  if (!outside.length)
    return en ? `${days}, because the change deadline has passed.` : `${days}, karena sudah lewat batas waktu.`;
  const names = outside.join(", ");
  const late = result.kitchens.some((k) => k.reason === "CUTOFF");
  return en
    ? `${days}. ${names} ${outside.length === 1 ? "does" : "do"} not deliver to the new address${late ? ", and some deliveries are past the change deadline" : ""}.`
    : `${days}. ${names} tidak mengantar ke alamat baru${late ? ", dan sebagian pengantaran sudah lewat batas waktu" : ""}.`;
}
