import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { Masuk } from "../src/auth/Masuk";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

let runtime: MobileRuntime;
beforeEach(() => {
  jest.clearAllMocks();
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "dapur-masuk-layout" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: false })) } as unknown as MobileRuntime["api"];
});
const renderMasuk = () =>
  render(
    <MoodProvider now={() => new Date("2026-10-08T08:00:00Z")}>
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <Masuk />
      </MobileProvider>
    </MoodProvider>,
  );

type Json = { props?: Record<string, unknown>; children?: (Json | string)[] | null } | string;
function order(): string[] {
  const out: string[] = [];
  const walk = (n: Json) => {
    if (typeof n === "string") return;
    const p = n.props ?? {};
    const label = p.accessibilityLabel as string | undefined;
    if (p.testID === "form-error") out.push("error");
    else if (p.accessibilityRole === "button" && label) out.push(`button:${label}`);
    else if (p.placeholderTextColor !== undefined && label) out.push(`field:${label}`);
    (n.children ?? []).forEach(walk);
  };
  const tree = screen.toJSON() as Json | Json[];
  (Array.isArray(tree) ? tree : [tree]).forEach(walk);
  return out;
}

describe("Dapur Masuk, the OKX layout", () => {
  it("shows the failure under the fields and above Masuk, with the sign-up line last", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderMasuk();
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.changeText(screen.getByLabelText("Email"), "dapur@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("form-error");
    const page = order();
    expect(page.indexOf("error")).toBeGreaterThan(page.indexOf("field:Kata sandi"));
    expect(page.indexOf("error")).toBeLessThan(page.indexOf("button:Masuk"));
    expect(page.indexOf("button:Daftar")).toBeGreaterThan(page.indexOf("button:Masuk"));
    expect(screen.getByLabelText("Email").props.value).toBe("dapur@example.test");
  });

  it("keeps typed values across the method tabs and words each method", async () => {
    renderMasuk();
    expect(await screen.findByText("Kami kirim kode lewat SMS ke nomor WhatsApp kamu.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812 3456 7890");
    fireEvent.press(screen.getByRole("tab", { name: "Email" }));
    expect(screen.getByText("Masuk dengan email dan kata sandi kamu.")).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "Nomor HP" }));
    expect(screen.getByLabelText("Nomor WhatsApp").props.value).toBe("0812 3456 7890");
    fireEvent.press(screen.getByRole("button", { name: "Daftar" }));
    expect(router.push).toHaveBeenCalledWith("/daftar");
  });
});

describe("Dapur Masuk heading and labels", () => {
  it("has one heading, Masuk, with the Catera Dapur wordmark where the mascot sits elsewhere", async () => {
    renderMasuk();
    expect(await screen.findByText("Catera Dapur")).toBeTruthy();
    expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual(["Masuk"]);
    expect(screen.queryByTestId("masuk-header")).toBeNull();
    expect(screen.queryByTestId("mascot-melambai", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lupa kata sandi?" })).toBeNull();
  });

  it("names the phone tab Nomor HP and keeps the field Nomor WhatsApp", async () => {
    renderMasuk();
    expect(await screen.findByRole("tab", { name: "Nomor HP" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "WhatsApp" })).toBeNull();
    expect(screen.getByLabelText("Nomor WhatsApp")).toBeTruthy();
  });

  it("toggles the password with its visible word in the spoken name, and outlines both fields on a failure", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderMasuk();
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.press(screen.getByRole("button", { name: "Tampilkan kata sandi" }));
    expect(screen.getByText("Sembunyikan")).toBeTruthy();
    const edge = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style).borderColor;
    const [e0, p0] = [edge("Email"), edge("Kata sandi")];
    fireEvent.changeText(screen.getByLabelText("Email"), "dapur@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("form-error");
    expect(edge("Email")).not.toBe(e0);
    expect(edge("Kata sandi")).not.toBe(p0);
  });
});
