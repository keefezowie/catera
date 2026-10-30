import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { MobileProvider, createMobileRuntime, type MobileRuntime } from "@catera/mobile-core";
import { catererSlug, e164Indonesia, waLink } from "../src/onboarding";
import { tabsForRole } from "../src/roles";
import { Daftar } from "../src/auth/Daftar";
import { AktifkanScreen } from "../src/business/AktifkanScreen";
import { withDapurScale } from "./dapur-scale";
import { RoleGate } from "../src/RoleGate";
import { router } from "expo-router";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }, Link: () => null, useNavigation: () => ({ setOptions: () => undefined }) }));
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
  return runtime;
}

describe("onboarding helpers", () => {
  it("normalises Indonesian WhatsApp numbers to E.164", () => {
    expect(e164Indonesia("0812 3456 7890")).toBe("+6281234567890");
    expect(e164Indonesia("+62 812-3456-7890")).toBe("+6281234567890");
    expect(e164Indonesia("62812 3456 7890")).toBe("+6281234567890");
    expect(e164Indonesia("0062 812 3456 7890")).toBe("+6281234567890");
    expect(e164Indonesia("+62 0812 3456 7890")).toBe("+6281234567890");
    expect(e164Indonesia("0812 345")).toBeNull();
    expect(e164Indonesia("62 0 812")).toBeNull();
  });
  it("builds a URL-safe caterer slug with a short suffix", () => {
    expect(catererSlug("Dapur Bu Rina!", "ab12")).toBe("dapur-bu-rina-ab12");
  });
  it("links a typed number to its WhatsApp chat, digits only", () => {
    expect(waLink("0812 3456 7890")).toBe("https://wa.me/6281234567890");
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

const flatStyle = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** The nearest node above `node` whose style sets `key`. */
const above = (node: { props: { style?: unknown }; parent: unknown }, key: string) => {
  for (let n = node as { props: { style?: unknown }; parent: typeof node | null } | null; n; n = n.parent) if (flatStyle(n)[key as never] !== undefined) return flatStyle(n);
  return {};
};
/** The first gap set on a node or the nearest ancestor that sets one. */
const gapAbove = (node: { props: { style?: unknown }; parent: unknown }) => {
  for (let n = node as { props: { style?: unknown }; parent: typeof node | null } | null; n; n = n.parent) {
    const gap = flatStyle(n).gap;
    if (gap !== undefined) return gap;
  }
  return undefined;
};

describe("Daftar on the Dapur scale", () => {
  it("sets its intro in the ladder and keeps the area chips' 48 targets apart", async () => {
    render(
      withDapurScale(
        <MobileProvider runtime={runtimeWith(null)} linkMapper={(h) => h}>
          <Daftar />
        </MobileProvider>,
      ),
    );
    const intro = await screen.findByText(/^Nama ini yang dilihat pelanggan/);
    // The intro is the shared auth heading's subtitle, as on Masuk.
    expect(flatStyle(intro)).toMatchObject({ fontSize: 14, lineHeight: 23 });
    // The heading and its paragraph sit 8 apart (the group gap).
    expect(gapAbove(intro)).toBe(8);
    fireEvent.changeText(screen.getByLabelText("Nama usaha katering"), "Dapur Bu Rina");
    fireEvent.press(screen.getByRole("button", { name: "Lanjut" }));
    // A later step's line has the same ladder, without the mascot.
    const line = await screen.findByText(/^Pelanggan di area ini/);
    expect(flatStyle(line)).toMatchObject({ fontSize: 14, lineHeight: 23 });
    expect(gapAbove(line)).toBe(8);
    const chip = screen.getByRole("button", { name: "Jakarta Selatan" });
    // The area chips are drawn 40 tall; 4 of slop above and below reaches the 48 target, so the wrapped rows sit 8 apart.
    expect(chip.props.hitSlop).toEqual({ top: 4, bottom: 4 });
    expect(flatStyle(chip)).toMatchObject({ minHeight: 40 });
    expect(above(chip, "flexWrap")).toMatchObject({ flexWrap: "wrap", columnGap: 8, rowGap: 8 });
  });
});

describe("Aktifkan on the Dapur scale", () => {
  const ready = (extra: Record<string, unknown> = {}) => {
    const runtime = runtimeWith({ id: "u-1", role: "owner", catererId: "k-1" });
    runtime.api = {
      ...runtime.api,
      sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur", status: "draft" }, offers: [{ id: "o-1" }], datedMenus: [] })),
      request: jest.fn(async () => ({ active: null, latest: null })),
      ...extra,
    } as MobileRuntime["api"];
    return runtime;
  };
  const renderAktifkan = (runtime: MobileRuntime) =>
    render(
      withDapurScale(
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <AktifkanScreen />
        </MobileProvider>,
      ),
    );

  it("heads its three steps with 20/26 section titles, 24 apart, and the form groups 12 apart", async () => {
    renderAktifkan(ready());
    const headers = await screen.findAllByRole("header");
    expect(headers.map((h) => h.props.children)).toEqual(["1. Pemeriksaan profil dan paket", "2. Rekening pencairan", "3. Verifikasi pembayaran"]);
    for (const h of headers) expect(flatStyle(h)).toMatchObject({ fontSize: 20, lineHeight: 26 });
    // Step 1: its one action; step 3: Nanti.
    expect(screen.getByRole("button", { name: "Minta diperiksa" })).toBeTruthy();
    expect(flatStyle(screen.getByText("Nanti"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    // The steps are spaced by the Dapur section gap, not the screen's 16.
    expect(flatStyle(screen.getByTestId("aktifkan-steps"))).toMatchObject({ gap: 24 });
    expect(flatStyle(screen.getByTestId("aktifkan-bank-form"))).toMatchObject({ gap: 12 });
    // The intro paragraph is 15/22.
    expect(flatStyle(screen.getByText(/^Setelah aktif, pelanggan/))).toMatchObject({ fontSize: 15, lineHeight: 22 });
  });

  it("lays its loading cards 24 apart, as the loaded step cards sit, so nothing shifts when the data lands", async () => {
    renderAktifkan(ready({ sellerOperations: jest.fn(() => new Promise(() => {})) }));
    await screen.findByLabelText("Memuat pembayaran");
    // The cards' lowest common ancestor is the skeleton's own column: its gap is the space between the cards.
    type N = { props: { style?: unknown }; parent: N | null };
    const rows = [0, 1, 2].map((i) => screen.getByTestId(`list-skeleton-row-${i}`) as unknown as N);
    const ancestors = (n: N) => {
      const out: N[] = [];
      for (let p = n.parent; p; p = p.parent) out.push(p);
      return out;
    };
    for (const pair of [[0, 1], [1, 2]]) {
      const up = new Set(ancestors(rows[pair[0]]));
      const column = ancestors(rows[pair[1]]).find((p) => up.has(p))!;
      expect(flatStyle(column)).toMatchObject({ gap: 24 });
    }
    // And the loaded steps keep the same 24 column.
    expect(flatStyle(screen.getByTestId("aktifkan-steps"))).toMatchObject({ gap: 24 });
  });

  it("step 1 in review and step 2 done read Sedang ditinjau and Selesai, each with its one line", async () => {
    renderAktifkan(
      ready({
        sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur", status: "submitted" }, offers: [], datedMenus: [] })),
        request: jest.fn(async () => ({ active: { bank: "BCA", maskedAccount: "1234", holder: "Rina" }, latest: null })),
      }),
    );
    expect(await screen.findByText("Sedang ditinjau")).toBeTruthy();
    expect(screen.getByText("Tim Catera memeriksa data ini dulu sebelum dapurmu tayang.")).toBeTruthy();
    expect(screen.getByText("Selesai")).toBeTruthy();
    expect(flatStyle(screen.getByText("BCA · 1234 · Rina"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    expect(within(screen.getByTestId("aktifkan-steps")).queryAllByRole("button")).toHaveLength(0);
  });
});
