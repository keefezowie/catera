import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { NavigationContext, NavigationRouteContext } from "expo-router/react-navigation";
import { groupPaymentMethods, paymentMethodInfo, PAYMENT_METHODS } from "@catera/domain";
import { createMobileRuntime, MobileProvider } from "@catera/mobile-core";
import { customerLink } from "../src/links";
import { PayMethodRoute, usePayMethodPicker } from "../src/buy/PayMethodSheet";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
}));

/** Every code DOKU lists (research addendum), so a missing catalogue entry fails here. */
const DOKU_CODES = [
  ...["BCA", "BANK_MANDIRI", "BANK_SYARIAH_MANDIRI", "BRI", "BNI", "DOKU", "BANK_PERMATA", "BANK_CIMB", "BANK_DANAMON", "BTN", "BNC", "BSS", "BJB", "Sinarmas"].map(
    (b) => `VIRTUAL_ACCOUNT_${b}`,
  ),
  "QRIS",
  "EMONEY_OVO",
  "EMONEY_SHOPEE_PAY",
  "EMONEY_DOKU",
  "EMONEY_LINKAJA",
  "EMONEY_DANA",
  "CREDIT_CARD",
  "ONLINE_TO_OFFLINE_ALFA",
  "ONLINE_TO_OFFLINE_INDOMARET",
  "PEER_TO_PEER_AKULAKU",
  "PEER_TO_PEER_KREDIVO",
  "PEER_TO_PEER_INDODANA",
];

describe("payment method catalogue", () => {
  it("has an entry for every DOKU code, and nothing else", () => {
    for (const code of DOKU_CODES) expect(paymentMethodInfo(code)).toBeDefined();
    expect(PAYMENT_METHODS).toHaveLength(DOKU_CODES.length);
  });

  it("skips codes it does not know", () => {
    expect(paymentMethodInfo("EMONEY_NOPE")).toBeUndefined();
    expect(groupPaymentMethods(["QRIS", "EMONEY_NOPE"]).flatMap((g) => g.methods.map((m) => m.code))).toEqual(["QRIS"]);
  });

  it("groups in picker order and catalogue order, leaving empty groups out", () => {
    const groups = groupPaymentMethods([
      "PEER_TO_PEER_KREDIVO",
      "VIRTUAL_ACCOUNT_BRI",
      "EMONEY_DANA",
      "VIRTUAL_ACCOUNT_BCA",
      "QRIS",
      "ONLINE_TO_OFFLINE_INDOMARET",
      "CREDIT_CARD",
    ]);
    expect(groups.map((g) => g.group)).toEqual(["qris", "ewallet", "va", "card", "retail", "paylater"]);
    expect(groups[2].methods.map((m) => m.code)).toEqual(["VIRTUAL_ACCOUNT_BCA", "VIRTUAL_ACCOUNT_BRI"]);
    expect(groups.map((g) => g.title?.id ?? null)).toEqual([null, "E-wallet", "Transfer bank", "Kartu", "Bayar di gerai", "Paylater"]);
  });

  it("names and describes each kind in Indonesian and English", () => {
    expect(paymentMethodInfo("VIRTUAL_ACCOUNT_BRI")).toMatchObject({
      name: { id: "BRI Virtual Account", en: "BRI Virtual Account" },
      detail: { id: "Transfer dari aplikasi atau ATM BRI.", en: "Transfer from the BRI app or ATM." },
    });
    expect(paymentMethodInfo("QRIS")?.detail.id).toBe("Pindai dari aplikasi bank atau e-wallet apa pun.");
    expect(paymentMethodInfo("EMONEY_OVO")?.detail).toEqual({ id: "Lanjut di aplikasi OVO.", en: "Continue in the OVO app." });
    expect(paymentMethodInfo("ONLINE_TO_OFFLINE_ALFA")?.detail.id).toBe("Tunjukkan kode bayar di kasir.");
    expect(paymentMethodInfo("PEER_TO_PEER_AKULAKU")?.detail).toEqual({
      id: "Cicil lewat akun Akulaku.",
      en: "Pay in instalments with Akulaku.",
    });
    expect(paymentMethodInfo("CREDIT_CARD")).toMatchObject({ name: { id: "Kartu kredit atau debit" }, detail: { id: "Visa, Mastercard, JCB." } });
  });
});

/** The router is mocked: this host stands in for the stack, showing the sheet route a push opened. */
function Host() {
  const [open, setOpen] = useState<{ pathname: string; params: { id: string } } | null>(null);
  (router.push as jest.Mock).mockImplementation((href: { pathname: string; params: { id: string } }) => setOpen(href));
  if (!open) return null;
  const navigation = {
    goBack: () => setOpen(null),
    canGoBack: () => true,
    addListener: () => () => undefined,
    setOptions: () => undefined,
    isFocused: () => true,
  };
  return (
    <NavigationContext.Provider value={navigation as never}>
      <NavigationRouteContext.Provider value={{ key: "k", name: open.pathname, params: open.params } as never}>
        <PayMethodRoute os="ios" />
      </NavigationRouteContext.Provider>
    </NavigationContext.Provider>
  );
}

function Asker({ codes, selected }: { codes: string[]; selected: string | null }) {
  const ask = usePayMethodPicker();
  const [answer, setAnswer] = useState("belum");
  return (
    <View>
      <Text testID="answer">{answer}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="buka" onPress={() => void ask({ codes, selected }).then((r) => setAnswer(String(r)))}>
        <Text>buka</Text>
      </Pressable>
    </View>
  );
}

async function openPicker(codes: string[], selected: string | null = null) {
  render(
    <MobileProvider runtime={createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" })} linkMapper={customerLink}>
      <Asker codes={codes} selected={selected} />
      <Host />
    </MobileProvider>,
  );
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "buka" })));
}
const titles = () => ["E-wallet", "Transfer bank", "Kartu", "Bayar di gerai", "Paylater"].filter((t) => screen.queryByText(t));

describe("Bayar dengan picker", () => {
  it("two methods are two plain rows with no section titles", async () => {
    await openPicker(["QRIS", "VIRTUAL_ACCOUNT_BRI"], "QRIS");
    expect(screen.getByText("Bayar dengan")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /^QRIS/ }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole("radio", { name: /^BRI Virtual Account/ }).props.accessibilityState.checked).toBe(false);
    expect(titles()).toEqual([]);
    expect(screen.queryByRole("button", { name: /Transfer bank/ })).toBeNull();
  });

  it("more than five show the group titles in order, and the banks fold into one row", async () => {
    await openPicker(
      [
        "QRIS",
        "EMONEY_OVO",
        "EMONEY_DANA",
        "VIRTUAL_ACCOUNT_BCA",
        "VIRTUAL_ACCOUNT_BANK_MANDIRI",
        "VIRTUAL_ACCOUNT_BRI",
        "VIRTUAL_ACCOUNT_BNI",
        "VIRTUAL_ACCOUNT_BJB",
        "ONLINE_TO_OFFLINE_ALFA",
        "PEER_TO_PEER_KREDIVO",
      ],
      "QRIS",
    );
    expect(titles()).toEqual(["E-wallet", "Transfer bank", "Bayar di gerai", "Paylater"]);
    const va = screen.getByRole("button", { name: /^Transfer bank \(Virtual Account\)/ });
    expect(va.props.accessibilityState.expanded).toBe(false);
    expect(within(va).getByText("BCA, Mandiri, BRI, BNI dan 1 lainnya")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /^BCA Virtual Account/ })).toBeNull();
    fireEvent.press(va);
    expect(screen.getByRole("button", { name: /^Transfer bank \(Virtual Account\)/ }).props.accessibilityState.expanded).toBe(true);
    expect(screen.getAllByRole("radio", { name: /Virtual Account/ })).toHaveLength(5);
  });

  it("starts with the banks open when a bank is the chosen method", async () => {
    await openPicker(["QRIS", "EMONEY_OVO", "EMONEY_DANA", "VIRTUAL_ACCOUNT_BCA", "VIRTUAL_ACCOUNT_BRI", "ONLINE_TO_OFFLINE_ALFA"], "VIRTUAL_ACCOUNT_BRI");
    expect(screen.getByRole("button", { name: /^Transfer bank \(Virtual Account\)/ }).props.accessibilityState.expanded).toBe(true);
    expect(screen.getByRole("radio", { name: /^BRI Virtual Account/ }).props.accessibilityState.checked).toBe(true);
  });

  it("choosing answers the code once the sheet has closed", async () => {
    await openPicker(["QRIS", "VIRTUAL_ACCOUNT_BRI"], "QRIS");
    await act(async () => fireEvent.press(screen.getByRole("radio", { name: /^BRI Virtual Account/ })));
    await waitFor(() => expect(screen.getByTestId("answer").props.children).toBe("VIRTUAL_ACCOUNT_BRI"));
    expect(screen.queryByText("Bayar dengan")).toBeNull();
  });

  it("closing answers null", async () => {
    await openPicker(["QRIS", "VIRTUAL_ACCOUNT_BRI"], "QRIS");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Tutup" })));
    await waitFor(() => expect(screen.getByTestId("answer").props.children).toBe("null"));
  });

  it("each row leads with a mark tile", async () => {
    await openPicker(["QRIS", "VIRTUAL_ACCOUNT_BRI"], "QRIS");
    expect(screen.getAllByTestId("pay-mark")).toHaveLength(2);
  });
});

describe("payment method marks", () => {
  const { MethodMark } = require("../src/buy/MethodMark") as typeof import("../src/buy/MethodMark");
  const { paymentLogo } = require("../src/buy/paymentLogos") as typeof import("../src/buy/paymentLogos");

  it("has a mark for every catalogue logo key", () => {
    for (const m of PAYMENT_METHODS) expect(paymentLogo(m.logo)).toBeDefined();
  });

  it("draws a mark on a 56×40 tile that stays white in every theme", () => {
    const flat = (s: unknown) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean));
    render(<MethodMark info={paymentMethodInfo("VIRTUAL_ACCOUNT_BCA")} />);
    const tile = flat(screen.getByTestId("pay-mark").props.style);
    expect(tile).toMatchObject({ width: 56, height: 40, backgroundColor: "#FFFFFF" });
  });
});
