import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Button, Card, Chip, Field, fontFor, Screen, Segmented, Stepper, Text } from "@catera/mobile-ui";
import { nativeLayout, nativeThemes } from "@catera/design-tokens";
import { withDapurScale } from "./dapur-scale";

const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never);

// Without a provider the shared components keep the classic geometry. Dapur screen tests mount without the root, so
// they still render classic; this case fails if a v2 value leaks into a default.
test("without a layout scale the shared components keep the classic geometry", () => {
  render(
    <Screen>
      <Button label="Simpan" onPress={() => {}} />
      <Chip label="Halal" selected={false} onPress={() => {}} />
      <Segmented options={[{ value: "a", label: "Satu" }]} value="a" onChange={() => {}} />
      <Field label="Nama" />
      <Card testID="card">
        <Text variant="body">Isi</Text>
      </Card>
    </Screen>,
  );
  expect(flat(screen.getByTestId("screen-body")).paddingHorizontal).toBe(20);
  expect(flat(screen.getByRole("button", { name: "Simpan" }))).toMatchObject({ minHeight: 48, borderRadius: 10 });
  const chip = screen.getByRole("button", { name: "Halal" });
  expect(flat(chip)).toMatchObject({ minHeight: 48, borderRadius: 9 });
  expect(chip.props.hitSlop).toBeUndefined();
  expect(flat(screen.getByRole("tab", { name: "Satu" })).minHeight).toBe(48);
  expect(flat(screen.getByLabelText("Nama"))).toMatchObject({ minHeight: 48, borderRadius: 9 });
  expect(flat(screen.getByTestId("card"))).toMatchObject({ borderRadius: 16, padding: 16, gap: 10 });
  expect(flat(screen.getByText("Isi"))).toMatchObject({ fontSize: 14, lineHeight: 23 });
});

// Spec 2.3: additive keys; the existing ones keep their values.
test("nativeLayout gains the Dapur keys and keeps the existing ones", () => {
  expect(nativeLayout.row).toMatchObject({ single: 56, media: 72, keyValue: 40, info: 48, compact: 64, check: 56 });
  expect(nativeLayout.thumb).toMatchObject({ sm: 56, md: 64, compact: 48 });
  expect(nativeLayout.dense).toEqual({ sectionGap: 24 });
  expect(nativeLayout.figure).toEqual({ lead: 32, leadLine: 40 });
  expect(nativeLayout.sectionGap).toBe(32);
});

// The Dapur root provides `v2` with a 48 touch target (spec 2.1, 2.2).
describe("under the Dapur scale", () => {
  test("Screen, Button, Field and Card take the v2 geometry", () => {
    render(
      withDapurScale(
        <Screen>
          <Button label="Simpan" onPress={() => {}} />
          <Field label="Nama" />
          <Card testID="card">
            <Text variant="body">Isi</Text>
          </Card>
        </Screen>,
      ),
    );
    expect(flat(screen.getByTestId("screen-body")).paddingHorizontal).toBe(16);
    expect(flat(screen.getByRole("button", { name: "Simpan" }))).toMatchObject({ minHeight: 50, borderRadius: 25 });
    expect(flat(screen.getByLabelText("Nama")).minHeight).toBe(50);
    const card = flat(screen.getByTestId("card"));
    expect(card).toMatchObject({ borderRadius: 16, gap: 8 });
    // Content sits 16 in: light draws the shared 1px hairline and the padding gives it up (dark has no border).
    expect((card.borderWidth ?? 0) + (card.padding as number)).toBe(16);
  });

  test("a chip and each segment are 34 with a 48 target: hitSlop 7 above and below", () => {
    render(
      withDapurScale(
        <>
          <Chip label="Halal" selected={false} onPress={() => {}} />
          <Segmented options={[{ value: "a", label: "Satu" }, { value: "b", label: "Dua" }]} value="a" onChange={() => {}} />
        </>,
      ),
    );
    const chip = screen.getByRole("button", { name: "Halal" });
    expect(flat(chip)).toMatchObject({ minHeight: 34, borderRadius: 17 });
    expect(chip.props.hitSlop).toEqual({ top: 7, bottom: 7 });
    for (const name of ["Satu", "Dua"]) {
      const segment = screen.getByRole("tab", { name });
      expect(flat(segment).minHeight).toBe(34);
      expect(segment.props.hitSlop).toEqual({ top: 7, bottom: 7 });
    }
  });

  test("the Stepper buttons are 44 circles with hitSlop 2 on every side", () => {
    render(
      withDapurScale(
        <Stepper label="Porsi" decreaseLabel="Kurangi porsi" increaseLabel="Tambah porsi" value={3} onChange={() => {}} />,
      ),
    );
    for (const name of ["Kurangi porsi", "Tambah porsi"]) {
      const button = screen.getByRole("button", { name });
      expect(flat(button)).toMatchObject({ width: 44, height: 44, borderRadius: 22 });
      expect(button.props.hitSlop).toBe(2);
    }
  });

  test("the figure variant is 32/40 at 800 with tabular figures, charcoal, and not a header", () => {
    render(withDapurScale(<Text variant="figure">1.240</Text>));
    const figure = screen.getByText("1.240");
    expect(flat(figure)).toMatchObject({
      fontSize: 32,
      lineHeight: 40,
      fontFamily: fontFor("800"),
      fontVariant: ["tabular-nums"],
      color: nativeThemes.light.charcoal,
    });
    expect(figure.props.accessibilityRole).toBeUndefined();
  });
});
