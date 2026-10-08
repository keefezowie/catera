import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { fontFor, fonts, Text } from "@catera/mobile-ui";

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
