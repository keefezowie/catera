import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { MobileProvider, createMobileRuntime, type MobileRuntime } from "@catera/mobile-core";
import { catererSlug, e164Indonesia } from "../src/onboarding";
import { tabsForRole } from "../src/roles";
import { Daftar } from "../src/auth/Daftar";
import { RoleGate } from "../src/RoleGate";
import { router } from "expo-router";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

function runtimeWith(actor: unknown): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    command: jest.fn(async () => ({ id: "k-new" })),
  } as MobileRuntime["api"];
  runtime.sendPhoneOtp = jest.fn(async () => undefined);
  runtime.verifyPhoneOtp = jest.fn(async () => ({ id: "u-1", role: "customer" }) as never);
  return runtime;
}

describe("onboarding helpers", () => {
  it("normalises Indonesian WhatsApp numbers to E.164", () => {
    expect(e164Indonesia("0812 3456 7890")).toBe("+6281234567890");
    expect(e164Indonesia("+62 812-3456-7890")).toBe("+6281234567890");
    expect(e164Indonesia("62812 3456 7890")).toBe("+6281234567890");
  });
  it("builds a URL-safe caterer slug with a short suffix", () => {
    expect(catererSlug("Dapur Bu Rina!", "ab12")).toBe("dapur-bu-rina-ab12");
  });
});

describe("roles", () => {
  it("gives owners four tabs and helpers two", () => {
    expect(tabsForRole("owner")).toEqual(["index", "pelanggan", "menu", "usaha"]);
    expect(tabsForRole("staff")).toEqual(["index", "menu"]);
    expect(tabsForRole("customer")).toEqual([]);
  });

  it("sends customer accounts to the Catera app", async () => {
    render(
      <MobileProvider runtime={runtimeWith({ id: "u-c", role: "customer" })} linkMapper={(h) => h}>
        <RoleGate>{null}</RoleGate>
      </MobileProvider>,
    );
    expect(await screen.findByText("Buka aplikasi Catera")).toBeTruthy();
  });
});

describe("Daftar", () => {
  it("verifies the WhatsApp number and creates the caterer with name and area", async () => {
    const runtime = runtimeWith(null);
    render(
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <Daftar />
      </MobileProvider>,
    );
    fireEvent.changeText(await screen.findByLabelText("Nama usaha katering"), "Dapur Bu Rina");
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812 3456 7890");
    fireEvent.press(screen.getByText("Jakarta Selatan"));
    fireEvent.press(screen.getByText("Kirim kode"));
    await waitFor(() => expect(runtime.sendPhoneOtp).toHaveBeenCalledWith("+6281234567890"));
    fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "123456");
    fireEvent.press(screen.getByText("Buat dapur saya"));
    await waitFor(() =>
      expect(runtime.verifyPhoneOtp).toHaveBeenCalledWith(
        "+6281234567890",
        "123456",
        "Dapur Bu Rina",
        expect.any(String),
      ),
    );
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "seller.create",
        expect.objectContaining({
          name: "Dapur Bu Rina",
          areas: ["Jakarta Selatan"],
          description: "",
          slug: expect.stringMatching(/^dapur-bu-rina-[a-z0-9]{4}$/),
        }),
        expect.any(String),
      ),
    );
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
