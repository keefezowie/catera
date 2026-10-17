import { useEffect } from "react";
import { act, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { NavigationContext, NavigationRouteContext } from "expo-router/react-navigation";
import { useUnsavedGuard } from "@catera/mobile-ui";
import { useConfirmRoute } from "../../../packages/mobile-ui/src/sheets";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));

/**
 * `useUnsavedGuard` against a stand-in navigator: the guard's `beforeRemove` listener, a `dispatch` the test controls,
 * and the confirm route that answers its question. The `leaving` flag must not outlive a discard whose dispatch was
 * rejected or held, or the next close would walk through without asking.
 */
type Action = { type: string; source?: string };
type RemoveEvent = { data: { action: Action }; preventDefault: () => void };

const ROUTE = "masalah-key";
let listeners: ((e: RemoveEvent) => void)[] = [];
const dispatch = jest.fn<void, [Action]>();
const guarded = {
  addListener: (event: string, fn: (e: RemoveEvent) => void) => {
    if (event === "beforeRemove") listeners.push(fn);
    return () => void (listeners = listeners.filter((l) => l !== fn));
  },
  dispatch: (action: Action) => dispatch(action),
  getState: () => ({ routes: [{ key: ROUTE }] }),
};

function Guard() {
  useUnsavedGuard(true, "laporan", { os: "ios" });
  return null;
}

/** The stack asking the listeners before a close removes the sheet; true when the guard held it. */
function close(action: Action = { type: "GO_BACK" }) {
  let held = false;
  for (const fn of [...listeners]) fn({ data: { action }, preventDefault: () => (held = true) });
  return held;
}

/** The confirm sheet for the question the guard just parked: answers it the way a press on Buang or Batal does. */
async function answerLast(discard: boolean) {
  const { params } = (router.push as jest.Mock).mock.calls.at(-1)![0] as { params: { id: string } };
  const asker = { goBack: jest.fn(), addListener: () => () => undefined };
  function Sheet() {
    const { close: respond } = useConfirmRoute("android");
    useEffect(() => respond(discard), [respond]);
    return null;
  }
  const view = render(
    <NavigationContext.Provider value={asker as never}>
      <NavigationRouteContext.Provider value={{ key: "konfirmasi", name: "konfirmasi", params } as never}>
        <Sheet />
      </NavigationRouteContext.Provider>
    </NavigationContext.Provider>,
  );
  await act(async () => view.unmount());
}

const mountGuard = () =>
  render(
    <NavigationContext.Provider value={guarded as never}>
      <NavigationRouteContext.Provider value={{ key: ROUTE, name: "masalah/[id]" } as never}>
        <Guard />
      </NavigationRouteContext.Provider>
    </NavigationContext.Provider>,
  );

beforeEach(() => {
  listeners = [];
  dispatch.mockReset();
  (router.push as jest.Mock).mockClear();
});

describe("the unsaved guard after Buang", () => {
  it("asks again when the discarding dispatch was rejected", async () => {
    mountGuard();
    expect(close()).toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
    dispatch.mockImplementationOnce(() => {
      throw new Error("rejected");
    });
    // The dispatch throws inside the answer's continuation; the guard must still reset.
    await answerLast(true).catch(() => undefined);
    await act(async () => {});
    expect(dispatch).toHaveBeenCalledTimes(1);
    // A second close asks "Buang laporan?" again instead of walking through.
    expect(close()).toBe(true);
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it("asks again when the dispatch was held by something else", async () => {
    mountGuard();
    expect(close()).toBe(true);
    // While the guard re-dispatches, its own listener lets the removal pass; another screen's listener holds it.
    dispatch.mockImplementationOnce((action) => expect(close(action)).toBe(false));
    await answerLast(true);
    await act(async () => {});
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(close()).toBe(true);
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it("lets the removal through while its own dispatch runs, and asks nothing for a Batal", async () => {
    mountGuard();
    expect(close()).toBe(true);
    await answerLast(false);
    await act(async () => {});
    expect(dispatch).not.toHaveBeenCalled();
    expect(close()).toBe(true);
    expect(router.push).toHaveBeenCalledTimes(2);
  });
});
