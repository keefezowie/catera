import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { SettlementState } from "@catera/domain";
import { quickOffer, packageIssues, type PackageForm } from "../src/business/package";
import { PackageEditor } from "../src/business/PackageEditor";
import { UangScreen } from "../src/business/UangScreen";
import { TimScreen } from "../src/business/TimScreen";
import { RoleGate } from "../src/RoleGate";
import { Text } from "react-native";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn(), MediaTypeOptions: { Images: "Images" } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const form: PackageForm = {
  name: "Makan Siang Rumahan",
  description: "Masakan rumahan harian, nasi dengan dua lauk dan sayur.",
  price: "28000",
  meal: "lunch",
  weekdays: [1, 2, 3, 4, 5],
  capacity: "40",
  image: "https://cdn.example.test/k-1/a.jpg",
  counts: { rice: 1, main: 2, vegetable: 1 },
};

function runtimeWith(overrides: Partial<MobileRuntime["api"]>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    ...overrides,
  } as MobileRuntime["api"];
  return runtime;
}

describe("quickOffer", () => {
  it("uses one duration, no tiers, no trial and a flexible schedule", () => {
    const offer = quickOffer(form);
    expect(offer.trialPrice).toBeNull();
    expect(offer.trialMax).toBeNull();
    expect(offer.tiers).toEqual([]);
    expect(offer.durationPricing.options).toEqual([{ cycles: 1, discountPercent: 0 }]);
    expect(offer.flexible).toBe(true);
    expect(offer.capacity).toEqual({ "1": 40, "2": 40, "3": 40, "4": 40, "5": 40 });
    expect(offer.menus[0].composition.map((g) => [g.categoryId, g.slots])).toEqual([
      ["rice", 1],
      ["main", 2],
      ["vegetable", 1],
    ]);
  });
});

it("asks for daily capacity before saving", async () => {
  const command = jest.fn();
  const runtime = runtimeWith({ command });
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <PackageEditor />
    </MobileProvider>,
  );
  expect(packageIssues({ ...form, capacity: "" }).capacity).toBe("Isi kapasitas per hari");
  fireEvent.press(await screen.findByRole("button", { name: "Simpan paket" }));
  expect(await screen.findByText("Isi kapasitas per hari")).toBeTruthy();
  expect(command).not.toHaveBeenCalled();
});

const settlement: SettlementState = {
  payoutReadiness: "ready",
  expected: "840000",
  earned: "560000",
  held: "28000",
  reserved: "0",
  paid: "1120000",
  available: "532000",
  recovery: "0",
  nextPayoutAt: "2026-10-09T09:00:00+07:00",
  entries: [],
  payouts: [],
  policy: null,
};

it("explains all seven money states", async () => {
  const runtime = runtimeWith({ settlement: jest.fn(async () => settlement) });
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <UangScreen />
    </MobileProvider>,
  );
  await waitFor(() => expect(screen.getByText("Akan diterima")).toBeTruthy());
  for (const label of [
    "Akan diterima",
    "Sudah diperoleh",
    "Ditahan sementara",
    "Siap dicairkan",
    "Sedang dikirim",
    "Sudah dicairkan",
    "Potongan",
  ])
    expect(screen.getByText(label)).toBeTruthy();
});

it("shares a helper invite code over WhatsApp", async () => {
  const { Share } = jest.requireActual("react-native") as typeof import("react-native");
  const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  const command = jest.fn(async () => ({ id: "i-1", code: "abc123" }));
  render(
    <MobileProvider runtime={runtimeWith({ command })} linkMapper={() => "/"}>
      <TimScreen />
    </MobileProvider>,
  );
  fireEvent.press(await screen.findByRole("button", { name: "Undang pembantu" }));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(command.mock.calls[0]).toEqual(["staff.invite", { catererId: "k-1" }, expect.any(String)]);
  expect((share.mock.calls[0][0] as { message: string }).message).toContain("abc123");
});

it("lets a helper join a kitchen with the invite code", async () => {
  const me = jest
    .fn()
    .mockResolvedValueOnce({ actor: { id: "u-2", role: "customer", catererId: null }, demo: false })
    .mockResolvedValue({ actor: { id: "u-2", role: "staff", catererId: "k-1" }, demo: false });
  const command = jest.fn(async () => ({}));
  render(
    <MobileProvider runtime={runtimeWith({ me, command })} linkMapper={() => "/"}>
      <RoleGate>
        <Text>dapur</Text>
      </RoleGate>
    </MobileProvider>,
  );
  fireEvent.changeText(await screen.findByLabelText("Kode undangan"), " abc123 ");
  fireEvent.press(screen.getByRole("button", { name: "Gabung ke dapur" }));
  expect(await screen.findByText("dapur")).toBeTruthy();
  expect(command.mock.calls[0]).toEqual(["invite.accept", { code: "abc123" }, expect.any(String)]);
});
