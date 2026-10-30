import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, useMobile, type MobileContextValue } from "@catera/mobile-core";
import { ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { Akun } from "../src/account/Akun";
import { Pengaturan } from "../src/settings/Pengaturan";
import { customerLink } from "../src/links";

/**
 * Keluar against a stand-in API that keeps the server's session rule (apps/web/src/lib/auth.ts: a bearer, else the
 * `catera_v1_demo` cookie) and a stand-in for the phone's shared native cookie store, which keeps and sends cookies
 * for every request that does not say `credentials: "omit"`.
 */
const mockJar = new Map<string, string>();

jest.mock("react-native/Libraries/Network/RCTNetworking", () => ({
  __esModule: true,
  default: {
    clearCookies: (callback: (cleared: boolean) => void) => {
      const had = mockJar.size > 0;
      mockJar.clear();
      callback(had);
    },
  },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), goToTab: jest.fn() }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined", canAskAgain: true })),
}));
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const DEMO_TOKEN = "demo.synthetic-customer.signature";

type Sent = { path: string; authorization: string; cookie: string };
let sent: Sent[] = [];

function serve(url: string, init: RequestInit = {}) {
  const path = url.replace("https://api.example.test/api/v1/", "");
  const withCredentials = init.credentials !== "omit";
  const cookie = withCredentials ? [...mockJar].map(([name, value]) => `${name}=${value}`).join("; ") : "";
  const authorization = (init.headers as Record<string, string> | undefined)?.Authorization ?? "";
  sent.push({ path, authorization, cookie });
  const reply = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) });
  if (path === "auth/demo") {
    if (withCredentials) mockJar.set("catera_v1_demo", DEMO_TOKEN);
    return reply({ token: DEMO_TOKEN, id: customer.id });
  }
  const token = authorization.replace(/^Bearer /, "") || (/(?:^|; )catera_v1_demo=([^;]*)/.exec(cookie)?.[1] ?? "");
  if (path === "me") return reply({ actor: token === DEMO_TOKEN ? customer : null, demo: true });
  return reply({});
}

let session: MobileContextValue;

/** Signed in, the Pengaturan tab with Keluar; signed out, the Akun tab's sign-in prompt, where Keluar sends the phone. */
function App() {
  session = useMobile();
  return session.actor ? <Pengaturan /> : <Akun />;
}

const fetchBefore = global.fetch;
beforeEach(() => {
  mockJar.clear();
  sent = [];
  global.fetch = jest.fn(async (url: unknown, init?: RequestInit) => serve(String(url), init)) as never;
});
afterAll(() => {
  global.fetch = fetchBefore;
});

it("Keluar from a demo session: the next request carries no credential and the sign-in prompt shows", async () => {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "signout", app: "customer" });
  // What Masuk's "Masuk sebagai pelanggan demo" does before it reads the session.
  await runtime.demoLogin("customer");
  render(
    <ThemeProvider storageKey={runtime.storageKey("theme")}>
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MobileProvider>
    </ThemeProvider>,
  );
  fireEvent.press(await screen.findByRole("button", { name: "Keluar" }));
  expect(await screen.findByRole("button", { name: "Masuk" })).toBeTruthy();

  // The next session read (a return from the background, the next launch) asks as nobody, and stays signed out.
  sent = [];
  await act(() => session.refresh());
  expect(sent.find((s) => s.path === "me")).toEqual({ path: "me", authorization: "", cookie: "" });
  await act(async () => {});
  expect(session.actor).toBeNull();
  expect(screen.getByRole("button", { name: "Masuk" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Keluar" })).toBeNull();
});
