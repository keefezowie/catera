import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { cardEdge } from "@catera/mobile-ui";
import { PackageEditor } from "../src/business/PackageEditor";
import { PhotoThumb } from "../src/layout/PhotoThumb";
import * as uploadModule from "../src/business/upload";
import { withDapurScale } from "./dapur-scale";
import { lastGuard, resetSheets, unsavedGuard } from "./sheet-host";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
// The empty form is not a publishable one; these tests are about the screen around the save, not the rules.
jest.mock("../src/business/package", () => ({
  ...jest.requireActual("../src/business/package"),
  packageIssues: () => ({}),
  nutritionIssues: () => ({}),
}));

const picker = require("expo-image-picker") as { launchImageLibraryAsync: jest.Mock };

function runtimeWith(command?: jest.Mock): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    ...(command ? { command } : {}),
  } as MobileRuntime["api"];
  return runtime;
}

const mount = (runtime: MobileRuntime, props: { firstPublish?: boolean | null } = {}) =>
  render(
    withDapurScale(
      <MobileProvider runtime={runtime} linkMapper={() => "/"}>
        <PackageEditor {...props} />
      </MobileProvider>,
    ),
  );

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

beforeEach(() => {
  resetSheets();
  unsavedGuard.mockClear();
  picker.launchImageLibraryAsync.mockReset();
  jest.restoreAllMocks();
});

describe("PackageEditor unsaved guard", () => {
  it("is quiet on a fresh editor, holds once a field changed, and lets go when the field is put back", async () => {
    mount(runtimeWith());
    await screen.findByRole("button", { name: "Terbitkan paket" });
    expect(lastGuard()).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Nama paket"), "Makan Malam");
    expect(lastGuard()).toMatchObject({ noun: "paket", voice: "kamu" });
    fireEvent.changeText(screen.getByLabelText("Nama paket"), "");
    expect(lastGuard()).toBeNull();
  });

  it("is off after a successful save", async () => {
    const command = jest.fn(async () => ({ id: "p-1" }));
    mount(runtimeWith(command), { firstPublish: true });
    fireEvent.changeText(await screen.findByLabelText("Nama paket"), "Makan Malam");
    expect(lastGuard()).not.toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Terbitkan paket" }));
    await screen.findByText("Selesai");
    expect(lastGuard()).toBeNull();
  });
});

describe("PackageEditor errors sit by what failed", () => {
  it("shows a failed save in the footer with the publish button, not under the form", async () => {
    const command = jest.fn(async () => {
      throw new Error("NETWORK");
    });
    mount(runtimeWith(command));
    fireEvent.press(await screen.findByRole("button", { name: "Terbitkan paket" }));
    const error = await screen.findByTestId("form-error-save");
    const sections = screen.getByTestId("paket-sections");
    const button = screen.getByRole("button", { name: "Terbitkan paket" });
    // The nearest ancestor that holds both the error and the button must not hold the form: it is the footer.
    let node = error.parent;
    while (node && node.findAll((n) => n === button).length === 0) node = node.parent;
    expect(node).toBeTruthy();
    expect(node!.findAll((n) => n === sections)).toHaveLength(0);
  });

  it("shows a failed upload under the photo tile", async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///x.jpg" }] });
    jest.spyOn(uploadModule, "uploadPhoto").mockRejectedValue(new Error("NETWORK"));
    mount(runtimeWith());
    const tile = await screen.findByRole("button", { name: "Pilih foto paket" });
    fireEvent.press(tile);
    const error = await screen.findByTestId("form-error-upload");
    // The nearest ancestor holding both is the photo section, not the form.
    let node = error.parent;
    while (node && node.findAll((n) => n === tile).length === 0) node = node.parent;
    expect(node!.findAll((n) => n === screen.getByTestId("paket-sections"))).toHaveLength(0);
    expect(node!.findAll((n) => n.props?.testID === "paket-counts")).toHaveLength(0);
    expect(screen.queryByTestId("form-error-save")).toBeNull();
  });

  it("catches a picker that throws and says so in Indonesian", async () => {
    picker.launchImageLibraryAsync.mockRejectedValue(new Error("no permission"));
    mount(runtimeWith());
    fireEvent.press(await screen.findByRole("button", { name: "Pilih foto paket" }));
    expect(await screen.findByText("Foto belum bisa dipilih. Coba lagi.")).toBeTruthy();
  });
});

describe("PackageEditor photo tile", () => {
  it("is busy and disabled while uploading, says Mengunggah over an existing photo, and is named Ganti foto paket", async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///x.jpg" }] });
    const upload = jest.spyOn(uploadModule, "uploadPhoto").mockResolvedValueOnce("https://cdn.example.test/one.jpg");
    mount(runtimeWith());
    fireEvent.press(await screen.findByRole("button", { name: "Pilih foto paket" }));
    await screen.findByTestId("paket-photo-image");
    expect(screen.queryByRole("button", { name: "Pilih foto paket" })).toBeNull();

    let finish: (url: string) => void = () => undefined;
    upload.mockImplementationOnce(() => new Promise<string>((resolve) => (finish = resolve)));
    fireEvent.press(screen.getByRole("button", { name: "Ganti foto paket" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ganti foto paket" }).props.accessibilityState).toMatchObject({ busy: true, disabled: true }),
    );
    expect(screen.getByText("Mengunggah…")).toBeTruthy();
    expect(screen.getByTestId("paket-photo-image")).toBeTruthy();
    // A second tap while it uploads opens nothing.
    fireEvent.press(screen.getByRole("button", { name: "Ganti foto paket" }));
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(2);
    await act(async () => finish("https://cdn.example.test/two.jpg"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ganti foto paket" }).props.accessibilityState).toMatchObject({ busy: false }),
    );
  });

  it("draws the empty tile with the card edge", async () => {
    mount(runtimeWith());
    const tile = await screen.findByTestId("paket-photo-empty");
    const edge = cardEdge(nativeThemes.light);
    expect(flat(tile)).toMatchObject({ borderWidth: edge.borderWidth, borderColor: edge.borderColor });
  });
});

describe("PhotoThumb", () => {
  it("rounds its image with a continuous curve and fades in on the selection beat", () => {
    render(withDapurScale(<PhotoThumb uri="https://cdn.example.test/a.jpg" />));
    const image = screen.UNSAFE_getByType(ExpoImage);
    expect(flat(image)).toMatchObject({ borderCurve: "continuous" });
    expect(image.props.transition).toBe(340);
  });
});
