// @vitest-environment jsdom
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Actor, Conversation, Workspace } from "@catera/domain";
import { Provider } from "../apps/web/src/components/context";
import { Messages } from "../apps/web/src/components/customer";
import { PasswordField } from "../apps/web/src/components/registration";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => "/messages",
  useSearchParams: () => new URLSearchParams(),
}));

// Render with the web's React, the one its components' hooks use (see claim-web.test.tsx).
const webRequire = createRequire(resolve("apps/web/package.json"));
const { act, createElement } = webRequire("react") as typeof import("react");
const { createRoot } = webRequire("react-dom/client") as typeof import("react-dom/client");

const actor = { id: "customer-1" } as Actor;
const message = (id: string, created_at: string) => ({
  id,
  sender_id: "customer-1",
  body: "Halo " + id,
  created_at,
});
const conversation = {
  id: "conversation-1",
  caterer_id: "caterer-1",
  customer_id: "customer-1",
  caterer: "Dapur Contoh",
  customer: "Pelanggan Contoh",
  messages: [
    message("old", "2026-11-02T07:05:00Z"),
    message("new", "2026-11-07T07:05:00Z"),
  ],
} as Conversation;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers({ now: new Date("2026-11-07T09:00:00Z"), toFake: ["Date"] });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [conversation] }),
    })),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function show(child: ReturnType<typeof createElement>) {
  await act(async () =>
    root.render(
      createElement(Provider, {
        actor,
        workspace: "customer" as Workspace,
        offers: [],
        demo: false,
        initialLocale: "id",
        children: child,
      }),
    ),
  );
  await act(async () => new Promise((r) => setTimeout(r, 0)));
}

it("opens the chat on the newest message and dates anything not from today", async () => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(999);
  await show(createElement(Messages));
  expect(container.querySelector(".message-stream")?.scrollTop).toBe(999);
  const stamps = [...container.querySelectorAll(".message small")].map((s) => s.textContent);
  expect(stamps[0]).toMatch(/^2 Nov/);
  expect(stamps[0]).toMatch(/14[.:]05$/);
  expect(stamps[1]).toMatch(/^14[.:]05$/);
});

it("holds a new password to the server's 10 characters, not an old sign-in password", async () => {
  await show(createElement(PasswordField, { creating: true }));
  expect(container.querySelector("input")?.minLength).toBe(10);
  await show(createElement(PasswordField));
  expect(container.querySelector("input")?.minLength).toBe(1);
});
