import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { LayoutScaleProvider, Text } from "@catera/mobile-ui";
import { nativeLayout, nativeThemes } from "@catera/design-tokens";
import { GlyphRow, ListCard, MediaRow, SectionHeader, Thumb } from "../src/layout";

const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never);

describe("layout blocks", () => {
  it("MediaRow is 72 tall with a 56 thumb and one-line title and meta", () => {
    render(<MediaRow testID="row" image="https://x/y.jpg" title="Nasi ayam" meta="Rp25.000" onPress={() => {}} />);
    expect(flat(screen.getByTestId("row")).minHeight).toBe(72);
    expect(flat(screen.getByTestId("row-thumb"))).toMatchObject({ width: 56, height: 56, borderRadius: 8 });
    expect(screen.getByText("Nasi ayam").props.numberOfLines).toBe(1);
    expect(screen.getByText("Rp25.000").props.numberOfLines).toBe(1);
  });

  it("MediaRow presses, shows a chevron and a custom trailing node", () => {
    const onPress = jest.fn();
    render(<MediaRow testID="row" title="Satu" trailing="chevron" onPress={onPress} />);
    fireEvent.press(screen.getByTestId("row"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("row-chevron")).toBeTruthy();
    render(<MediaRow testID="row2" title="Dua" trailing={<Text testID="tail">x</Text>} />);
    expect(screen.getByTestId("tail")).toBeTruthy();
    expect(screen.queryByTestId("row2-chevron")).toBeNull();
  });

  it("MediaRow without a press target is not a button", () => {
    render(<MediaRow testID="row" title="Satu" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("MediaRow with notSet draws the dashed thumb", () => {
    render(<MediaRow testID="row" title="Belum dipilih" notSet />);
    expect(screen.getByTestId("row-thumb-not-set")).toBeTruthy();
  });

  it("ListCard puts one separator between each pair of children", () => {
    render(
      <ListCard>
        <Text>a</Text>
        <Text>b</Text>
        <Text>c</Text>
      </ListCard>,
    );
    expect(screen.getAllByTestId("list-card-separator")).toHaveLength(2);
    expect(flat(screen.getByTestId("list-card"))).toMatchObject({ borderRadius: 16, paddingHorizontal: 16 });
    expect(flat(screen.getAllByTestId("list-card-separator")[0]).height).toBe(1);
  });

  it("ListCard with one child has no separator", () => {
    render(
      <ListCard>
        <Text>a</Text>
      </ListCard>,
    );
    expect(screen.queryByTestId("list-card-separator")).toBeNull();
  });

  it("SectionHeader shows the title and fires its action", () => {
    const onPress = jest.fn();
    render(<SectionHeader title="Minggu ini" action={{ label: "Lihat semua", onPress }} />);
    expect(screen.getByText("Minggu ini")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Lihat semua" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(flat(screen.getByTestId("section-header")).marginBottom).toBe(12);
  });

  it("SectionHeader without an action has no button", () => {
    render(<SectionHeader title="Minggu ini" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Thumb notSet draws the dashed 1.5 controlRing tile", () => {
    render(<Thumb notSet />);
    expect(flat(screen.getByTestId("thumb-not-set"))).toMatchObject({
      borderStyle: "dashed",
      borderWidth: 1.5,
      borderColor: nativeThemes.light.controlRing,
      width: 56,
      height: 56,
      borderRadius: 8,
    });
  });

  it("Thumb takes size 64 and shows a photo when it has a uri", () => {
    render(<Thumb uri="https://x/y.jpg" size={64} />);
    expect(flat(screen.getByTestId("thumb"))).toMatchObject({ width: 64, height: 64, borderRadius: 8 });
    expect(screen.queryByTestId("thumb-not-set")).toBeNull();
  });

  it("GlyphRow defaults to 56 and takes 72 and 48", () => {
    const { rerender } = render(<GlyphRow testID="g" glyph={<Text>*</Text>} title="Alamat" />);
    expect(flat(screen.getByTestId("g")).minHeight).toBe(56);
    rerender(<GlyphRow testID="g" glyph={<Text>*</Text>} title="Alamat" minHeight={72} />);
    expect(flat(screen.getByTestId("g")).minHeight).toBe(72);
    rerender(<GlyphRow testID="g" glyph={<Text>*</Text>} title="Alamat" minHeight={48} />);
    expect(flat(screen.getByTestId("g")).minHeight).toBe(48);
  });

  it("GlyphRow presses and shows its title and meta", () => {
    const onPress = jest.fn();
    render(<GlyphRow testID="g" glyph={<Text>*</Text>} title="Alamat" meta="Jl. Mawar" onPress={onPress} />);
    fireEvent.press(screen.getByTestId("g"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Jl. Mawar")).toBeTruthy();
  });

  it("the blocks read their sizes from nativeLayout", () => {
    render(
      <LayoutScaleProvider value="v2">
        <MediaRow testID="row" title="x" />
      </LayoutScaleProvider>,
    );
    expect(flat(screen.getByTestId("row")).minHeight).toBe(nativeLayout.row.media);
  });
});
