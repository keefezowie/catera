import {
  fireEvent,
  render as plainRender,
  screen,
  within,
} from "@testing-library/react-native";
import { Share, StyleSheet } from "react-native";
import type { ReactElement } from "react";
import { render } from "./render-dapur";
import { createMobileRuntime, MobileProvider } from "@catera/mobile-core";
import { kitchenSession, type KitchenSession, type Stop } from "@catera/domain";
import { nativeThemes } from "@catera/design-tokens";
import { StopRow } from "@catera/mobile-ui";
import { SessionCard } from "../src/today/SessionCard";
import { stopStatus } from "../src/today/stopStatus";
import { canvasDay } from "./fixtures";
import type { Selection } from "../src/today/selection";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("../src/nav", () => ({ openLink: jest.fn(), goToTab: jest.fn() }));

const t = (id: string, _en: string) => id;
const stop = (stage: Stop["stage"], arrivedAt: string | null = null) =>
  ({ stage, arrivedAt }) as Stop;

describe("stopStatus", () => {
  it("has no status for a stop that is still scheduled", () => {
    expect(stopStatus(stop("scheduled"), t)).toBeNull();
  });
  it("names the cooking and out tones", () => {
    expect(stopStatus(stop("preparing"), t)).toEqual({
      label: "Dimasak",
      tone: "cooking",
    });
    expect(stopStatus(stop("out_for_delivery"), t)).toEqual({
      label: "Diantar",
      tone: "out",
    });
  });
  it("shows the Jakarta time for a stop that arrived, or the word alone without one", () => {
    expect(stopStatus(stop("arrived", "2026-10-08T03:21:00Z"), t)).toEqual({
      label: "Sampai 10.21",
      tone: "arrived",
    });
    expect(stopStatus(stop("delivered", "2026-10-08T03:21:00Z"), t)).toEqual({
      label: "Sampai 10.21",
      tone: "arrived",
    });
    expect(stopStatus(stop("arrived"), t)).toEqual({
      label: "Sampai",
      tone: "arrived",
    });
  });
});

type Stages = [Stop["stage"], string | null][];

function card(
  stages: Stages,
  selection?: Selection,
  note?: string,
): ReactElement {
  const runtime = createMobileRuntime({
    apiUrl: "https://api.example.test",
    storagePrefix: "t",
  });
  const ops = canvasDay();
  if (note) ops.deliveries[0].address.instructions = note;
  const base = kitchenSession(ops, "lunch", new Date())!;
  const stops = base.stops.map((s, i) => ({
    ...s,
    stage: stages[i][0],
    arrivedAt: stages[i][1],
  }));
  const count = (stage: Stop["stage"]) =>
    stops.filter((s) => s.stage === stage).length;
  const session: KitchenSession = {
    ...base,
    stops,
    counts: {
      scheduled: count("scheduled"),
      preparing: count("preparing"),
      out_for_delivery: count("out_for_delivery"),
      arrived: count("arrived"),
      delivered: count("delivered"),
    },
  };
  return (
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <SessionCard
        ops={ops}
        session={session}
        ticks={{ ticked: new Set(), toggle: () => undefined }}
        meal="lunch"
        date="2026-10-08"
        report="today"
        caterer="Dapur Bu Rina"
        selection={selection}
      />
    </MobileProvider>
  );
}

const ids = (node: unknown, out: string[] = []): string[] => {
  const n = node as {
    props?: { testID?: string };
    children?: unknown[];
  } | null;
  if (!n || typeof n !== "object") return out;
  if (n.props?.testID) out.push(n.props.testID);
  (n.children ?? []).forEach((c) => ids(c, out));
  return out;
};
const order = () => ids(screen.toJSON());

const mid: Stages = [
  ["arrived", "2026-10-08T03:21:00Z"],
  ["out_for_delivery", null],
  ["preparing", null],
  ["scheduled", null],
];

describe("SessionCard with stops on the road", () => {
  it("puts the delivery order above the cooking list once stops have left", () => {
    render(card(mid));
    const o = order();
    expect(o.indexOf("delivery-order")).toBeGreaterThanOrEqual(0);
    expect(o.indexOf("cooking-list")).toBeGreaterThanOrEqual(0);
    expect(o.indexOf("delivery-order")).toBeLessThan(o.indexOf("cooking-list"));
    expect(
      screen.getByTestId("stop-1-info").props.accessibilityLabel,
    ).toContain("Sampai 10.21");
  });

  it("draws a pill under each stop that has a status, and none for a scheduled one", () => {
    render(card(mid));
    expect(
      within(screen.getByTestId("stop-1")).getByText("Sampai 10.21"),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("stop-2")).getByText("Diantar"),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("stop-3")).getByText("Dimasak"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("stop-2-info").props.accessibilityLabel,
    ).toContain("Diantar");
    expect(screen.queryByTestId("stop-4-status")).toBeNull();
  });

  it("takes the arrived stop's number badge to the muted style", () => {
    render(card(mid));
    const arrived = StyleSheet.flatten(
      screen.getByTestId("stop-1-badge").props.style,
    );
    const out = StyleSheet.flatten(
      screen.getByTestId("stop-2-badge").props.style,
    );
    expect(arrived.backgroundColor).toBe(nativeThemes.light.line);
    expect(out.backgroundColor).toBe(nativeThemes.light.sage);
    const digit = within(screen.getByTestId("stop-1-badge")).getByText("1");
    expect(StyleSheet.flatten(digit.props.style).color).toBe(
      nativeThemes.light.muted,
    );
  });

  it("keeps the pills in Pilih mode, with the disabled note after them", () => {
    const selection: Selection = {
      active: true,
      selected: new Set(),
      start: () => undefined,
      stop: () => undefined,
      toggle: () => undefined,
      setMany: () => undefined,
    };
    render(card(mid, selection));
    expect(
      within(screen.getByTestId("stop-1")).getByText("Sampai 10.21"),
    ).toBeTruthy();
    const o = order();
    expect(o.indexOf("stop-1-status")).toBeGreaterThanOrEqual(0);
    expect(o.indexOf("stop-1-status")).toBeLessThan(o.indexOf("stop-1-note"));
    expect(
      screen.getByTestId("stop-1-info").props.accessibilityLabel,
    ).toContain("Sampai 10.21");
  });

  it("puts the pill after the delivery note when the stop has one", () => {
    render(card(mid, undefined, "pagar hijau"));
    const o = order();
    expect(o.indexOf("stop-1-delivery-note")).toBeGreaterThanOrEqual(0);
    expect(o.indexOf("stop-1-delivery-note")).toBeLessThan(
      o.indexOf("stop-1-status"),
    );
  });
});

describe("SessionCard before anything leaves", () => {
  it("keeps the cooking list first and draws no Diantar", () => {
    render(
      card([
        ["scheduled", null],
        ["scheduled", null],
        ["scheduled", null],
        ["scheduled", null],
      ]),
    );
    const o = order();
    expect(o.indexOf("cooking-list")).toBeLessThan(o.indexOf("delivery-order"));
    expect(screen.queryByText("Diantar")).toBeNull();
    expect(screen.queryByText("Dimasak")).toBeNull();
  });

  it("keeps the cooking list first while stops are only cooking", () => {
    render(
      card([
        ["preparing", null],
        ["preparing", null],
        ["preparing", null],
        ["preparing", null],
      ]),
    );
    const o = order();
    expect(o.indexOf("cooking-list")).toBeLessThan(o.indexOf("delivery-order"));
    expect(
      within(screen.getByTestId("stop-1")).getByText("Dimasak"),
    ).toBeTruthy();
  });
});

describe("SessionCard Bagikan", () => {
  it("shares the caterer on the first line and the recap from the second, with no indent", () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    render(
      card([
        ["scheduled", null],
        ["scheduled", null],
        ["scheduled", null],
        ["scheduled", null],
      ]),
    );
    fireEvent.press(screen.getByRole("button", { name: "Bagikan" }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0]).toEqual({
      message: [
        "Dapur Bu Rina",
        "*Makan siang* (34 porsi)",
        "Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur",
        "Menu belum diisi · Paket Hemat Kantor: 1 nasi, 1 lauk, 1 sayur",
      ].join("\n"),
    });
    share.mockRestore();
  });
});

describe("StopRow outside the Dapur geometry", () => {
  it("ignores status under the 44 geometry", () => {
    plainRender(
      <StopRow
        n={1}
        name="Bu Sari"
        detail="2 porsi"
        address="Jl. Melati"
        mapLabel="Peta"
        onMap={() => undefined}
        status={{ label: "Diantar", tone: "out" }}
      />,
    );
    expect(screen.queryByText("Diantar")).toBeNull();
  });
});
