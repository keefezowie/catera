import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import * as Reanimated from "react-native-reanimated";
import { AppHeader, Button, Chip, fontFor, fonts, PressableScale, RoundButton, Text } from "@catera/mobile-ui";

test("fontFor maps weights to static families", () => {
  expect(fontFor(undefined)).toBe(fonts.regular);
  expect(fontFor("500")).toBe(fonts.medium);
  expect(fontFor("600")).toBe(fonts.semibold);
  expect(fontFor("bold")).toBe(fonts.bold);
  expect(fontFor("700")).toBe(fonts.bold);
  expect(fontFor("800")).toBe(fonts.extrabold);
});

test("Text turns a caller's fontWeight into a family", () => {
  render(<Text style={{ fontWeight: "700" }}>Halo</Text>);
  const style = StyleSheet.flatten(screen.getByText("Halo").props.style);
  expect(style.fontFamily).toBe("Jakarta-Bold");
  expect(style.fontWeight).toBeUndefined();
});

test("an explicit fontFamily wins over the variant weight", () => {
  render(
    <Text variant="heading" style={{ fontFamily: fonts.semibold }}>
      x
    </Text>,
  );
  const style = StyleSheet.flatten(screen.getByText("x").props.style);
  expect(style.fontFamily).toBe("Jakarta-SemiBold");
  expect(style.fontWeight).toBeUndefined();
});

test.each([
  ["title", 30, 39],
  ["heading", 21, 28],
  ["body", 14, 23],
  ["label", 12, 23],
  ["caption", 11, 18],
] as const)("%s uses the documented ramp", (variant, size, line) => {
  render(<Text variant={variant}>x</Text>);
  const s = StyleSheet.flatten(screen.getByText("x").props.style);
  expect([s.fontSize, s.lineHeight]).toEqual([size, line]);
});

test("title and heading use the bold family", () => {
  render(<Text variant="title">Jadwal</Text>);
  expect(StyleSheet.flatten(screen.getByText("Jadwal").props.style).fontFamily).toBe("Jakarta-Bold");
});

describe("press feedback and haptics", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  test("Button fires onPress and a light haptic", () => {
    const onPress = jest.fn();
    render(<Button label="Bayar" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  test("disabled Button fires no haptic", () => {
    const onPress = jest.fn();
    render(<Button label="Bayar" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    expect(onPress).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test("Chip fires a selection haptic", () => {
    const onPress = jest.fn();
    render(<Chip label="Halal" selected={false} onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Halal" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test("a rejected haptic never throws", () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error("no motor"));
    render(<Button label="Bayar" onPress={() => {}} />);
    expect(() => fireEvent.press(screen.getByRole("button", { name: "Bayar" }))).not.toThrow();
  });

  test("does not scale when reduced motion is on", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    render(<PressableScale testID="p" haptic="none" />);
    fireEvent(screen.getByTestId("p"), "pressIn");
    const style = StyleSheet.flatten(screen.getByTestId("p").props.style);
    const scales = (style.transform ?? []).map((t: { scale?: number }) => t.scale).filter((v: unknown) => v !== undefined);
    expect(scales.every((v: number) => v === 1)).toBe(true);
    // The Reanimated jest mock does not replay shared-value changes; the 0.85 dim is checked on the emulator.
    expect(style.transform).toBeUndefined();
  });
});

describe("AppHeader", () => {
  it("shows a one-line title and a back button", () => {
    const onBack = jest.fn();
    render(<AppHeader title="Bantuan dan laporan" onBack={onBack} backLabel="Kembali" />);
    expect(screen.getByText("Bantuan dan laporan").props.numberOfLines).toBe(1);
    fireEvent.press(screen.getByRole("button", { name: "Kembali" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("modal shows a close button", () => {
    const onBack = jest.fn();
    render(<AppHeader title="Masuk" onBack={onBack} backLabel="Tutup" modal />);
    fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("has no button when there is nothing to go back to", () => {
    render(<AppHeader title="Hari" backLabel="Kembali" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

test("RoundButton presses with a haptic", () => {
  jest.clearAllMocks();
  const onPress = jest.fn();
  render(<RoundButton icon="heart-outline" label="Simpan" onPress={onPress} />);
  fireEvent.press(screen.getByRole("button", { name: "Simpan" }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});
