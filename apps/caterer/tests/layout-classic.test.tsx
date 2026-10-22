import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Button, Card, Chip, Field, Screen, Segmented, Text } from "@catera/mobile-ui";

// Catera Dapur provides no layout scale, so the shared components keep today's geometry. This test fails if a v2 value
// leaks into a default.
const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never);

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
