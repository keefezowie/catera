// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { Actor, Conversation, Workspace } from "@catera/domain";
import { Provider, useApp } from "../apps/web/src/components/context";
import { Messages } from "../apps/web/src/components/customer";
import { config as proxyConfig } from "../apps/web/src/proxy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => "/seller",
  useSearchParams: () => new URLSearchParams(),
}));

// Render with the web's React, the one its components' hooks use (see claim-web.test.tsx).
const webRequire = createRequire(resolve("apps/web/package.json"));
const { act, createElement } = webRequire("react") as typeof import("react");
const { createRoot } = webRequire("react-dom/client") as typeof import("react-dom/client");

const source = (path: string) => readFileSync(resolve(path), "utf8");
const conversation = (id: string) =>
  ({
    id,
    caterer_id: "caterer-1",
    customer_id: "customer-" + id,
    caterer: "Dapur Contoh",
    customer: "Pelanggan Contoh",
    messages: [],
  }) as unknown as Conversation;

afterEach(() => vi.unstubAllGlobals());

it("reports the conversation count from one fetch and follows a refresh without looping", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let conversations = [conversation("a"), conversation("b")];
  const reads: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const isRead = String(url).endsWith("/conversations");
      if (isRead) reads.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: isRead ? conversations : {} }),
      };
    }),
  );
  let perform!: ReturnType<typeof useApp>["perform"];
  function Capture() {
    perform = useApp().perform;
    return null;
  }
  const onCount = vi.fn();
  const container = document.createElement("div");
  const root = createRoot(container);
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
  await act(async () =>
    root.render(
      createElement(Provider, {
        actor: { id: "seller-1" } as Actor,
        workspace: "seller" as Workspace,
        offers: [],
        demo: false,
        initialLocale: "id",
        children: [
          createElement(Capture, { key: "capture" }),
          createElement(Messages, { key: "messages", embedded: true, onCount }),
        ],
      }),
    ),
  );
  await settle();
  expect(onCount.mock.calls).toEqual([[2]]);
  expect(reads).toHaveLength(1);

  // Same length on refresh: no extra report, so a parent's setState cannot loop.
  await act(async () => void (await perform("test.touch", {})));
  await settle();
  expect(reads).toHaveLength(2);
  expect(onCount.mock.calls).toEqual([[2]]);

  conversations = [...conversations, conversation("c")];
  await act(async () => void (await perform("test.touch", {})));
  await settle();
  expect(onCount.mock.calls).toEqual([[2], [3]]);
  await act(async () => root.unmount());
});

it("gets the seller's tab count from Messages, with no second conversations read", () => {
  const seller = source("apps/web/src/components/seller.tsx");
  expect(seller).toContain("<Messages embedded onCount={setConversationCount} />");
  expect(seller).not.toContain("api.conversations(");
});

it("skips the session check for icons and assets, not for pages", () => {
  const matches = (path: string) =>
    new RegExp("^" + proxyConfig.matcher[0] + "$").test(path);
  expect(matches("/icons/icon-192.png")).toBe(false);
  expect(matches("/assets/logo.png")).toBe(false);
  expect(matches("/messages")).toBe(true);
});

it("sizes a page-heading h2 like the h1 on a phone and leaves it no inline style", () => {
  expect(source("apps/web/src/app/globals.css")).toMatch(
    /\.page-heading h1,\s*\.page-heading h2 \{\s*font-size: 29px;\s*line-height: 1\.25;/,
  );
  expect(source("apps/web/src/components/marketplace.tsx")).toContain(
    '<h2>{t("Paket katering", "Catering packages")}</h2>',
  );
});

it("runs Dapur's suite and export in CI on read-only permissions", () => {
  const ci = source(".github/workflows/ci.yml");
  expect(ci).toMatch(/^permissions:\n\s+contents: read$/m);
  expect(ci).toContain("- run: npm run test -w @catera/caterer\n");
  expect(ci).toContain("- run: npm run export -w @catera/caterer\n");
});
