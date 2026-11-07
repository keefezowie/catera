import { deflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  extract: vi.fn(),
  session: vi.fn(),
  pageSession: vi.fn(),
  catalog: vi.fn(),
  revalidateTag: vi.fn(),
  createServerClient: vi.fn(),
  locale: undefined as string | undefined,
  workspace: undefined as string | undefined,
}));
vi.mock("next/cache", () => ({ revalidateTag: state.revalidateTag, unstable_cache: (read: unknown) => read }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = name === "catera_locale" ? state.locale : state.workspace;
      return value ? { value } : undefined;
    },
    getAll: () => [],
    set: vi.fn(),
  }),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: state.createServerClient }));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  demoEnabled: () => false,
  rpc: state.rpc,
  extractImportRows: state.extract,
}));
vi.mock("../apps/web/src/lib/auth", () => ({
  session: state.session,
  pageSession: state.pageSession,
  supabase: vi.fn(),
  demoToken: vi.fn(),
}));
vi.mock("../apps/web/src/lib/catalog-cache", () => ({ catalog: state.catalog, catalogTag: "catalog" }));
vi.mock("../apps/web/src/lib/admin-mfa", () => ({ adminMfaState: vi.fn() }));
vi.mock("../apps/web/src/components/application", () => ({ Application: () => null }));
vi.mock("../apps/web/src/components/admin-verification", () => ({ AdminVerification: () => null }));

import { GET as v1Get, POST as v1Post } from "../apps/web/src/app/api/v1/[...path]/route";
import { GET as jobs } from "../apps/web/src/app/api/jobs/route";
import { GET as pushJobs } from "../apps/web/src/app/api/jobs/push/route";
import { POST as importAssistant } from "../apps/web/src/app/api/import-assistant/route";
import { GET as manifest } from "../apps/web/src/app/api/manifests/[id]/route";
import Page, { generateMetadata } from "../apps/web/src/app/(marketplace)/[[...path]]/page";
import { proxy } from "../apps/web/src/proxy";

const owner = { id: "synthetic", token: "synthetic-token", actor: { id: "synthetic", role: "owner", catererId: "10000000-0000-4000-8000-000000000001" } };
beforeEach(() => {
  vi.resetAllMocks();
  state.locale = undefined;
  state.workspace = undefined;
  state.session.mockResolvedValue(owner);
  state.pageSession.mockResolvedValue(owner);
  state.catalog.mockResolvedValue([{ id: "p1", slug: "nasi-liwet", name: "Nasi Liwet", catererSlug: "dapur-senja", caterer: "Dapur Senja" }]);
  vi.stubEnv("CATERA_PUBLIC_URL", "https://catera.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("public reviews", () => {
  it("keep the name and text but not the reviewer's account or subscription", async () => {
    state.session.mockResolvedValue({ id: null, token: null, actor: null });
    state.rpc.mockResolvedValueOnce([
      { id: "r1", customer: "Dewi", rating: 5, body: "Enak", reply: null, user_id: "secret-user", subscription_id: "secret-sub" },
    ]);
    const response = await v1Get(new Request("https://catera.test/api/v1/reviews/p1"), {
      params: Promise.resolve({ path: ["reviews", "p1"] }),
    } as never);
    expect(await response.json()).toEqual({ data: [{ id: "r1", customer: "Dewi", rating: 5, body: "Enak", reply: null }] });
  });
});

describe("catalog revalidation", () => {
  const command = (action: string) =>
    v1Post(
      new Request("https://catera.test/api/v1/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://catera.test" },
        body: JSON.stringify({ action, payload: {}, requestId: crypto.randomUUID() }),
      }),
      { params: Promise.resolve({ path: ["commands"] }) },
    );
  it.each(["package.suspend", "capacity.save", "seller.submit", "admin.verify", "review.moderate", "settlement.features"])(
    "%s clears the shared catalog",
    async (action) => {
      state.rpc.mockResolvedValue({});
      expect((await command(action)).status).toBe(200);
      expect(state.revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
    },
  );
  it.each(["message.send", "notification.read", "customerMenu.unknown", "support.create"])(
    "%s leaves it alone",
    async (action) => {
      state.rpc.mockResolvedValue({});
      await command(action);
      expect(state.rpc).toHaveBeenCalled();
      expect(state.revalidateTag).not.toHaveBeenCalled();
    },
  );
});

describe("cron secret", () => {
  const request = (authorization?: string) =>
    new Request("https://catera.test/api/jobs", authorization ? { headers: { authorization } } : undefined);
  it.each([
    ["/api/jobs", jobs],
    ["/api/jobs/push", pushJobs],
  ] as const)("%s rejects a wrong, same-length, absent or unconfigured secret", async (_path, route) => {
    vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
    expect((await route(request())).status).toBe(401);
    expect((await route(request("Bearer wrong"))).status).toBe(401);
    expect((await route(request("Bearer synthetic-cron-secreX"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await route(request("Bearer "))).status).toBe(401);
    expect((await route(request("Bearer undefined"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await route(request("Bearer undefined"))).status).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});

/** A one-entry zip whose central directory says whatever `declared` is, as a forged bomb would. */
function zipOf(content: Buffer, declared = content.length) {
  const body = deflateRawSync(content);
  const name = Buffer.from("xl/workbook.xml");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(declared, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(declared, 24);
  central.writeUInt16LE(name.length, 28);
  const start = local.length + name.length + body.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(start, 16);
  return Buffer.concat([local, name, body, central, name, end]);
}

describe("import assistant workbooks", () => {
  const send = (data: Buffer) =>
    importAssistant(
      new Request("https://catera.test/api/import-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer synthetic" },
        body: JSON.stringify({ sheets: [{ kind: "xlsx", data: data.toString("base64") }] }),
      }),
    );
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-used");
    state.rpc.mockResolvedValue({ packages: [] });
    state.extract.mockResolvedValue({ rows: [], needsReview: 0 });
  });
  const code = async (response: Response) => (await response.json()).error.code;

  it("reads a real workbook", async () => {
    const book = new ExcelJS.Workbook();
    book.addWorksheet("Pelanggan").addRow(["Andre", "0812"]);
    const response = await send(Buffer.from(await book.xlsx.writeBuffer()));
    expect(response.status).toBe(200);
    expect(state.extract.mock.calls[0][0].sheets).toEqual(["# Pelanggan\nAndre,0812"]);
  });
  it("stops collecting rows past the text limit", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Pelanggan");
    for (let i = 0; i < 3000; i++) sheet.addRow(["x".repeat(100)]);
    book.addWorksheet("Berikutnya").addRow(["y"]);
    expect((await send(Buffer.from(await book.xlsx.writeBuffer()))).status).toBe(200);
    const text = state.extract.mock.calls[0][0].sheets[0];
    expect(text.length).toBe(140000);
    expect(text).not.toContain("\ny");
  });
  it("refuses a bomb that declares its true size", async () => {
    const response = await send(zipOf(Buffer.alloc(21 * 1024 * 1024)));
    expect(response.status).toBe(422);
    expect(await code(response)).toBe("IMPORT_TOO_LONG");
  });
  it("refuses a bomb that lies about its size", async () => {
    const response = await send(zipOf(Buffer.alloc(21 * 1024 * 1024), 10));
    expect(await code(response)).toBe("IMPORT_TOO_LONG");
  });
  it("refuses what is not a plain zip", async () => {
    expect(await code(await send(Buffer.from("not a workbook")))).toBe("IMPORT_UNREADABLE");
    const zip = zipOf(Buffer.from("<x/>"));
    expect(await code(await send(Buffer.concat([Buffer.from("junk"), zip])))).toBe("IMPORT_UNREADABLE");
  });
});

describe("manifest CSV", () => {
  const csvOf = async (address: Record<string, string>) => {
    state.rpc.mockResolvedValueOnce({
      service_date: "2026-11-07",
      revision: 1,
      entries: [
        {
          offer: { name: "Nasi", menus: [], windows: { lunch: "11-13", dinner: "17-19" } },
          meals: [{ meal: "lunch", status: "scheduled" }],
          portions: 1,
          trial: false,
          address,
        },
      ],
    });
    const response = await manifest(new Request("https://catera.test/api/manifests/m1"), {
      params: Promise.resolve({ id: "m1" }),
    });
    return response.text();
  };
  it("keeps a cell that would run as a formula as text, with nothing lost", async () => {
    for (const cell of ["=HYPERLINK(1)", "+1", "-1", "@SUM(1)", "\t=1", "\r=1"])
      expect(await csvOf({ line: cell, area: "A", instructions: "" })).toContain(`"'${cell}"`);
  });
  it("leaves ordinary text alone", async () => {
    const csv = await csvOf({ line: 'Jl. "Kenanga" 1', area: "A-1", instructions: "" });
    expect(csv).toContain('"Jl. ""Kenanga"" 1"');
    expect(csv).toContain('"A-1"');
  });
});

describe("marketplace page", () => {
  const params = (path: string[]) => ({ params: Promise.resolve({ path }) });
  const render = async (path: string[]) =>
    (await Page({ ...params(path), searchParams: Promise.resolve({}) })) as { props: { offers: unknown[]; issue: string | null } };
  const title = async (path: string[]) => (await generateMetadata(params(path))).title;

  it("sends the catalog only to the routes that read it", async () => {
    state.workspace = "caterer";
    for (const path of [["checkout", "x"], ["messages"], ["packages", "x"], ["saved"], ["seller", "support"]])
      expect((await render(path)).props.offers).toHaveLength(1);
    state.catalog.mockClear();
    for (const path of [["account"], ["payment", "x"], ["home"], ["seller", "packages"]])
      expect((await render(path)).props.offers).toEqual([]);
    expect(state.catalog).not.toHaveBeenCalled();
  });
  it("still tells a catalog route that the read failed", async () => {
    state.catalog.mockRejectedValue(new Error("NOT_CONFIGURED"));
    expect((await render(["search"])).props.issue).toBe("NOT_CONFIGURED");
    expect((await render(["account"])).props.issue).toBeNull();
  });
  it("titles a package and a caterer by name, falling back when unknown or unavailable", async () => {
    expect(await title(["packages", "nasi-liwet"])).toBe("Nasi Liwet");
    expect(await title(["caterers", "dapur-senja"])).toBe("Dapur Senja");
    expect(await title(["packages", "lain"])).toBe("Detail paket");
    state.catalog.mockRejectedValue(new Error("NOT_CONFIGURED"));
    expect(await title(["caterers", "dapur-senja"])).toBe("Profil katering");
  });
  it("gives the signed-in routes their own title, in the visitor's language", async () => {
    expect(await title(["subscriptions"])).toBe("Langganan");
    state.locale = "en";
    expect(await title(["subscriptions"])).toBe("Subscriptions");
    expect(state.catalog).not.toHaveBeenCalled();
  });
});

describe("session cookies", () => {
  const secure = () => state.createServerClient.mock.calls[0][2].cookieOptions.secure;
  const client = { auth: { getClaims: vi.fn() } };
  const refresh = () => proxy(new NextRequest("https://catera.test/"));
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-key");
    state.createServerClient.mockReturnValue(client);
  });
  it("are Secure in production, from the proxy and the server client", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await refresh();
    expect(secure()).toBe(true);
    state.createServerClient.mockClear();
    const { supabase } = await vi.importActual<typeof import("../apps/web/src/lib/auth")>("../apps/web/src/lib/auth");
    await supabase();
    expect(secure()).toBe(true);
  });
  it("stay usable over local http in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await refresh();
    expect(secure()).toBe(false);
  });
});
