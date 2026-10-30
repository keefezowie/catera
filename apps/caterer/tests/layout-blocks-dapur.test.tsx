import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import { nativeLayout, nativeThemes } from "@catera/design-tokens";
import {
  CheckRow,
  COMPACT_MEDIA_INSET,
  FigureStrip,
  KeyValueRow,
  LayoutScaleProvider,
  MediaRow,
  SectionHeader,
  StopRow,
  Text,
  ThemeProvider,
  Thumb,
  TwoLineRow,
  fontFor,
} from "@catera/mobile-ui";
import { IconAction, TextAction } from "../src/today/rows";
import { withDapurScale } from "./dapur-scale";

/** The phone the block is drawn on; a test sets it. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
beforeEach(() => {
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
});
const phone = (width: number, fontScale: number) => {
  mockWindow = { width, height: 760, scale: 3, fontScale };
};

const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) ?? {};

describe("MediaRow compact (Menu dish rows)", () => {
  it("is 64 tall with a 48 r8 thumb, a rowTitle title and one meta line", () => {
    render(withDapurScale(<MediaRow size="compact" testID="dish" image="https://x/y.jpg" title="Ayam panggang" meta="Lauk" />));
    expect(flat(screen.getByTestId("dish")).minHeight).toBe(64);
    expect(flat(screen.getByTestId("dish-thumb"))).toMatchObject({ width: 48, height: 48, borderRadius: 8 });
    const title = screen.getByText("Ayam panggang");
    expect(flat(title)).toMatchObject({ fontSize: 17, lineHeight: 22 });
    expect(title.props.numberOfLines).toBe(1);
    expect(screen.getByText("Lauk").props.numberOfLines).toBe(1);
  });

  it("takes a bodyStrong title, and its not-set thumb is 48 too", () => {
    render(withDapurScale(<MediaRow size="compact" testID="dish" notSet titleVariant="bodyStrong" title="Belum ada foto" />));
    expect(flat(screen.getByText("Belum ada foto"))).toMatchObject({ fontSize: 15, lineHeight: 22 });
    expect(flat(screen.getByTestId("dish-thumb-not-set"))).toMatchObject({ width: 48, height: 48 });
    expect(flat(screen.getByTestId("dish")).minHeight).toBe(64);
  });

  it("the default size is unchanged: 72 with a 56 thumb", () => {
    render(<MediaRow testID="row" title="Nasi ayam" />);
    expect(flat(screen.getByTestId("row")).minHeight).toBe(72);
    expect(flat(screen.getByTestId("row-thumb"))).toMatchObject({ width: 56, height: 56 });
  });

  it("Thumb takes 48, and the compact separator inset is the 48 thumb plus the 12 gap", () => {
    render(<Thumb size={48} testID="t" />);
    expect(flat(screen.getByTestId("t"))).toMatchObject({ width: 48, height: 48, borderRadius: 8 });
    expect(COMPACT_MEDIA_INSET).toBe(nativeLayout.thumb.compact + nativeLayout.space.md);
  });
});

describe("TwoLineRow", () => {
  it("is 64 tall with a 12 gap, a one-line rowTitle and a one-line meta, named by both", () => {
    const onPress = jest.fn();
    render(withDapurScale(<TwoLineRow testID="row" title="Bu Sari" meta="Jl. Melati 3" onPress={onPress} />));
    const row = screen.getByTestId("row");
    expect(flat(row)).toMatchObject({ minHeight: 64, gap: 12, flexDirection: "row", alignItems: "center" });
    expect(row.props.accessibilityLabel).toBe("Bu Sari, Jl. Melati 3");
    expect(row.props.accessibilityRole).toBe("button");
    const title = screen.getByText("Bu Sari");
    expect(flat(title)).toMatchObject({ fontSize: 17, lineHeight: 22 });
    expect(title.props.numberOfLines).toBe(1);
    const meta = screen.getByText("Jl. Melati 3");
    expect(flat(meta)).toMatchObject({ fontSize: 13, lineHeight: 18 });
    expect(meta.props.numberOfLines).toBe(1);
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("leaves no empty part in its label when the meta is empty", () => {
    render(withDapurScale(<TwoLineRow testID="row" title="Bu Sari" meta="" onPress={() => {}} />));
    expect(screen.getByTestId("row").props.accessibilityLabel).toBe("Bu Sari");
    expect(screen.queryByText("")).toBeNull();
  });

  it("holds its trailing node in a fixed column the width of its children, and takes a leading node", () => {
    render(
      withDapurScale(
        <TwoLineRow
          testID="row"
          leading={<Text testID="badge">1</Text>}
          title="Bu Sari"
          meta="Jl. Melati 3"
          trailing={<Text testID="chat">c</Text>}
        />,
      ),
    );
    const column = flat(screen.getByTestId("row-trailing"));
    expect(column).toMatchObject({ flexShrink: 0, flexGrow: 0 });
    expect(column.width).toBeUndefined();
    expect(screen.getByTestId("badge")).toBeTruthy();
    expect(screen.getByTestId("chat")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("takes an accessibilityLabel over its texts", () => {
    render(<TwoLineRow testID="row" title="Bu Sari" meta="Paket" accessibilityLabel="Bu Sari, sisa 3 hari" onPress={() => {}} />);
    expect(screen.getByTestId("row").props.accessibilityLabel).toBe("Bu Sari, sisa 3 hari");
  });
});

describe("KeyValueRow", () => {
  it("is 40 tall: a muted bodyL label that wraps, a bodyStrong tabular value on the right that never truncates", () => {
    phone(360, 1.3);
    render(withDapurScale(<KeyValueRow testID="kv" label="Dibayarkan ke rekening minggu ini" value="Rp 12.345.000" />));
    expect(flat(screen.getByTestId("kv"))).toMatchObject({ minHeight: 40, flexDirection: "row" });
    const label = screen.getByText("Dibayarkan ke rekening minggu ini");
    expect(flat(label)).toMatchObject({ fontSize: 15, lineHeight: 22, flex: 1 });
    expect(label.props.numberOfLines).toBeUndefined();
    const value = screen.getByText("Rp 12.345.000");
    expect(flat(value)).toMatchObject({ fontSize: 15, lineHeight: 22, flexShrink: 0, textAlign: "right", fontVariant: ["tabular-nums"] });
    expect(flat(value).fontFamily).toBe(fontFor("600"));
    expect(value.props.numberOfLines).toBeUndefined();
    expect(value.props.adjustsFontSizeToFit).toBeUndefined();
  });

  it("reads as one line: label then value", () => {
    render(<KeyValueRow testID="kv" label="Sisa" value="3 hari" />);
    expect(screen.getByTestId("kv").props.accessibilityLabel).toBe("Sisa, 3 hari");
  });
});

describe("FigureStrip", () => {
  const cells = [
    { label: "porsi", value: "1240" },
    { label: "paket", value: "3" },
    { label: "alamat", value: "14" },
  ];

  it("is one surface card, radius 16, padding 12 16, three equal cells split by two hairlines", () => {
    render(withDapurScale(<FigureStrip testID="fs" lead cells={cells} subline="Antar 10.30" />));
    expect(flat(screen.getByTestId("fs"))).toMatchObject({ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 });
    expect(screen.getAllByTestId("fs-hairline")).toHaveLength(2);
    for (const hairline of screen.getAllByTestId("fs-hairline")) expect(flat(hairline).width).toBe(1);
    const cellStyles = [0, 1, 2].map((i) => flat(screen.getByTestId(`fs-cell-${i}`)));
    for (const s of cellStyles) expect(s).toMatchObject({ flexGrow: 1, flexBasis: 0 });
    expect(screen.queryByTestId("fs-grid")).toBeNull();
    expect(flat(screen.getByText("Antar 10.30"))).toMatchObject({ fontSize: 13 });
  });

  it("each cell is a meta label over its value; the lead value is figure, the others section at 800, tabular", () => {
    render(withDapurScale(<FigureStrip testID="fs" lead cells={cells} />));
    expect(flat(screen.getByText("porsi"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    const lead = screen.getByText("1240");
    expect(flat(lead)).toMatchObject({ fontSize: 32, lineHeight: 40, fontVariant: ["tabular-nums"] });
    expect(flat(lead).fontFamily).toBe(fontFor("800"));
    for (const v of ["3", "14"]) {
      const sibling = screen.getByText(v);
      expect(flat(sibling)).toMatchObject({ fontSize: 20, lineHeight: 26, fontVariant: ["tabular-nums"] });
      expect(flat(sibling).fontFamily).toBe(fontFor("800"));
      expect(sibling.props.accessibilityRole).not.toBe("header");
    }
    expect(screen.getByTestId("fs-cell-0").props.accessibilityLabel).toBe("1240 porsi");
  });

  it("without lead every value is section at 800", () => {
    render(<FigureStrip testID="fs" cells={cells} />);
    expect(flat(screen.getByText("1240"))).toMatchObject({ fontSize: 20 });
  });

  it("below 340 effective width (360dp at font scale 1.3 is 277) it is a 2-column grid with the lead across both", () => {
    phone(360, 1.3);
    render(withDapurScale(<FigureStrip testID="fs" lead cells={cells} />));
    expect(screen.getByTestId("fs-grid")).toBeTruthy();
    const lead = flat(screen.getByTestId("fs-cell-0"));
    expect(lead.width).toBe("100%");
    for (const i of [1, 2]) expect(flat(screen.getByTestId(`fs-cell-${i}`))).toMatchObject({ flexGrow: 1, flexBasis: 0 });
    // One hairline under the lead, one between the two cells beside each other.
    const hairlines = screen.getAllByTestId("fs-hairline").map(flat);
    expect(hairlines).toHaveLength(2);
    expect(hairlines.filter((h) => h.height === 1)).toHaveLength(1);
    expect(hairlines.filter((h) => h.width === 1)).toHaveLength(1);
  });

  it("at 412dp and font scale 1 it stays one row", () => {
    phone(412, 1);
    render(<FigureStrip testID="fs" lead cells={cells} />);
    expect(screen.queryByTestId("fs-grid")).toBeNull();
  });
});

describe("SectionHeader count and node action", () => {
  it("shows a meta count beside the title", () => {
    render(withDapurScale(<SectionHeader title="Daftar masak" count="9 menu" />));
    expect(screen.getByText("Daftar masak").props.accessibilityRole).toBe("header");
    const count = screen.getByText("9 menu");
    expect(flat(count)).toMatchObject({ fontSize: 13, lineHeight: 18, flexShrink: 0 });
    expect(flat(count).fontVariant).toEqual(["tabular-nums"]);
  });

  it("takes a node in its trailing slot, which overhangs the 26 heading line so a 48 button does not grow it", () => {
    render(
      withDapurScale(
        <SectionHeader
          title="Urutan antar"
          count="14 alamat"
          action={
            <Text testID="pilih" accessibilityRole="button" accessibilityLabel="Pilih">
              Pilih
            </Text>
          }
        />,
      ),
    );
    expect(screen.getByTestId("pilih")).toBeTruthy();
    expect(screen.getByText("14 alamat")).toBeTruthy();
    expect(flat(screen.getByTestId("section-header-trailing"))).toMatchObject({ flexShrink: 0 });
    expect(flat(screen.getByTestId("section-header-trailing")).marginVertical).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Pilih" })).toBeTruthy();
  });

  it("holds a 48 node action inside the row: the row is at least 48 tall, the title centred, the 12 under it kept", () => {
    render(withDapurScale(<SectionHeader title="Daftar masak" action={<Text accessibilityRole="button">Bagikan</Text>} />));
    expect(flat(screen.getByTestId("section-header"))).toMatchObject({ minHeight: 48, alignItems: "center", marginBottom: 12 });
  });

  it("keeps a header with no action, or a link, one heading line", () => {
    render(withDapurScale(<SectionHeader title="Paket" />));
    render(<SectionHeader title="Minggu ini" action={{ label: "Lihat semua", onPress: jest.fn() }} />);
    for (const header of screen.getAllByTestId("section-header")) expect(flat(header).minHeight).toBeUndefined();
  });

  it("still takes the link action", () => {
    const onPress = jest.fn();
    render(<SectionHeader title="Paket" action={{ label: "+ Paket baru", onPress }} />);
    fireEvent.press(screen.getByRole("button", { name: "+ Paket baru" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("FigureStrip in dark", () => {
  afterEach(() => jest.restoreAllMocks());
  const strip = (scheme: "light" | "dark") => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    render(
      withDapurScale(
        <ThemeProvider storageKey="strip.theme">
          <FigureStrip testID="fs" lead cells={[{ label: "porsi", value: "34" }, { label: "paket", value: "2" }]} />
        </ThemeProvider>,
      ),
    );
    return flat(screen.getByTestId("fs"));
  };

  it("draws a 1px line edge where the palette draws no card border, its pixel taken off the padding", () => {
    expect(strip("dark")).toMatchObject({
      backgroundColor: nativeThemes.dark.surface,
      borderWidth: 1,
      borderColor: nativeThemes.dark.line,
      paddingVertical: 11,
      paddingHorizontal: 15,
    });
  });

  it("keeps light as it was: a zero edge, padding 12 16", () => {
    const light = strip("light");
    expect(light.borderWidth).toBe(0);
    expect(light).toMatchObject({ paddingVertical: 12, paddingHorizontal: 16 });
  });
});

describe("CheckRow and StopRow take the Dapur geometry from the 48 touch target, not from the scale name", () => {
  const checkRow = () => <CheckRow testID="cr" quantity={8} name="Ayam bakar" icon="sunny-outline" checked={false} onToggle={() => {}} image="https://x/y.jpg" />;
  const stopRow = () => <StopRow testID="sr" n={1} name="Bu Rina" detail="8 porsi" address="Jl. Melati 1" onMap={() => {}} mapLabel="Peta" onMore={() => {}} moreLabel="Lainnya" />;
  const under = (value: "classic" | "v2", target: number | undefined, ui: ReactElement) =>
    render(
      <LayoutScaleProvider value={value} target={target}>
        {ui}
      </LayoutScaleProvider>,
    );

  it("a v2 scale at the default 44 target keeps today's rows (a customer caller under v2)", () => {
    under("v2", undefined, checkRow());
    expect(screen.queryByTestId("cr-quantity")).toBeNull();
    expect(flat(screen.getByTestId("cr-image"))).toMatchObject({ width: 44, height: 44 });
    screen.unmount();
    under("v2", 44, stopRow());
    expect(screen.queryByTestId("sr-actions")).toBeNull();
    expect(flat(screen.getByTestId("sr")).minHeight).toBe(56);
  });

  it("StopRow's portions figure is tabular", () => {
    under("v2", 48, <StopRow testID="sr" n={1} name="Bu Rina" portions="8 porsi" address="Jl. Melati 1" onMap={() => {}} mapLabel="Peta" onMore={() => {}} moreLabel="Lainnya" />);
    expect(flat(screen.getByText(" · 8 porsi")).fontVariant).toEqual(["tabular-nums"]);
  });

  it("a 48 target draws the Dapur rows", () => {
    under("v2", 48, checkRow());
    expect(screen.getByTestId("cr-quantity")).toBeTruthy();
    expect(flat(screen.getByTestId("cr-image"))).toMatchObject({ width: 40, height: 40, borderRadius: 8 });
    screen.unmount();
    under("v2", 48, stopRow());
    expect(screen.getByTestId("sr-actions")).toBeTruthy();
    expect(flat(screen.getByTestId("sr")).minHeight).toBe(64);
  });

  it("without a provider both rows are the classic ones", () => {
    render(checkRow());
    expect(screen.queryByTestId("cr-quantity")).toBeNull();
    screen.unmount();
    render(stopRow());
    expect(screen.queryByTestId("sr-actions")).toBeNull();
  });
});

describe("header actions stay inside their parents", () => {
  it("TextAction is at least 48 x 48 and flush drops the padding on the edge side instead of pulling the target past it", () => {
    render(
      <>
        <TextAction label="Selesai" flush="end" onPress={jest.fn()} />
        <TextAction label="Isi menu" flush="start" onPress={jest.fn()} />
        <TextAction label="Plain" onPress={jest.fn()} />
      </>,
    );
    const end = flat(screen.getByRole("button", { name: "Selesai" }));
    const start = flat(screen.getByRole("button", { name: "Isi menu" }));
    const plain = flat(screen.getByRole("button", { name: "Plain" }));
    expect(end).toMatchObject({ minHeight: 48, minWidth: 48, paddingLeft: 12, paddingRight: 0, alignItems: "flex-end" });
    expect(start).toMatchObject({ minHeight: 48, minWidth: 48, paddingLeft: 0, paddingRight: 12, alignItems: "flex-start" });
    expect(plain).toMatchObject({ minHeight: 48, minWidth: 48, paddingLeft: 12, paddingRight: 12, alignItems: "center" });
    for (const style of [end, start, plain]) {
      expect(style.marginRight).toBeUndefined();
      expect(style.marginLeft).toBeUndefined();
    }
  });

  it("IconAction is 48 x 48 and flush holds the glyph against the end without a margin", () => {
    render(
      <>
        <IconAction icon="print-outline" label="Cetak" flush onPress={jest.fn()} />
        <IconAction icon="share-outline" label="Bagikan" onPress={jest.fn()} />
      </>,
    );
    expect(flat(screen.getByRole("button", { name: "Cetak" }))).toMatchObject({ width: 48, height: 48, alignItems: "flex-end", paddingRight: 1 });
    expect(flat(screen.getByRole("button", { name: "Cetak" })).marginRight).toBeUndefined();
    expect(flat(screen.getByRole("button", { name: "Bagikan" }))).toMatchObject({ width: 48, height: 48, alignItems: "center", paddingRight: 0 });
  });
});
