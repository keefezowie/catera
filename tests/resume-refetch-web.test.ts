// @vitest-environment jsdom
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Workspace } from "@catera/domain";
import {
  Provider,
  RESUME_THROTTLE,
  useApp,
  useResource,
} from "../apps/web/src/components/context";

// Render with the web's React (see tests/claim-web.test.tsx), without JSX.
const webRequire = createRequire(resolve("apps/web/package.json"));
const { act, createElement } = webRequire("react") as typeof import("react");
const { createRoot } = webRequire(
  "react-dom/client",
) as typeof import("react-dom/client");

/** Stale-while-revalidate on the web (spec 2026-10-26, section A). */

type Seen = {
  resumed: number;
  data: string | null;
  loading: boolean;
  error: string;
  phase: string;
};
const seen: Seen[] = [];
const last = () => seen[seen.length - 1];
function Probe({
  loader,
  dataKey,
}: {
  loader: () => Promise<string>;
  dataKey: string;
}) {
  const { resumed } = useApp();
  const r = useResource(dataKey, loader);
  seen.push({
    resumed,
    data: r.data,
    loading: r.loading,
    error: r.error,
    phase: r.phase,
  });
  return null;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let now = 1_000_000;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  seen.length = 0;
  now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
async function show(loader: () => Promise<string>, dataKey = "k") {
  await act(async () =>
    root.render(
      createElement(Provider, {
        actor: null,
        workspace: "customer" as Workspace,
        offers: [],
        demo: false,
        initialLocale: "id",
        children: createElement(Probe, { loader, dataKey }),
      }),
    ),
  );
  await settle();
}
const fire = (target: EventTarget, type: string) =>
  act(async () => void target.dispatchEvent(new Event(type)));
function visibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}

it("focus, a visible tab and the network coming back each move resumed, at most once per 30s", async () => {
  await show(async () => "first");
  await fire(window, "focus");
  expect(last().resumed).toBe(1);
  now += RESUME_THROTTLE - 1;
  await fire(window, "online");
  expect(last().resumed).toBe(1);
  now += 1;
  await fire(window, "online");
  expect(last().resumed).toBe(2);
  now += RESUME_THROTTLE;
  visibility("visible");
  await fire(document, "visibilitychange");
  expect(last().resumed).toBe(3);
});

it("a tab that goes hidden does not move resumed", async () => {
  await show(async () => "first");
  visibility("hidden");
  await fire(document, "visibilitychange");
  expect(last().resumed).toBe(0);
  visibility("visible");
});

it("useResource reloads quietly: loading stays false and the new data replaces the old", async () => {
  let answer = "first";
  const loader = vi.fn(async () => answer);
  await show(loader);
  const from = seen.length;
  answer = "second";
  await fire(window, "focus");
  await settle();
  expect(last()).toMatchObject({
    data: "second",
    loading: false,
    phase: "ready",
  });
  expect(seen.slice(from).every((s) => !s.loading)).toBe(true);
  expect(loader).toHaveBeenCalledTimes(2);
});

it("a failed quiet reload keeps the data and adds no error", async () => {
  let fail = false;
  const loader = vi.fn(async () => {
    if (fail) throw Object.assign(new Error("x"), { code: "NETWORK" });
    return "first";
  });
  await show(loader);
  fail = true;
  await fire(window, "focus");
  await settle();
  expect(loader).toHaveBeenCalledTimes(2);
  expect(last()).toMatchObject({ data: "first", error: "", loading: false });
});

it("a quiet reload that answers after the key changed is dropped", async () => {
  let release: (v: string) => void = () => undefined;
  const loader = vi.fn(async () => "first");
  await show(loader);
  loader.mockImplementationOnce(
    () => new Promise<string>((r) => (release = r)),
  );
  await fire(window, "focus");
  await show(() => new Promise<string>(() => undefined), "other");
  await act(async () => release("stale"));
  await settle();
  expect(last().data).toBeNull();
});

it("a quiet reload overtaken by a newer reload is dropped", async () => {
  let release: (v: string) => void = () => undefined;
  let reload = () => undefined as void;
  function Reloading({ loader }: { loader: () => Promise<string> }) {
    const r = useResource("k", loader);
    reload = r.reload;
    seen.push({
      resumed: 0,
      data: r.data,
      loading: r.loading,
      error: r.error,
      phase: r.phase,
    });
    return null;
  }
  const loader = vi.fn(async () => "first");
  await act(async () =>
    root.render(
      createElement(Provider, {
        actor: null,
        workspace: "customer" as Workspace,
        offers: [],
        demo: false,
        initialLocale: "id",
        children: createElement(Reloading, { loader }),
      }),
    ),
  );
  await settle();
  loader.mockImplementationOnce(
    () => new Promise<string>((r) => (release = r)),
  );
  await fire(window, "focus");
  loader.mockImplementationOnce(async () => "newer");
  await act(async () => reload());
  await settle();
  expect(last().data).toBe("newer");
  await act(async () => release("stale"));
  await settle();
  expect(last().data).toBe("newer");
  expect(loader).toHaveBeenCalledTimes(3);
});

it("a tab that comes back while offline leaves the 30s slot to the online event", async () => {
  await show(async () => "first");
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await fire(window, "focus");
  expect(last().resumed).toBe(0);
  online.mockReturnValue(true);
  now += 3_000;
  await fire(window, "online");
  expect(last().resumed).toBe(1);
});
