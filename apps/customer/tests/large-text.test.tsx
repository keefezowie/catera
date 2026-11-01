import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Button, Text } from "@catera/mobile-ui";

/** The phone the text is drawn on; a test sets its font scale. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const flat = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style) as Record<string, unknown>;

describe("Text at large font sizes", () => {
  it("keeps every variant's line height at the default font size", () => {
    mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
    render(<Text variant="outcome">Langganan aktif</Text>);
    expect(flat("Langganan aktif")).toMatchObject({ fontSize: 26, lineHeight: 32 });
  });

  it("on Android above font scale 1 drops the fixed line height, so descenders are not cut", () => {
    // Android 14 scales large sizes less than small ones, so a 26/32 heading at 2.0 becomes about 37/40 and its
    // descenders fall outside the line. The font's own line height always holds the glyphs.
    mockWindow = { width: 411, height: 860, scale: 3, fontScale: 2 };
    render(
      <>
        <Text variant="outcome">Langganan aktif</Text>
        <Text variant="meta" style={{ lineHeight: 30 }}>
          1 pengantaran
        </Text>
      </>,
    );
    expect(flat("Langganan aktif").lineHeight).toBeUndefined();
    expect(flat("Langganan aktif").fontSize).toBe(26);
    expect(flat("1 pengantaran").lineHeight).toBeUndefined();
  });

  it("centres a button label, so one that wraps at large text stays centred in its button", () => {
    render(<Button label="Bagikan rute ke WhatsApp" variant="secondary" onPress={() => {}} />);
    expect(flat("Bagikan rute ke WhatsApp").textAlign).toBe("center");
  });
});
