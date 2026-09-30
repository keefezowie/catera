// @vitest-environment jsdom
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, it, vi } from "vitest";
import {
  groupCustomerActions,
  type CustomerActionFeed,
  type Workspace,
} from "@catera/domain";
import { Provider, useResource } from "../apps/web/src/components/context";

// The web and native workspaces resolve separate React installations. Use the
// same React instance as the web hook under test.
const webRequire = createRequire(resolve("apps/web/package.json"));
const { act, createElement } = webRequire("react") as typeof import("react");
const { createRoot } = webRequire(
  "react-dom/client",
) as typeof import("react-dom/client");

it("retains the last feed during refresh and failure, then removes resolved records on success", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const previous: CustomerActionFeed = {
    total: 2,
    items: [
      {
        id: "pay",
        kind: "payment_action",
        status: "awaiting_payment",
        priority: 1,
        href: "/payment/pay",
      },
      {
        id: "issue",
        kind: "delivery_issue",
        status: "open",
        priority: 2,
        href: "/support",
      },
    ],
  };
  const load = vi
    .fn<() => Promise<CustomerActionFeed>>()
    .mockResolvedValueOnce(previous);
  let resource!: ReturnType<typeof useResource<CustomerActionFeed>>;
  function Feed() {
    resource = useResource("customer-actions", load);
    const groups = groupCustomerActions(resource.data?.items ?? []);
    return createElement(
      "output",
      null,
      JSON.stringify({
        tasks: groups.urgent.map((item) => item.id),
        updates: groups.updates.map((item) => item.id),
        loading: resource.loading,
        stale: resource.stale,
      }),
    );
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(Provider, {
          actor: null,
          workspace: {} as Workspace,
          offers: [],
          demo: true,
          initialLocale: "en",
          children: createElement(Feed),
        }),
      ),
    );
    const rendered = () => JSON.parse(container.textContent!);
    expect(rendered()).toEqual({
      tasks: ["pay"],
      updates: ["issue"],
      loading: false,
      stale: false,
    });
    let reject!: (reason: Error) => void;
    load.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    await act(async () => resource.reload());
    expect(rendered()).toEqual({
      tasks: ["pay"],
      updates: ["issue"],
      loading: true,
      stale: false,
    });
    await act(async () => reject(new Error("REQUEST_FAILED")));
    expect(resource.error).toBeTruthy();
    expect(rendered()).toEqual({
      tasks: ["pay"],
      updates: ["issue"],
      loading: false,
      stale: true,
    });

    load.mockResolvedValueOnce({ total: 1, items: [previous.items[1]] });
    await act(async () => resource.reload());
    expect(resource.error).toBe("");
    expect(rendered()).toEqual({
      tasks: [],
      updates: ["issue"],
      loading: false,
      stale: false,
    });
    load.mockResolvedValueOnce({ total: 0, items: [] });
    await act(async () => resource.reload());
    expect(rendered()).toEqual({
      tasks: [],
      updates: [],
      loading: false,
      stale: false,
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
