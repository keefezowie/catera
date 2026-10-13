import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { nativeThemes } from "@catera/design-tokens";
import { CalendarSheet } from "@catera/mobile-ui";

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

function setup(over: Partial<React.ComponentProps<typeof CalendarSheet>> = {}) {
  const onPick = jest.fn();
  const onConfirm = jest.fn(() => Promise.resolve());
  const view = render(
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
  it("the button stays disabled until a new day is chosen", async () => {
    const { onPick, onConfirm } = setup();
    expect(confirm().props.accessibilityState.disabled).toBe(true);
    expect(confirm()).toHaveTextContent("Pindah tanggal");
    // The current day is not a new day.
    fireEvent.press(cell("2026-10-12"));
    expect(onPick).not.toHaveBeenCalled();
    expect(confirm().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(cell("2026-10-13"));
    expect(onPick).toHaveBeenCalledWith("2026-10-13");
    expect(confirm().props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText("Pindah ke 2026-10-13")).toBeTruthy();
    await act(async () => void fireEvent.press(confirm()));
    expect(onConfirm).toHaveBeenCalledWith("2026-10-13");
  });

  it("an unavailable day reads its reason on tap", () => {
    const { onPick } = setup();
    fireEvent.press(cell("2026-10-13"));
    fireEvent.press(cell("2026-10-14"));
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent(/Penuh/);
    expect(screen.getByTestId("calendar-caption").props.accessibilityLiveRegion).toBe("polite");
    // The reason is not a pick: the earlier choice stays.
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(confirm().props.accessibilityState.disabled).toBe(false);
    fireEvent.press(cell("2026-10-16"));
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent(/Dapur libur/);
  });

  it("month paging stops at the window edges", () => {
    setup();
    expect(screen.getByTestId("calendar-month")).toHaveTextContent("Oktober 2026");
    const prev = () => screen.getByLabelText("Bulan sebelumnya");
    const next = () => screen.getByLabelText("Bulan berikutnya");
    expect(prev().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(next());
    expect(screen.getByTestId("calendar-month")).toHaveTextContent("November 2026");
    expect(screen.getByTestId("calendar-day-2026-11-02")).toBeTruthy();
    fireEvent.press(next());
    fireEvent.press(next());
    // The window ends in November.
    expect(screen.getByTestId("calendar-month")).toHaveTextContent("November 2026");
    expect(next().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(prev());
    expect(screen.getByTestId("calendar-month")).toHaveTextContent("Oktober 2026");
  });

  it("a window of one month has nowhere to page", () => {
    setup({ window: { from: "2026-10-12", to: "2026-10-30" } });
    expect(screen.getByLabelText("Bulan sebelumnya").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText("Bulan berikutnya").props.accessibilityState.disabled).toBe(true);
  });

  it("the current day is outlined and the chosen day filled", () => {
    setup();
    const forest = nativeThemes.light.forest;
    const current = flat(cell("2026-10-12"));
    expect(current.borderWidth).toBeGreaterThan(0);
    expect(current.borderColor).toBe(forest);
    expect(current.backgroundColor ?? "transparent").toBe("transparent");
    fireEvent.press(cell("2026-10-15"));
    const chosen = flat(cell("2026-10-15"));
    expect(chosen.borderColor).toBe(forest);
    expect(chosen.borderWidth).toBeGreaterThan(Number(current.borderWidth));
    expect(chosen.backgroundColor).toBeTruthy();
    expect(chosen.backgroundColor).not.toBe("transparent");
    // The label of the chosen day is forest too, and the fill is a neutral step, never a forest block.
    expect(chosen.backgroundColor).not.toBe(forest);
    expect(flat(screen.getByTestId("calendar-num-2026-10-15")).color).toBe(forest);
  });

  it("cells carry tabular numerals and an accessibility label with the state", () => {
    setup();
    expect(flat(screen.getByTestId("calendar-num-2026-10-13")).fontVariant).toContain("tabular-nums");
    expect(cell("2026-10-13").props.accessibilityLabel).toBe("Selasa 13 Okt, tersedia");
    expect(cell("2026-10-12").props.accessibilityLabel).toBe("Senin 12 Okt, hari pengantaran sekarang");
    expect(cell("2026-10-14").props.accessibilityLabel).toBe("Rabu 14 Okt, tidak tersedia, Penuh");
    fireEvent.press(cell("2026-10-13"));
    expect(cell("2026-10-13").props.accessibilityLabel).toBe("Selasa 13 Okt, dipilih");
    expect(cell("2026-10-13").props.accessibilityState.selected).toBe(true);
  });

  it("shows busy while the move runs and the failure at the button", async () => {
    let release: () => void = () => {};
    const onConfirm = jest.fn(() => new Promise<void>((r) => (release = r)));
    setup({ onConfirm });
    fireEvent.press(cell("2026-10-13"));
    await act(async () => void fireEvent.press(confirm()));
    expect(confirm().props.accessibilityState.busy).toBe(true);
    await act(async () => void fireEvent.press(confirm()));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => release());
    expect(confirm().props.accessibilityState.busy).toBe(false);
  });

  it("a failed move stays on the sheet with the error", async () => {
    const onConfirm = jest.fn(() => Promise.reject(new Error("Tanggal itu sudah penuh.")));
    setup({ onConfirm });
    fireEvent.press(cell("2026-10-13"));
    await act(async () => void fireEvent.press(confirm()));
    expect(screen.getByTestId("form-error")).toHaveTextContent(/Tanggal itu sudah penuh./);
  });
});
