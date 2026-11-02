import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet } from "react-native";
import { contrastRatio, nativeThemes } from "@catera/design-tokens";
import { CalendarSheet, calendarCellWidth } from "@catera/mobile-ui";

/** G6b (spec 5.5): the shared calendar for changing a delivery day. */

type Day = { state: "available" | "current" | "unavailable"; reason?: "Penuh" | "Terisi" | "Dapur libur" | "Lewat batas waktu" };

const days: Record<string, Day> = {
  "2026-10-12": { state: "current" },
  "2026-10-13": { state: "available" },
  "2026-10-14": { state: "unavailable", reason: "Penuh" },
  "2026-10-15": { state: "available" },
  "2026-10-16": { state: "unavailable", reason: "Dapur libur" },
  "2026-11-02": { state: "available" },
};
const window = { from: "2026-10-12", to: "2026-11-20" };

async function setup(over: Partial<React.ComponentProps<typeof CalendarSheet>> = {}) {
  const onPick = jest.fn();
  const onConfirm = jest.fn(() => Promise.resolve());
  const view = await render(
    <CalendarSheet
      month="2026-10"
      days={days}
      current="2026-10-12"
      onPick={onPick}
      confirmLabel={(d) => `Pindah ke ${d}`}
      onConfirm={onConfirm}
      window={window}
      {...over}
    />,
  );
  return { onPick, onConfirm, ...view };
}
const cell = (date: string) => screen.getByTestId(`calendar-day-${date}`);
const confirm = () => screen.getByRole("button", { name: /Pindah/ });
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

describe("CalendarSheet", () => {
  it("keeps the customer line, and speaks to kitchen staff when `staff` is set", async () => {
    const customer = await setup();
    expect(screen.getByText("Pilih hari baru untuk pengantaranmu.")).toBeTruthy();
    await customer.unmount();
    await setup({ staff: true });
    expect(screen.getByText("Pilih hari baru untuk pengantaran pelanggan.")).toBeTruthy();
    await fireEvent.press(cell("2026-10-12"));
    expect(screen.getByText("Ini hari pengantaran pelanggan sekarang.")).toBeTruthy();
  });

  it("the button stays disabled until a new day is chosen", async () => {
    const { onPick, onConfirm } = await setup();
    expect(confirm().props.accessibilityState.disabled).toBe(true);
    expect(confirm()).toHaveTextContent("Pindah tanggal");
    // The current day is not a new day.
    await fireEvent.press(cell("2026-10-12"));
    expect(onPick).not.toHaveBeenCalled();
    expect(confirm().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(cell("2026-10-13"));
    expect(onPick).toHaveBeenCalledWith("2026-10-13");
    expect(confirm().props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText("Pindah ke 2026-10-13")).toBeTruthy();
    await act(async () => void await fireEvent.press(confirm()));
    expect(onConfirm).toHaveBeenCalledWith("2026-10-13");
  });

  it("an unavailable day reads its reason on tap", async () => {
    const { onPick } = await setup();
    await fireEvent.press(cell("2026-10-13"));
    await fireEvent.press(cell("2026-10-14"));
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent(/Penuh/);
    expect(screen.getByTestId("calendar-caption").props.accessibilityLiveRegion).toBe("polite");
    // The reason is not a pick: the earlier choice stays.
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(confirm().props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(cell("2026-10-16"));
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent(/Dapur libur/);
  });

  it("month paging stops at the window edges", async () => {
    await setup();
    expect(screen.getByTestId("calendar-month")).toHaveTextContent("Oktober 2026");
    const prev = () => screen.getByLabelText("Bulan sebelumnya");
    const next = () => screen.getByLabelText("Bulan berikutnya");
    expect(prev().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(next());
    expect(screen.getByTestId("calendar-month")).toHaveTextContent("November 2026");
    expect(screen.getByTestId("calendar-day-2026-11-02")).toBeTruthy();
    await fireEvent.press(next());
    await fireEvent.press(next());
    // The window ends in November.
    expect(screen.getByTestId("calendar-month")).toHaveTextContent("November 2026");
    expect(next().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(prev());
    expect(screen.getByTestId("calendar-month")).toHaveTextContent("Oktober 2026");
  });

  it("a window of one month has nowhere to page", async () => {
    await setup({ window: { from: "2026-10-12", to: "2026-10-30" } });
    expect(screen.getByLabelText("Bulan sebelumnya").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText("Bulan berikutnya").props.accessibilityState.disabled).toBe(true);
  });

  it("the current day is outlined and the chosen day filled", async () => {
    await setup();
    const forest = nativeThemes.light.forest;
    const current = flat(cell("2026-10-12"));
    expect(current.borderWidth).toBeGreaterThan(0);
    expect(current.borderColor).toBe(forest);
    expect(current.backgroundColor ?? "transparent").toBe("transparent");
    await fireEvent.press(cell("2026-10-15"));
    const chosen = flat(cell("2026-10-15"));
    expect(chosen.borderColor).toBe(forest);
    expect(chosen.borderWidth).toBeGreaterThan(Number(current.borderWidth));
    expect(chosen.backgroundColor).toBeTruthy();
    expect(chosen.backgroundColor).not.toBe("transparent");
    // The label of the chosen day is forest too, and the fill is a neutral step, never a forest block.
    expect(chosen.backgroundColor).not.toBe(forest);
    expect(flat(screen.getByTestId("calendar-num-2026-10-15")).color).toBe(forest);
  });

  it("cells carry tabular numerals and an accessibility label with the state", async () => {
    await setup();
    expect(flat(screen.getByTestId("calendar-num-2026-10-13")).fontVariant).toContain("tabular-nums");
    expect(cell("2026-10-13").props.accessibilityLabel).toBe("Selasa 13 Okt, tersedia");
    expect(cell("2026-10-12").props.accessibilityLabel).toBe("Senin 12 Okt, hari pengantaran sekarang");
    expect(cell("2026-10-14").props.accessibilityLabel).toBe("Rabu 14 Okt, tidak tersedia, Penuh");
    await fireEvent.press(cell("2026-10-13"));
    expect(cell("2026-10-13").props.accessibilityLabel).toBe("Selasa 13 Okt, dipilih");
    expect(cell("2026-10-13").props.accessibilityState.selected).toBe(true);
  });

  it("shows busy while the move runs and the failure at the button", async () => {
    let release: () => void = () => {};
    const onConfirm = jest.fn(() => new Promise<void>((r) => (release = r)));
    await setup({ onConfirm });
    await fireEvent.press(cell("2026-10-13"));
    await act(async () => void await fireEvent.press(confirm()));
    expect(confirm().props.accessibilityState.busy).toBe(true);
    await act(async () => void await fireEvent.press(confirm()));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => release());
    expect(confirm().props.accessibilityState.busy).toBe(false);
  });

  it("a failed move stays on the sheet with the error", async () => {
    const onConfirm = jest.fn(() => Promise.reject(new Error("Tanggal itu sudah penuh.")));
    await setup({ onConfirm });
    await fireEvent.press(cell("2026-10-13"));
    await act(async () => void await fireEvent.press(confirm()));
    expect(screen.getByTestId("form-error")).toHaveTextContent(/Tanggal itu sudah penuh./);
  });
  it("seven cells reach 48dp at 360dp on both platforms", async () => {
    expect(calendarCellWidth(360, "android")).toBeGreaterThanOrEqual(48);
    expect(calendarCellWidth(360, "ios")).toBeGreaterThanOrEqual(48);
    // The grid and the weekday row bleed into the sheet's side padding and keep no gap between cells.
    await setup();
    const row = flat(screen.getByTestId("calendar-week-0"));
    expect(row.gap ?? 0).toBe(0);
    expect(Number(row.marginHorizontal)).toBeLessThan(0);
    expect(flat(cell("2026-10-13")).minWidth).toBeUndefined();
  });

  it("an unavailable day keeps a legible muted numeral and a strike-through, not a dim", async () => {
    await setup();
    expect(flat(cell("2026-10-14")).opacity ?? 1).toBe(1);
    const num = flat(screen.getByTestId("calendar-num-2026-10-14"));
    expect(num.opacity ?? 1).toBe(1);
    expect(num.textDecorationLine).toBe("line-through");
    expect(num.color).toBe(nativeThemes.light.muted);
    expect(flat(screen.getByTestId("calendar-num-2026-10-13")).textDecorationLine ?? "none").toBe("none");
    // Muted numerals sit on the sheet's surface as normal text, so 4.5:1 in both looks.
    for (const look of [nativeThemes.light, nativeThemes.dark]) expect(contrastRatio(look.muted, look.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("tapping the current day says it is the delivery day now", async () => {
    await setup();
    await fireEvent.press(cell("2026-10-12"));
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent("Ini hari pengantaranmu sekarang.");
  });

  it("the month chevrons are charcoal, not forest", async () => {
    await setup();
    for (const [label, name] of [["Bulan sebelumnya", "chevron-back"], ["Bulan berikutnya", "chevron-forward"]]) {
      expect(flat(within(screen.getByLabelText(label)).getByText(String.fromCodePoint(Ionicons.glyphMap[name as keyof typeof Ionicons.glyphMap]))).color).toBe(nativeThemes.light.charcoal);
    }
  });

  it("says when no day in the range can be picked", async () => {
    await setup({ days: { "2026-10-12": { state: "current" }, "2026-10-14": { state: "unavailable", reason: "Penuh" } } });
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent("Belum ada hari lain yang bisa kamu pilih di rentang ini.");
    expect(confirm().props.accessibilityState.disabled).toBe(true);
  });

  it("an available day outside the window does not count as a choice", async () => {
    await setup({ days: { "2026-10-12": { state: "current" }, "2026-12-01": { state: "available" } } });
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent(/Belum ada hari lain/);
  });

  it("the staff line says no other day is open, in English too", async () => {
    await setup({ staff: true, locale: "en", days: { "2026-10-12": { state: "current" } } });
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent("No other day is open in this range.");
  });

  it("the English locale drives the sheet's own words too", async () => {
    await setup({ locale: "en", days: { "2026-10-12": { state: "current" } } });
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent("There is no other day you can pick in this range.");
    expect(screen.getByLabelText("Previous month")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Move date/ })).toBeTruthy();
  });

  it("the weekday header is hidden from both screen readers", async () => {
    await setup();
    const header = screen.getByTestId("calendar-weekdays", { includeHiddenElements: true });
    expect(header.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(header.props.accessibilityElementsHidden).toBe(true);
  });

  it("day taps do nothing while the move runs", async () => {
    let release: () => void = () => {};
    const onConfirm = jest.fn(() => new Promise<void>((r) => (release = r)));
    const { onPick } = await setup({ onConfirm });
    await fireEvent.press(cell("2026-10-13"));
    await act(async () => void await fireEvent.press(confirm()));
    expect(cell("2026-10-15").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(cell("2026-10-15"));
    expect(onPick).toHaveBeenCalledTimes(1);
    await act(async () => release());
    expect(cell("2026-10-15").props.accessibilityState.disabled).toBe(false);
  });
});
