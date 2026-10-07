import ExcelJS from "exceljs";
import { z } from "zod";
import { extractImportRows, rpc, type AssistantInput } from "@catera/backend";
import { earliestImportStart, jakartaDay, type SellerImportOptions } from "@catera/domain";
import { session } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/request-origin";

export const maxDuration = 300;
const limit = 4 * 1024 * 1024;
const base64 = z.string().max(limit).regex(/^[A-Za-z0-9+/=]*$/);
const body = z
  .object({
    text: z.string().max(60000).optional(),
    images: z.array(z.object({ mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), data: base64 })).max(6).optional(),
    pdfs: z.array(z.object({ data: base64 })).max(2).optional(),
    sheets: z.array(z.object({ kind: z.enum(["csv", "xlsx"]), data: base64 })).max(3).optional(),
  })
  .strict();
const codes: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  INVALID_SIZE: 413,
  IMPORT_UNREADABLE: 422,
  IMPORT_TOO_LONG: 422,
  IMPORT_UNAVAILABLE: 503,
  QUOTA: 429,
};
const fail = (code: string) =>
  Response.json({ error: { code } }, { status: codes[code] ?? 503, headers: { "Cache-Control": "no-store" } });

const cell = (v: unknown) => {
  const text =
    v === null || v === undefined
      ? ""
      : v instanceof Date
        ? v.toISOString().slice(0, 10)
        : typeof v === "object" && "text" in (v as object)
          ? String((v as { text: unknown }).text)
          : typeof v === "object" && "result" in (v as object)
            ? String((v as { result: unknown }).result ?? "")
            : String(v);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Spreadsheet cells become CSV text; formulas contribute only their saved results. */
async function sheetText(sheet: { kind: "csv" | "xlsx"; data: string }) {
  const bytes = Buffer.from(sheet.data, "base64");
  if (sheet.kind === "csv") return bytes.toString("utf8").slice(0, 140000);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ArrayBuffer);
  const lines: string[] = [];
  book.eachSheet((ws) => {
    lines.push(`# ${ws.name}`);
    ws.eachRow((row) => {
      const values = (row.values as unknown[]).slice(1);
      lines.push(values.map(cell).join(","));
    });
  });
  return lines.join("\n").slice(0, 140000);
}

/** Owner-only: read messy customer notes into rows for import.preview. Nothing is saved here. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > limit) return fail("INVALID_SIZE");
    const s = await session(request);
    if (!s.actor) return fail("UNAUTHORIZED");
    if (s.actor.role !== "owner" || !s.actor.catererId) return fail("FORBIDDEN");
    if (!process.env.ANTHROPIC_API_KEY) return fail("IMPORT_UNAVAILABLE");
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("INVALID_INPUT");
    // 20 paid model reads per kitchen per Jakarta day.
    await rpc(null, null, "catera_v1_system", {
      action: "importAssistant.consume",
      payload: { catererId: s.actor.catererId, day: jakartaDay(new Date()) },
    }, true);
    const options = await rpc<SellerImportOptions>(s.id, s.token, "catera_v1_read", {
      resource: "seller-import-options",
      params: { id: s.actor.catererId },
    });
    const input: AssistantInput = {
      text: parsed.data.text,
      images: parsed.data.images,
      pdfs: parsed.data.pdfs,
      sheets: await Promise.all((parsed.data.sheets ?? []).map(sheetText)),
    };
    const result = await extractImportRows(
      input,
      options.packages.map((p) => ({ id: p.id, name: p.name, meal: p.meal, days: p.days })),
      { today: jakartaDay(new Date()), earliest: earliestImportStart(new Date()) },
    );
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return fail(code in codes ? code : "IMPORT_UNAVAILABLE");
  }
}
