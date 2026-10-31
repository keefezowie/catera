import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { POLISH_ART, PolishArt, type PolishArtName } from "@catera/mobile-ui";

const runtime = require("../../../packages/brand/assets/polish/runtime/manifest.json") as {
  files: { name: string; file: string; derivedFrom: string }[];
};
const polish = require("../../../packages/brand/assets/polish/manifest.json") as {
  assets: { file: string; usedByApp: boolean }[];
};

const hidden = { includeHiddenElements: true };
const image = () => screen.getByTestId("polish-art", hidden);

describe("POLISH_ART registry", () => {
  it("covers exactly the polish assets the apps use, and nothing superseded", () => {
    const used = polish.assets.filter((a) => a.usedByApp).map((a) => a.file.split("/").pop()!.replace(/\.png$/, ""));
    expect(Object.keys(POLISH_ART).sort()).toEqual(used.sort());
    expect(Object.keys(POLISH_ART).sort()).toEqual(runtime.files.map((f) => f.name).sort());
    expect(POLISH_ART).not.toHaveProperty("dapur-rak-kosong");
    expect(POLISH_ART).toHaveProperty("dapur-kosong");
  });

  it("every entry resolves to its runtime derivative, never an original", () => {
    for (const [name, source] of Object.entries(POLISH_ART)) {
      expect(source).toBeTruthy();
      const record = runtime.files.find((f) => f.name === name)!;
      expect(JSON.stringify(source)).toContain(record.file.replace("runtime/", ""));
      expect(JSON.stringify(source)).toContain("runtime");
      expect(record.file).toMatch(name === "welcome-meja" ? /\.jpg$/ : /\.webp$/);
    }
  });
});

describe("PolishArt", () => {
  it("draws contained at a square size and is hidden from screen readers by default", () => {
    render(<PolishArt name="spot-rantang" size={48} />);
    const node = image();
    expect(node.props.source).toBe(POLISH_ART["spot-rantang"]);
    expect(node.props.contentFit).toBe("contain");
    expect(StyleSheet.flatten(node.props.style)).toMatchObject({ width: 48, height: 48 });
    expect(node.props.accessible).toBe(false);
    expect(node.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(node.props.accessibilityLabel).toBeUndefined();
  });

  it("covers for welcome-meja, and width/height win over size", () => {
    render(<PolishArt name="welcome-meja" width={430} height={640} style={{ opacity: 0.5 }} />);
    const node = image();
    expect(node.props.contentFit).toBe("cover");
    expect(StyleSheet.flatten(node.props.style)).toMatchObject({ width: 430, height: 640, opacity: 0.5 });
  });

  it("accepts an explicit fit", () => {
    render(<PolishArt name="plate-ayam" size={120} contentFit="cover" />);
    expect(image().props.contentFit).toBe("cover");
  });

  it("is announced as an image when given a label", () => {
    render(<PolishArt name="dapur-kosong" size={120} accessibilityLabel="Belum ada pesanan" />);
    const node = screen.getByLabelText("Belum ada pesanan");
    expect(node.props.accessible).toBe(true);
    expect(node.props.accessibilityRole).toBe("image");
    expect(node.props.importantForAccessibility).toBe("yes");
  });

  it("types names", () => {
    const name: PolishArtName = "plate-tanpa-santan";
    // @ts-expect-error superseded art is not a name
    const gone: PolishArtName = "dapur-rak-kosong";
    expect([name, gone]).toHaveLength(2);
  });
});
