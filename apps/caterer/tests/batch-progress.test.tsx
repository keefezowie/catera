import { screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { kitchenSession, type KitchenSession, type SellerOperationsState } from "@catera/domain";
import { MobileProvider, createMobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { nativeMood } from "@catera/design-tokens";
import { render } from "./render-dapur";
import { canvasDay } from "./fixtures";
import { BatchProgress, batchCounts } from "../src/today/BatchProgress";

type Row = { status: string; cooking_started_at?: string; departed_at?: string; arrived_at?: string };

/** The canvas day with one row per entry, each at the stage its fields imply. */
function sessionOf(rows: Row[]): KitchenSession {
  const day: SellerOperationsState = canvasDay();
  const base = day.deliveries[0];
  day.deliveries = rows.map((m, i) => ({ ...base, id: `d-${i}`, status: m.status, meals: [{ meal: "lunch", ...m }] })) as never;
  return kitchenSession(day, "lunch", new Date("2026-10-08T03:00:00Z")) as KitchenSession;
}

const times = { cooking_started_at: "2026-10-08T01:10:00Z", departed_at: "2026-10-08T02:30:00Z" };
const scheduled: Row = { status: "scheduled" };
const preparing: Row = { status: "preparing", cooking_started_at: times.cooking_started_at };
const out: Row = { status: "out_for_delivery", ...times };
const arrivedRow = (at: string): Row => ({ status: "out_for_delivery", ...times, arrived_at: at });
const delivered = (at: string): Row => ({ status: "delivered", ...times, arrived_at: at });
const many = (n: number, row: Row) => Array.from({ length: n }, () => row);

const mixed = () =>
  sessionOf([
    ...many(3, preparing),
    ...many(12, out),
    ...many(10, arrivedRow("2026-10-08T03:20:00Z")),
    ...many(5, delivered("2026-10-08T03:10:00Z")),
    delivered("2026-10-08T03:42:00Z"),
  ]);

function show(session: KitchenSession, english = false) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t" });
  const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
  if (english) store.set(runtime.storageKey("locale"), "en");
  else store.delete(runtime.storageKey("locale"));
  return render(
    <ThemeProvider storageKey="t.theme">
      <MoodProvider now={() => new Date("2026-10-08T03:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <BatchProgress session={session} />
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>,
  );
}
const hidden = { includeHiddenElements: true };
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style);

describe("batchCounts", () => {
  it("counts cooking, on the way and arrived (arrived plus delivered) over every active row", () => {
    expect(batchCounts(mixed())).toEqual({ total: 31, cooking: 3, out: 12, arrived: 16 });
  });
});

describe("BatchProgress", () => {
  it("renders nothing while every row is still scheduled (before Mulai masak, every future day)", () => {
    show(sessionOf(many(4, scheduled)));
    expect(screen.queryByTestId("batch-progress")).toBeNull();
  });

  it("mid-run: the title, the latest arrival, the bar in Sampai, Diantar, Dimasak order and the legend", () => {
    show(mixed());
    expect(screen.getByText("16 dari 31 sampai")).toBeTruthy();
    expect(screen.getByText("terakhir 10.42")).toBeTruthy();
    const bar = screen.getByTestId("batch-progress-bar");
    expect(bar.props.accessibilityRole).toBe("image");
    expect(bar.props.accessibilityLabel).toBe("16 sampai, 12 diantar, 3 dimasak, dari 31");
    const parts = within(bar).getAllByTestId(/^batch-progress-segment-/, hidden);
    expect(parts.map((p) => p.props.testID)).toEqual([
      "batch-progress-segment-arrived",
      "batch-progress-segment-out",
      "batch-progress-segment-cooking",
    ]);
    expect(parts.map((p) => StyleSheet.flatten(p.props.style).flex)).toEqual([16, 12, 3]);
    expect(flat("batch-progress-track").backgroundColor).toBe(nativeMood.light.siang.arcTrack);
    expect(flat("batch-progress-track").gap).toBe(2);
    // The legend is three cells, hidden from the reader because the bar's label already says it.
    expect(screen.getByTestId("batch-progress-legend", hidden).props.accessibilityElementsHidden).toBe(true);
    for (const [key, word, count] of [["cooking", "Dimasak", "3"], ["out", "Diantar", "12"], ["arrived", "Sampai", "16"]] as const) {
      const cell = within(screen.getByTestId(`batch-progress-cell-${key}`, hidden));
      expect(cell.getByText(word, hidden)).toBeTruthy();
      expect(cell.getByText(count, hidden)).toBeTruthy();
    }
  });

  it("leaves out a segment with no rows", () => {
    show(sessionOf([...many(2, preparing), ...many(3, out)]));
    expect(screen.queryByTestId("batch-progress-segment-arrived", hidden)).toBeNull();
    expect(screen.getByTestId("batch-progress-segment-out", hidden)).toBeTruthy();
    expect(screen.getByTestId("batch-progress-segment-cooking", hidden)).toBeTruthy();
  });

  it("falls back to when they left, then to when cooking began, when nobody has arrived", () => {
    const first = show(sessionOf([...many(2, out), preparing]));
    expect(screen.getByText("0 dari 3 sampai")).toBeTruthy();
    expect(screen.getByText("berangkat 09.30")).toBeTruthy();
    first.unmount();
    show(sessionOf([...many(2, preparing), scheduled]));
    expect(screen.getByText("mulai masak 08.10")).toBeTruthy();
  });

  it("all arrived: the whole bar is Sampai and the meta is the latest arrival", () => {
    show(sessionOf([...many(4, delivered("2026-10-08T03:00:00Z")), delivered("2026-10-08T03:42:00Z")]));
    expect(screen.getByText("5 dari 5 sampai")).toBeTruthy();
    expect(screen.getByText("terakhir 10.42")).toBeTruthy();
    expect(screen.queryByTestId("batch-progress-segment-out", hidden)).toBeNull();
    expect(screen.queryByTestId("batch-progress-segment-cooking", hidden)).toBeNull();
    expect(flat("batch-progress-segment-arrived").flex).toBe(5);
  });

  it("does not count rows marked Gagal diantar: 2 issues and 5 delivered read 5 dari 5", () => {
    show(sessionOf([...many(2, { status: "issue", ...times }), ...many(5, delivered("2026-10-08T03:00:00Z"))]));
    expect(screen.getByText("5 dari 5 sampai")).toBeTruthy();
  });

  it("words the title, meta, label and legend in English", async () => {
    show(mixed(), true);
    expect(await screen.findByText("16 of 31 arrived")).toBeTruthy();
    expect(screen.getByText("last arrival 10.42")).toBeTruthy();
    expect(screen.getByTestId("batch-progress-bar").props.accessibilityLabel).toBe("16 arrived, 12 on the way, 3 cooking, of 31");
    expect(within(screen.getByTestId("batch-progress-cell-out", hidden)).getByText("On the way", hidden)).toBeTruthy();
  });

  it("lets the title row and the legend cells wrap under large text: no line limit, no fixed height", () => {
    show(mixed());
    const cell = screen.getByTestId("batch-progress-cell-out", hidden);
    expect(within(cell).getByText("Diantar", hidden).props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(cell.props.style)).toMatchObject({ flex: 1, alignItems: "flex-start" });
    expect(StyleSheet.flatten(cell.props.style).height).toBeUndefined();
    expect(flat("batch-progress-head").flexWrap).toBe("wrap");
  });

  it("draws the segments and legend discs from the mood palette, in every theme and mood", () => {
    // The colour pairs are checked in the report with the contrast tool; here the tokens must exist so no hex is typed in.
    for (const scheme of ["light", "dark"] as const)
      for (const mood of ["siang", "malam"] as const) {
        const ink = nativeMood[scheme][mood];
        for (const key of ["toggleActive", "stopActive", "heroMeta", "arcTrack", "headerText", "headerMeta", "hero"] as const)
          expect(ink[key]).toMatch(/^#[0-9A-F]{6}$/i);
      }
    show(mixed());
    const ink = nativeMood.light.siang;
    expect(flat("batch-progress-segment-arrived").backgroundColor).toBe(ink.toggleActive);
    expect(flat("batch-progress-segment-out").backgroundColor).toBe(ink.stopActive);
    expect(flat("batch-progress-segment-cooking").backgroundColor).toBe(ink.heroMeta);
  });
});
