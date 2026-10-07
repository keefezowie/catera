import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractImportRows, type AssistantClient } from "../packages/backend/src/import-assistant";

const packages = [
  { id: "p-rumahan", name: "Makan Siang Rumahan", meal: "lunch", days: 20 },
  { id: "p-hemat", name: "Paket Hemat Kantor", meal: "lunch", days: 20 },
];
const modelRow = (extra: Record<string, unknown>) => ({
  name: "Andre Kusuma",
  phone: "0812 3456 7801",
  addressLine: "Kost Damai Lt. 2 kamar 5",
  area: "Setiabudi",
  city: "Jakarta Selatan",
  notes: "",
  packageId: "p-rumahan",
  startDate: "2026-10-08",
  remainingDays: 9,
  portions: 1,
  needsReview: false,
  reason: "",
  ...extra,
});
// Streamed, so a long list never hits the SDK's non-streaming time guard.
const fake = (response: Record<string, unknown>) => {
  const create = vi.fn((_params: unknown) => ({ finalMessage: async () => response }));
  return { client: { beta: { messages: { stream: create } } } as unknown as AssistantClient, create };
};
const answer = (rows: unknown[]) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify({ rows }) }],
});

describe("extractImportRows", () => {
  it("maps rows to packages, normalises phones and flags rows missing an address", async () => {
    const { client } = fake(
      answer([
        modelRow({}),
        modelRow({ name: "Dewi", phone: "081234567802", addressLine: "", packageId: "p-hemat" }),
        modelRow({ name: "Bayu", phone: "081234567803", packageId: "p-tidak-ada" }),
      ]),
    );
    const result = await extractImportRows({ text: "Andre 0812… Rumahan sisa 9 hari" }, packages, { client, today: "2026-10-07", earliest: "2026-10-08" });
    expect(result.rows[0]).toMatchObject({ phone: "+6281234567801", packageId: "p-rumahan", needsReview: false });
    expect(result.rows[1]).toMatchObject({ packageId: "p-hemat", needsReview: true });
    expect(result.rows[1].reason).toMatch(/alamat/i);
    expect(result.rows[2]).toMatchObject({ packageId: null, needsReview: true });
    expect(result.needsReview).toBe(2);
  });

  it("flags a start date the kitchen can no longer cook for and tells the model the earliest date", async () => {
    const { client, create } = fake(answer([modelRow({ startDate: "2026-10-01" })]));
    const result = await extractImportRows({ text: "x" }, packages, { client, today: "2026-10-07", earliest: "2026-10-08" });
    expect(result.rows[0].needsReview).toBe(true);
    expect(result.rows[0].reason).toMatch(/2026-10-08/);
    expect(JSON.stringify((create.mock.calls[0] as unknown[])[0])).toContain("2026-10-08");
  });

  it("asks the model for structured rows with low effort and the server-side fallback", async () => {
    const { client, create } = fake(answer([]));
    await extractImportRows({ text: "kosong", images: [{ mediaType: "image/jpeg", data: "AAAA" }] }, packages, { client, today: "2026-10-07", earliest: "2026-10-08" });
    const params = (create.mock.calls[0] as unknown[])[0] as Record<string, any>;
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.output_config.effort).toBe("low");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.fallbacks).toBe("default");
    expect(JSON.stringify(params.messages)).toContain("p-rumahan");
    expect(params.messages[0].content.some((b: { type: string }) => b.type === "image")).toBe(true);
  });

  it("turns a refusal into IMPORT_UNREADABLE and a cut-off answer into IMPORT_TOO_LONG", async () => {
    await expect(
      extractImportRows({ text: "x" }, packages, { client: fake({ stop_reason: "refusal", content: [] }).client, today: "2026-10-07", earliest: "2026-10-08" }),
    ).rejects.toThrow("IMPORT_UNREADABLE");
    await expect(
      extractImportRows({ text: "x" }, packages, { client: fake({ stop_reason: "max_tokens", content: [] }).client, today: "2026-10-07", earliest: "2026-10-08" }),
    ).rejects.toThrow("IMPORT_TOO_LONG");
  });
});

const state = vi.hoisted(() => ({ role: "owner" }));
vi.mock("../apps/web/src/lib/auth", () => ({
  session: async () => ({
    id: "synthetic-user",
    token: "synthetic-token",
    actor: { role: state.role, catererId: "10000000-0000-4000-8000-000000000001" },
  }),
}));
import { POST, maxDuration } from "../apps/web/src/app/api/import-assistant/route";

describe("import assistant route", () => {
  beforeEach(() => {
    state.role = "owner";
  });
  it("allows long lists the time they need", () => {
    expect(maxDuration).toBe(300);
  });
  it("refuses helpers", async () => {
    state.role = "staff";
    const response = await POST(
      new Request("https://catera.test/api/import-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer synthetic" },
        body: JSON.stringify({ text: "Andre 0812" }),
      }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });
});
