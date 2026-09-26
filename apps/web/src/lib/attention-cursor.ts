import { z } from "zod";

const attentionCursorSchema = z
  .object({
    priority: z.number().int().nonnegative(),
    at: z.string().datetime({ offset: true }),
    id: z.string().min(1).max(160),
  })
  .strict();

export type AttentionCursor = z.infer<typeof attentionCursorSchema>;

export function encodeAttentionCursor(cursor: AttentionCursor) {
  return Buffer.from(
    JSON.stringify(attentionCursorSchema.parse(cursor)),
    "utf8",
  ).toString("base64url");
}

export function decodeAttentionCursor(value: string) {
  if (!value || value.length > 500) throw new Error("INVALID_INPUT");
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    return attentionCursorSchema.parse(JSON.parse(decoded));
  } catch {
    throw new Error("INVALID_INPUT");
  }
}
