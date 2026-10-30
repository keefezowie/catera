// @vitest-environment jsdom
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Actor, ClaimPreview, Workspace } from "@catera/domain";
import { Provider } from "../apps/web/src/components/context";
import { ClaimCustomer } from "../apps/web/src/components/customer-pilot";

// The web and native workspaces resolve separate React installations. Render with the
// web's React, the one its components' hooks use (no JSX: that would pick the root React).
const webRequire = createRequire(resolve("apps/web/package.json"));
const { act, createElement } = webRequire("react") as typeof import("react");
const { createRoot } = webRequire("react-dom/client") as typeof import("react-dom/client");

/** Synthetic preview: no real caterer, customer or phone number. */
const preview: ClaimPreview = {
  catererName: "Dapur Contoh",
  packageName: "Makan Siang Rumahan",
  remainingDays: 9,
  nextDate: "2026-10-08",
  nextWindow: "11.00–13.00",
  addressLabel: "Kantor Sudirman",
  maskedPhone: "0812-•••-0001",
};
const TOKEN = "t".repeat(64);
const DEAD = "Tautan ini tidak bisa dipakai. Minta tautan baru ke kateringmu.";

type Reply = { status?: number; data?: unknown; code?: string };
let routes: Record<string, (body: unknown) => Reply>;
const calls: { path: string; body: unknown }[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const path = String(url).replace(/^.*\/api\/v1\//, "");
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ path, body });
  const key = path === "commands" ? "commands:" + (body as { action: string }).action : path;
  const handler = routes[key];
  const reply = handler ? handler(body) : { status: 500, code: "UNEXPECTED" };
  const status = reply.status ?? 200;
  return {
    ok: status < 400,
    status,
    json: async () => (status < 400 ? { data: reply.data } : { error: { code: reply.code } }),
  } as Response;
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // jsdom has no image decoding; the loading mascot waits on it.
  HTMLImageElement.prototype.decode ??= () => Promise.resolve();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  calls.length = 0;
  routes = { ["claim-preview/" + TOKEN]: () => ({ data: preview }) };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function show(actor: Actor | null = null) {
  await act(async () =>
    root.render(
      createElement(Provider, {
        actor,
        workspace: "customer" as Workspace,
        offers: [],
        demo: false,
        initialLocale: "id",
        children: createElement(ClaimCustomer, { token: TOKEN }),
      }),
    ),
  );
  await settle();
}
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const text = () => container.querySelector("section")?.textContent ?? "";
function button(name: string | RegExp) {
  // A form's submit button also holds its hidden "Memproses…" label; match the visible one.
  const label = (b: HTMLElement) =>
    (b.querySelector(".form-submit-label") ?? b).textContent?.trim() ?? "";
  const found = [...container.querySelectorAll<HTMLElement>("button, a")].find((b) =>
    typeof name === "string" ? label(b) === name : name.test(label(b)),
  );
  if (!found) throw new Error("No button " + name + " in: " + text());
  return found;
}
async function press(name: string | RegExp) {
  await act(async () => button(name).click());
  await settle();
}
function field(label: string) {
  const span = [...container.querySelectorAll("label.field > span")].find((s) => s.textContent === label);
  const input = span?.parentElement?.querySelector("input");
  if (!input) throw new Error("No field " + label);
  return input;
}
async function type(label: string, value: string) {
  const input = field(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("claim shows the package before asking for the phone", async () => {
  await show({ id: "u-1", role: "customer", name: "Andre Contoh" } as Actor);
  expect(text()).toContain("Dari Dapur Contoh");
  expect(container.querySelector("h1")?.textContent).toBe("Langgananmu sekarang ada di Catera");
  expect(text()).toContain(
    "Sudah dibayar ke Dapur Contoh, tidak ada tagihan baru. Di sini kamu bisa lihat menu, tahu kapan makanan berangkat, dan memindah hari.",
  );
  expect(text()).toContain("Makan Siang Rumahan");
  expect(text()).toContain("9 hari");
  expect(text()).toContain("Kamis 8 Okt, 11.00–13.00");
  expect(text()).toContain("Kantor Sudirman");
  expect(text()).toContain("Bukan nomormu? Minta Dapur Contoh mengirim tautan baru.");
  expect(container.querySelector("input")).toBeNull();
  expect(calls.map((c) => c.path)).toEqual(["claim-preview/" + TOKEN]);

  await press("Lanjut dengan 0812-•••-0001");
  expect(container.querySelector('input[type="tel"]')).not.toBeNull();
});

it("claim error never shows other data", async () => {
  routes["claim-preview/" + TOKEN] = () => ({ status: 404, code: "NOT_FOUND" });
  await show();
  expect(text()).toBe(DEAD);
  expect(container.querySelector("input, button")).toBeNull();
});

it("a signed-out visitor signs in first and comes back to the link", async () => {
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, pathname: "/claim/" + TOKEN, search: "", assign });
  await show();
  await press(/^Lanjut dengan/);
  expect(assign).toHaveBeenCalledWith("/login?next=" + encodeURIComponent("/claim/" + TOKEN));
  expect(calls.some((c) => c.path.startsWith("auth/") || c.path === "commands")).toBe(false);
});

it("connects with the typed number, shows the next days and offers the app, with no SMS", async () => {
  vi.stubEnv("NEXT_PUBLIC_CATERA_ANDROID_URL", "https://play.example.test/catera");
  routes["commands:customer.claim"] = () => ({ data: { status: "claimed" } });
  routes["customer"] = () => ({ data: { subscriptions: [], deliveries: [], addresses: [], notifications: [], cases: [] } });
  await show({ id: "u-1", role: "customer", name: "Andre Contoh" } as Actor);
  await press(/^Lanjut dengan/);
  await type("Nomor HP", "0812 3450 0001");
  await press("Sambungkan langganan");
  expect(calls.find((c) => c.path === "commands")?.body).toMatchObject({
    action: "customer.claim",
    payload: { token: TOKEN, phone: "+6281234500001" },
  });
  expect(calls.some((c) => c.path.startsWith("auth/"))).toBe(false);
  expect(container.querySelector("h1")?.textContent).toBe("Tersambung, Andre");
  expect(text()).toContain("Tahu saat makanan berangkat");
  expect(button("Pasang aplikasi").getAttribute("href")).toBe("https://play.example.test/catera");
  expect(button("Lihat jadwal di browser saja").getAttribute("href")).toBe("/home");
});

it("an account whose number matches connects straight from Lanjut, and a refused claim shows only the plain message", async () => {
  vi.stubEnv("NEXT_PUBLIC_CATERA_ANDROID_URL", "");
  const known = { id: "u-1", role: "customer", name: "Andre Contoh", phone: "+6281234500001" } as Actor;
  routes["commands:customer.claim"] = () => ({ data: { status: "claimed" } });
  routes["customer"] = () => ({ data: { subscriptions: [], deliveries: [], addresses: [], notifications: [], cases: [] } });
  await show(known);
  await press(/^Lanjut dengan/);
  expect(calls.find((c) => c.path === "commands")?.body).toMatchObject({ payload: { token: TOKEN, phone: "+6281234500001" } });
  expect(container.querySelector("h1")?.textContent).toBe("Tersambung, Andre");
  expect(text()).not.toContain("Pasang aplikasi");

  // The account's own number refused: type the recorded one, once; refused again is the plain message.
  routes["commands:customer.claim"] = () => ({ status: 400, code: "CLAIM_UNAVAILABLE" });
  await act(async () => root.unmount());
  root = createRoot(container);
  await show(known);
  await press(/^Lanjut dengan/);
  expect(container.querySelector('input[type="tel"]')).not.toBeNull();
  await type("Nomor HP", "081234500001");
  await press("Sambungkan langganan");
  expect(text()).toBe(DEAD);
});

it("a number that differs from the recorded one is not sent and gets a plain explanation", async () => {
  routes["commands:customer.claim"] = () => ({ data: { status: "claimed" } });
  routes["customer"] = () => ({ data: { subscriptions: [], deliveries: [], addresses: [], notifications: [], cases: [] } });
  await show({ id: "u-1", role: "customer", name: "Andre Contoh" } as Actor);
  await press(/^Lanjut dengan/);
  await type("Nomor HP", "0812 9999 0000");
  await press("Sambungkan langganan");
  expect(text()).toContain(
    "Nomor ini berbeda dengan yang dicatat Dapur Contoh. Pakai nomor yang kamu berikan ke Dapur Contoh, atau minta Dapur Contoh memperbarui nomormu.",
  );
  expect(calls.some((c) => c.path === "commands")).toBe(false);
  expect(field("Nomor HP").disabled).toBe(false);
  await type("Nomor HP", "081234500001");
  await press("Sambungkan langganan");
  expect(calls.find((c) => c.path === "commands")?.body).toMatchObject({ payload: { phone: "+6281234500001" } });
});

it("a claim sent for review never says it connected", async () => {
  const toast = () => container.querySelector(".toast")?.textContent ?? "";
  routes["commands:customer.claim"] = () => ({ data: { status: "review" } });
  await show({ id: "u-1", role: "customer", name: "Andre Contoh", phone: "+6281234500001" } as Actor);
  await press(/^Lanjut dengan/);
  expect(text()).toContain("Dapur Contoh perlu mengecek langganan ini dulu.");
  expect(toast()).not.toContain("tersambung");

  routes["commands:customer.claim"] = () => ({ data: { status: "claimed" } });
  routes["customer"] = () => ({ data: { subscriptions: [], deliveries: [], addresses: [], notifications: [], cases: [] } });
  await act(async () => root.unmount());
  root = createRoot(container);
  await show({ id: "u-1", role: "customer", name: "Andre Contoh", phone: "+6281234500001" } as Actor);
  await press(/^Lanjut dengan/);
  expect(toast()).toBe("Langganan tersambung.");
});
