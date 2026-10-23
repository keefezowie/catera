import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Text } from "@catera/mobile-ui";
import { nativeLayout, nativeThemes } from "@catera/design-tokens";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  BARE_GLYPH_INSET,
  DecorativeIcon,
  GLYPH_INSET,
  GlyphCircle,
  GlyphRow,
  ListCard,
  MEDIA_INSET,
  MediaRow,
  rowLabel,
  SectionHeader,
  Thumb,
} from "../src/layout";
import { wellFormedLabel } from "./labels";

const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never);

describe("row labels for a screen reader", () => {
  it("rowLabel joins the non-empty parts and leaves no empty one", () => {
    expect(rowLabel("Data akun", undefined)).toBe("Data akun");
    expect(rowLabel("Senin 26 Okt", "", "1 hari lagi")).toBe("Senin 26 Okt, 1 hari lagi");
    expect(rowLabel(" Riwayat ", null, false, "Pembayaran ")).toBe("Riwayat, Pembayaran");
    expect(rowLabel("", " ", undefined)).toBe("");
    for (const label of [rowLabel("a", "b"), rowLabel("a"), rowLabel("x", undefined, "z")]) expect(wellFormedLabel(label)).toBe(true);
    for (const bad of [", Data akun, ", "Senin 26 Okt, , 1 hari lagi", "Senin,", ""]) expect(wellFormedLabel(bad)).toBe(false);
  });

  it("a GlyphRow button is named by its title and meta alone; its glyph is hidden from the reader", () => {
    const view = render(
      <GlyphRow
        testID="row"
        glyph={<Ionicons name="person-outline" size={20} />}
        trailing={<DecorativeIcon name="chevron-forward" size={20} />}
        title="Data akun"
        onPress={() => {}}
      />,
    );
    expect(screen.getByTestId("row").props.accessibilityLabel).toBe("Data akun");
    expect(screen.getByTestId("row-glyph", { includeHiddenElements: true }).props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
    });
    view.rerender(<GlyphRow testID="row" glyph={null} title="Pengaturan" meta="Bahasa, tampilan" onPress={() => {}} />);
    expect(screen.getByTestId("row").props.accessibilityLabel).toBe("Pengaturan, Bahasa, tampilan");
  });

  it("a MediaRow button is named by its title and meta unless it is given a label; its chevron and placeholder glyph are hidden", () => {
    const view = render(<MediaRow testID="row" title="Makan Siang Rumahan" meta="" notSet trailing="chevron" onPress={() => {}} />);
    const label = screen.getByTestId("row").props.accessibilityLabel as string;
    expect(label).toBe("Makan Siang Rumahan");
    expect(wellFormedLabel(label)).toBe(true);
    expect(screen.queryByTestId("row-chevron")).toBeNull();
    for (const id of ["row-thumb-not-set"]) {
      const glyph = screen.getByTestId(id).findByProps({ accessibilityElementsHidden: true });
      expect(glyph.props.importantForAccessibility).toBe("no");
    }
    view.rerender(<MediaRow testID="row" title="Kamis" meta="Siang 11.00" accessibilityLabel="Kamis 22 Okt, Siang" onPress={() => {}} />);
    expect(screen.getByTestId("row").props.accessibilityLabel).toBe("Kamis 22 Okt, Siang");
  });

  it("DecorativeIcon is hidden on both platforms", () => {
    render(<DecorativeIcon name="location-outline" size={20} testID="pin" />);
    expect(screen.getByTestId("pin", { includeHiddenElements: true }).props).toMatchObject({
      accessible: false,
      importantForAccessibility: "no",
      accessibilityElementsHidden: true,
    });
  });
});

describe("layout blocks", () => {
  it("MediaRow is 72 tall with a 56 thumb and one-line title and meta", () => {
    render(<MediaRow testID="row" image="https://x/y.jpg" title="Nasi ayam" meta="Rp25.000" onPress={() => {}} />);
    expect(flat(screen.getByTestId("row")).minHeight).toBe(72);
    expect(flat(screen.getByTestId("row-thumb"))).toMatchObject({ width: 56, height: 56, borderRadius: 8 });
    expect(screen.getByText("Nasi ayam").props.numberOfLines).toBe(1);
    expect(screen.getByText("Rp25.000").props.numberOfLines).toBe(1);
  });

  it('MediaRow with wrap="title" lets only the title grow: the meta stays one line', () => {
    render(<MediaRow testID="row" title="Besok, Jumat 23 Okt" meta="Nasi putih, ayam panggang" wrap="title" />);
    expect(screen.getByText("Besok, Jumat 23 Okt").props.numberOfLines).toBeUndefined();
    expect(screen.getByText("Nasi putih, ayam panggang").props.numberOfLines).toBe(1);
  });

  it("MediaRow presses, shows a chevron and a custom trailing node", () => {
    const onPress = jest.fn();
    render(<MediaRow testID="row" title="Satu" trailing="chevron" onPress={onPress} />);
    fireEvent.press(screen.getByTestId("row"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("row-chevron")).toBeNull(); // iOS-only; Jest is the Android build
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

  it("a 48 info row draws the bare 20 glyph, the 56 and 72 rows the 40 circle", () => {
    const row = (minHeight: 56 | 72 | 48) => (
      <GlyphRow testID="g" glyph={<Text>*</Text>} title="Alamat" minHeight={minHeight} />
    );
    const { rerender } = render(row(48));
    expect(flat(screen.getByTestId("g-glyph", { includeHiddenElements: true }))).toMatchObject({ width: 20, height: 20 });
    expect(flat(screen.getByTestId("g-glyph", { includeHiddenElements: true })).backgroundColor).toBeUndefined();
    rerender(row(56));
    expect(flat(screen.getByTestId("g-glyph", { includeHiddenElements: true }))).toMatchObject({ width: 40, height: 40, borderRadius: 20 });
    rerender(row(72));
    expect(flat(screen.getByTestId("g-glyph", { includeHiddenElements: true }))).toMatchObject({ width: 40, height: 40 });
  });

  it("GlyphRow takes a tone for its circle (a meal's mood tint) and leaves a bare glyph alone", () => {
    const { rerender } = render(<GlyphRow testID="g" glyph={<Text>*</Text>} title="Makan siang" minHeight={72} tone="#FFF7E9" />);
    expect(flat(screen.getByTestId("g-glyph", { includeHiddenElements: true })).backgroundColor).toBe("#FFF7E9");
    rerender(<GlyphRow testID="g" glyph={<Text>*</Text>} title="Makan siang" minHeight={72} />);
    expect(flat(screen.getByTestId("g-glyph", { includeHiddenElements: true })).backgroundColor).toBe(nativeThemes.light.sage);
    rerender(<GlyphRow testID="g" glyph={<Text>*</Text>} title="Makan siang" minHeight={48} tone="#FFF7E9" />);
    expect(flat(screen.getByTestId("g-glyph", { includeHiddenElements: true })).backgroundColor).toBeUndefined();
  });

  it("GlyphRow keeps its title and meta to one line unless it wraps", () => {
    const { rerender } = render(<GlyphRow testID="g" glyph={<Text>*</Text>} title="Bantuan dan laporan" meta="Pesan" />);
    expect(screen.getByText("Bantuan dan laporan").props.numberOfLines).toBe(1);
    rerender(<GlyphRow testID="g" wrap glyph={<Text>*</Text>} title="Bantuan dan laporan" meta="Pesan" />);
    expect(screen.getByText("Bantuan dan laporan").props.numberOfLines).toBeUndefined();
    expect(screen.getByText("Pesan").props.numberOfLines).toBeUndefined();
  });

  it("GlyphRow bare gives the 20 glyph at any height", () => {
    render(<GlyphRow testID="g" bare glyph={<Text>*</Text>} title="Alamat" />);
    expect(flat(screen.getByTestId("g-glyph", { includeHiddenElements: true }))).toMatchObject({ width: 20, height: 20 });
  });

  it("the ListCard insets follow the thumb, the circle and the bare glyph plus the 12 gap", () => {
    expect(MEDIA_INSET).toBe(nativeLayout.thumb.sm + nativeLayout.space.md);
    expect(GLYPH_INSET).toBe(52);
    expect(BARE_GLYPH_INSET).toBe(32);
    render(
      <ListCard inset={BARE_GLYPH_INSET}>
        <Text>a</Text>
        <Text>b</Text>
      </ListCard>,
    );
    expect(flat(screen.getByTestId("list-card-separator")).marginLeft).toBe(32);
  });

  it("ListCard separates at the media inset by default", () => {
    render(
      <ListCard>
        <Text>a</Text>
        <Text>b</Text>
      </ListCard>,
    );
    expect(flat(screen.getByTestId("list-card-separator")).marginLeft).toBe(MEDIA_INSET);
  });

  it("GlyphCircle is the 40 circle on the glyph tone that a hand-built row leads with", () => {
    render(
      <GlyphCircle testID="circle">
        <Text>g</Text>
      </GlyphCircle>,
    );
    expect(flat(screen.getByTestId("circle"))).toMatchObject({ width: 40, height: 40, borderRadius: 20, backgroundColor: nativeThemes.light.sage });
  });
});
