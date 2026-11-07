import { inflateRawSync } from "node:zlib";
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
  // No AI key on this deployment: the assistant is off, not broken, so the app offers manual entry.
  IMPORT_ASSISTANT_DISABLED: 503,
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

const inflatedLimit = 20 * 1024 * 1024;
const textLimit = 140000;

/**
 * ExcelJS inflates every entry fully into memory, so a small zip must prove it stays small first. Each entry is really
 * inflated against the budget, because the sizes a zip declares are the sender's to forge. Whatever JSZip could read
 * differently from this walk (ZIP64, split archives, prepended bytes, gaps) is refused; real workbooks have none of it.
 */
function assertInflatesWithinLimit(zip: Buffer) {
  try {
    const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 5, 6]));
    if (end < 0) throw new Error("IMPORT_UNREADABLE");
    const start = zip.readUInt32LE(end + 16);
    if (
      zip.readUInt16LE(end + 4) !== 0 ||
      zip.readUInt16LE(end + 6) !== 0 ||
      zip.readUInt16LE(end + 8) === 0xffff ||
      zip.readUInt16LE(end + 10) === 0xffff ||
      start + zip.readUInt32LE(end + 12) !== end
    )
      throw new Error("IMPORT_UNREADABLE");
    let at = start;
    let spent = 0;
    while (at < end) {
      const method = zip.readUInt16LE(at + 10);
      const compressed = zip.readUInt32LE(at + 20);
      const local = zip.readUInt32LE(at + 42);
      if (
        zip.readUInt32LE(at) !== 0x02014b50 ||
        (method !== 0 && method !== 8) ||
        [compressed, zip.readUInt32LE(at + 24), local].includes(0xffffffff) ||
        zip.readUInt32LE(local) !== 0x04034b50
      )
        throw new Error("IMPORT_UNREADABLE");
      const data = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const body = zip.subarray(data, data + compressed);
      const size =
        method === 8 && body.length
          ? inflateRawSync(body, { maxOutputLength: inflatedLimit - spent + 1 }).length
          : body.length;
      // Charging the larger side too bounds the work of many entries that share one body and inflate to nothing.
      spent += Math.max(size, body.length);
      if (spent > inflatedLimit) throw new Error("IMPORT_TOO_LONG");
      at += 46 + zip.readUInt16LE(at + 28) + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    }
    if (at !== end) throw new Error("IMPORT_UNREADABLE");
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    throw new Error(code === "ERR_BUFFER_TOO_LARGE" || message === "IMPORT_TOO_LONG" ? "IMPORT_TOO_LONG" : "IMPORT_UNREADABLE");
  }
}

/** Spreadsheet cells become CSV text; formulas contribute only their saved results. */
async function sheetText(sheet: { kind: "csv" | "xlsx"; data: string }) {
  const bytes = Buffer.from(sheet.data, "base64");
  if (sheet.kind === "csv") return bytes.toString("utf8").slice(0, textLimit);
  assertInflatesWithinLimit(bytes);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ArrayBuffer);
  const lines: string[] = [];
  let length = 0;
  book.eachSheet((ws) => {
    lines.push(`# ${ws.name}`);
    ws.eachRow((row) => {
      if (length > textLimit) return;
      const values = (row.values as unknown[]).slice(1);
      const line = values.map(cell).join(",");
      length += line.length + 1;
      lines.push(line);
    });
  });
  return lines.join("\n").slice(0, textLimit);
}

/** Owner-only: read messy customer notes into rows for import.preview. Nothing is saved here. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > limit) return fail("INVALID_SIZE");
    const s = await session(request);
    if (!s.actor) return fail("UNAUTHORIZED");
    if (s.actor.role !== "owner" || !s.actor.catererId) return fail("FORBIDDEN");
    if (!process.env.ANTHROPIC_API_KEY) return fail("IMPORT_ASSISTANT_DISABLED");
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
      { today: jakartaDay(new Date()), earliest: earliestImportStart(new Date()), signal: request.signal },
    );
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code in codes) return fail(code);
    // The caterer only ever sees "unavailable", so the cause is told here. Never the request: it holds customer data.
    const { name, status, error: body } = error as { name?: string; status?: number; error?: { error?: { type?: string; message?: string } } };
    console.error("import-assistant failed", { name, status, type: body?.error?.type, message: body?.error?.message ?? code.slice(0, 200) });
    return fail("IMPORT_UNAVAILABLE");
  }
}
