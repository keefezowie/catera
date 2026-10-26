// @vitest-environment jsdom
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Workspace } from "@catera/domain";
import { Provider, useApp } from "../apps/web/src/components/context";

// Render with the web's React (see tests/claim-web.test.tsx), without JSX.
const webRequire = createRequire(resolve("apps/web/package.json"));
const { act, createElement } = webRequire("react") as typeof import("react");
const { createRoot } = webRequire("react-dom/client") as typeof import("react-dom/client");

/** The Undo toast (item 5): up for 8s, and held while the pointer or keyboard focus is on it. */
let notify: ReturnType<typeof useApp>["notify"] = () => undefined;
function Probe() {
  notify = useApp().notify;
  return null;
}
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(Provider, {
        actor: null,
        workspace: "customer" as Workspace,
        offers: [],
        demo: false,
        initialLocale: "id",
        children: createElement(Probe),
      }),
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});
const toast = () => container.querySelector<HTMLElement>(".toast")!;
const wait = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));
const undo = vi.fn();

it("stays 8s, and holds while hovered or focused, then finishes its time", async () => {
  await act(async () => notify("Paket dihapus dari tersimpan.", { label: "Urungkan", run: undo }));
  expect(toast().className).toContain("visible");
  await act(async () => void toast().dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
  await wait(20_000);
  expect(toast().className).toContain("visible");
  await act(async () => void toast().dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
  await act(async () => toast().querySelector("button")!.focus());
  await wait(20_000);
  expect(toast().className).toContain("visible");
  await act(async () => toast().querySelector<HTMLElement>("button")!.blur());
  await wait(7_999);
  expect(toast().className).toContain("visible");
  await wait(1);
  expect(toast().className).not.toContain("visible");
});

it("after Undo is pressed, the next toast still leaves on time", async () => {
  await act(async () => notify("Paket dihapus dari tersimpan.", { label: "Urungkan", run: undo }));
  const button = toast().querySelector<HTMLButtonElement>("button")!;
  await act(async () => button.focus());
  await act(async () => button.click());
  expect(undo).toHaveBeenCalled();
  await act(async () => notify("Paket disimpan."));
  await wait(4_500);
  expect(toast().className).not.toContain("visible");
});
