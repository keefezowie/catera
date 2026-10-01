import { z } from "zod";
import type { Offer } from "./index";

export const savedPackageSchema = z
  .object({
    packageId: z.string().uuid(),
    saved: z.boolean(),
  })
  .strict();

export type SavedPackage = {
  packageId: string;
  savedAt: string;
  summary: { name: string; caterer: string; image: string; slug: string };
  offer: Offer | null;
};
export type SavedPackages = {
  /** Complete membership, including unavailable packages and later pages. */
  packageIds: string[];
  items: SavedPackage[];
  nextCursor: string | null;
};
export type SavedPackageResult = { packageId: string; saved: boolean };

/** A gesture may advance only one item from its starting position. */
export function swipeTarget(
  origin: number,
  count: number,
  distance: number,
  velocity: number,
) {
  const intentional =
    Math.abs(distance) >= 45 ||
    (Math.abs(distance) >= 12 && Math.abs(velocity) >= 0.45);
  return Math.max(
    0,
    Math.min(count - 1, origin + (intentional ? (distance > 0 ? 1 : -1) : 0)),
  );
}
