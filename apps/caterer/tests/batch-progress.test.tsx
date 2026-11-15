import { act, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { kitchenSession, type KitchenSession, type SellerOperationsState } from "@catera/domain";
import { MobileProvider, createMobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { contrastRatio, nativeMood } from "@catera/design-tokens";
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

/** Renders the header and waits for MobileProvider to read its stored locale, so no update lands outside act(). */
async function show(session: KitchenSession, english = false) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t" });
  const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
  if (english) store.set(runtime.storageKey("locale"), "en");
  else store.delete(runtime.storageKey("locale"));
  const view = await render(
    <ThemeProvider storageKey="t.theme">
      <MoodProvider now={() => new Date("2026-10-08T03:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <BatchProgress session={session} />
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return view;
}
const hidden = { includeHiddenElements: true };
const label = () => screen.getByTestId("batch-progress", hidden).props.accessibilityLabel;
const step = (k: string) => StyleSheet.flatten(screen.getByTestId(`batch-step-${k}`, hidden).props.style);
const ink = nativeMood.light.siang;

describe("batchCounts", () => {
  it("counts cooking, on the way and arrived (arrived plus delivered) over every active row", async () => {
    expect(batchCounts(mixed())).toEqual({ total: 31, scheduled: 0, cooking: 3, out: 12, arrived: 16 });
  });
});

describe("BatchProgress step bar", () => {
  it("shows Masak current at 0 dari total while every row is still scheduled, with no time yet", async () => {
    await show(sessionOf(many(4, scheduled)));
    expect(screen.getByText("Masak · 0 dari 4")).toBeTruthy();
    expect(label()).toBe("Langkah Masak, 0 dari 4");
    expect(step("cook").backgroundColor).toBe(ink.stopActive);
    expect(screen.queryByTestId("batch-progress-meta", hidden)).toBeNull();
  });

  it("Masak is current while some stops moved on and the rest are scheduled, with the count that started", async () => {
    await show(sessionOf([...many(2, scheduled), ...many(2, preparing)]));
    expect(screen.getByText("Masak · 2 dari 4")).toBeTruthy();
    expect(label()).toBe("Langkah Masak, 2 dari 4, mulai masak 08.10");
    expect(screen.getByTestId("batch-progress-meta", hidden).props.children).toBe("mulai masak 08.10");
    expect(step("cook").backgroundColor).toBe(ink.stopActive);
    expect(step("depart").backgroundColor).toBe("transparent");
  });

  it("Antar is current once all are cooking: Masak is done, Sampai waits", async () => {
    await show(sessionOf([...many(2, preparing), out]));
    expect(screen.getByText("Antar · 1 dari 3")).toBeTruthy();
    expect(screen.getByText("Masak")).toBeTruthy();
    expect(screen.getByText("Sampai")).toBeTruthy();
    expect(label()).toBe("Langkah Antar, 1 dari 3, berangkat 09.30. Masak selesai");
    expect(screen.getByTestId("batch-progress-meta", hidden).props.children).toBe("berangkat 09.30");
    expect(step("cook").backgroundColor).toBe(ink.toggleActive);
    expect(step("depart").backgroundColor).toBe(ink.stopActive);
    expect(step("arrive").backgroundColor).toBe("transparent");
  });

  it("Sampai is current once everything has left, with the count that arrived", async () => {
    await show(sessionOf([...many(3, out), ...many(3, arrivedRow("2026-10-08T03:20:00Z"))]));
    expect(screen.getByText("Sampai · 3 dari 6")).toBeTruthy();
    expect(label()).toBe("Langkah Sampai, 3 dari 6, terakhir 10.20. Masak dan Antar selesai");
    expect(screen.getByTestId("batch-progress-meta", hidden).props.children).toBe("terakhir 10.20");
    expect(step("cook").backgroundColor).toBe(ink.toggleActive);
    expect(step("depart").backgroundColor).toBe(ink.toggleActive);
    expect(step("arrive").backgroundColor).toBe(ink.stopActive);
  });

  it("all arrived: the three steps are done and none is current", async () => {
    await show(sessionOf(many(3, delivered("2026-10-08T03:10:00Z"))));
    expect(label()).toBe("Masak, Antar, dan Sampai selesai, terakhir 10.10");
    for (const k of ["cook", "depart", "arrive"]) expect(step(k).backgroundColor).toBe(ink.toggleActive);
    expect(screen.queryByText(/dari/)).toBeNull();
  });

  it("does not count rows marked Gagal diantar", async () => {
    await show(sessionOf([...many(5, delivered("2026-10-08T03:10:00Z")), { status: "issue" }, { status: "issue" }]));
    expect(label()).toBe("Masak, Antar, dan Sampai selesai, terakhir 10.10");
  });

  it("words the label and steps in English", async () => {
    await show(sessionOf([...many(3, out), ...many(3, arrivedRow("2026-10-08T03:20:00Z"))]), true);
    expect(screen.getByText("Arrive · 3 of 6")).toBeTruthy();
    expect(label()).toBe("Step Arrive, 3 of 6, last arrival 10.20. Cook and Deliver done");
  });

  it("lets the step names wrap under large text: no line limit, no fixed height", async () => {
    await show(mixed());
    expect(screen.getByText("Antar · 28 dari 31").props.numberOfLines).toBeUndefined();
    for (const k of ["cook", "depart", "arrive"]) expect(step(k).height).toBeUndefined();
  });

  it("keeps each step's ink 4.5:1 on its fill, and the idle outline 3:1 on the mood header, in every theme and mood", () => {
    for (const scheme of ["light", "dark"] as const)
      for (const mood of ["siang", "malam"] as const) {
        const k = nativeMood[scheme][mood];
        expect(contrastRatio(k.hero, k.stopActive)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(k.hero, k.toggleActive)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(k.headerMeta, k.header)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(k.markerIdle, k.header)).toBeGreaterThanOrEqual(3);
      }
  });
});
