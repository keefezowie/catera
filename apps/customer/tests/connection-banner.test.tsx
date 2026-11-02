import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useMobile } from "@catera/mobile-core";
import { ConnectionBanner, FormError, ReadError } from "@catera/mobile-ui";

// The translator comes from the app's provider; a test that reads English hands the banner an English one.
jest.mock("@catera/mobile-core", () => ({ ...jest.requireActual("@catera/mobile-core"), useMobile: jest.fn(() => null) }));
const english = { t: (_id: string, en: string) => en };

type NetState = { isConnected: boolean | null; isInternetReachable?: boolean | null };
const net = NetInfo as unknown as { __emit: (s: NetState) => void; __set: (s?: NetState) => void; __listeners: Set<unknown> };
const emit = async (state: NetState) => await act(() => net.__emit(state));
const OFFLINE = { isConnected: false, isInternetReachable: false };
const ONLINE = { isConnected: true, isInternetReachable: true };
/** Lets the first `NetInfo.fetch()` settle. */
const settle = async () => await act(async () => {});
let os: string | undefined;

beforeEach(() => {
  // The preset already mocks AccessibilityInfo, so a restore does not clear its calls.
  (AccessibilityInfo.announceForAccessibility as jest.Mock | undefined)?.mockClear?.();
  net.__set();
});
afterEach(() => {
  os = undefined;
  jest.restoreAllMocks();
});

describe("ConnectionBanner", () => {
  it("renders nothing until NetInfo has reported", async () => {
    // Awaiting render now flushes the first fetch, so hold it open to see the state before NetInfo has reported.
    (NetInfo.fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    await render(<ConnectionBanner os={os} onRetry={() => {}} />);
    expect(screen.queryByTestId("connection-banner")).toBeNull();
    await emit(OFFLINE);
    expect(screen.getByTestId("connection-banner")).toBeTruthy();
  });

  it("an online phone never reads Tidak ada koneksi, even when the server failed", async () => {
    await render(<ConnectionBanner os={os} lastSeen={new Date(2026, 9, 13, 9, 5)} onRetry={() => {}} />);
    await settle();
    expect(screen.queryByTestId("connection-banner")).toBeNull();
    expect(screen.queryByText("Tidak ada koneksi")).toBeNull();
  });

  it("shows the title, the time of the data and the retry when the first report is offline", async () => {
    net.__set(OFFLINE);
    const onRetry = jest.fn();
    await render(<ConnectionBanner os={os} lastSeen={new Date(2026, 9, 13, 9, 5)} onRetry={onRetry} />);
    await settle();
    expect(screen.getByText("Tidak ada koneksi")).toBeTruthy();
    expect(screen.getByText("Menampilkan data terakhir, 09.05")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("counts a connected phone with no internet as offline", async () => {
    net.__set({ isConnected: true, isInternetReachable: false });
    await render(<ConnectionBanner os={os} onRetry={() => {}} />);
    await settle();
    expect(screen.getByTestId("connection-banner")).toBeTruthy();
    // Reachability not yet known is not offline.
    await emit({ isConnected: true, isInternetReachable: null });
    expect(screen.queryByTestId("connection-banner")).toBeNull();
  });

  it("with nothing cached it leaves the time line out", async () => {
    net.__set(OFFLINE);
    await render(<ConnectionBanner os={os} onRetry={() => {}} />);
    await settle();
    expect(screen.getByText("Tidak ada koneksi")).toBeTruthy();
    expect(screen.queryByText(/Menampilkan data terakhir/)).toBeNull();
  });

  it("an event before the first fetch settles wins over the fetch", async () => {
    await render(<ConnectionBanner os={os} onRetry={() => {}} />);
    await emit(OFFLINE);
    net.__set(ONLINE);
    await settle();
    expect(screen.getByTestId("connection-banner")).toBeTruthy();
  });

  it("shows again on every offline transition while mounted", async () => {
    await render(<ConnectionBanner os={os} onRetry={() => {}} />);
    await settle();
    expect(screen.queryByTestId("connection-banner")).toBeNull();
    await emit(OFFLINE);
    expect(screen.getByTestId("connection-banner")).toBeTruthy();
    await emit(ONLINE);
    expect(screen.queryByTestId("connection-banner")).toBeNull();
    await emit(OFFLINE);
    expect(screen.getByTestId("connection-banner")).toBeTruthy();
  });

  it("the banner announces once per offline episode and hides on reconnect", async () => {
    os = "ios";
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const lastSeen = new Date(2026, 9, 13, 14, 30);
    const view = await render(<ConnectionBanner os={os} lastSeen={lastSeen} onRetry={() => {}} />);
    await settle();
    expect(announce).not.toHaveBeenCalled();
    await emit(OFFLINE);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Tidak ada koneksi. Menampilkan data terakhir, 14.30");
    expect(screen.getByTestId("connection-banner").props.accessibilityLiveRegion).toBe("polite");
    // Still offline, a re-render and a repeated report: no second announcement.
    await view.rerender(<ConnectionBanner os={os} lastSeen={new Date(2026, 9, 13, 14, 30)} onRetry={() => {}} />);
    await emit(OFFLINE);
    expect(announce).toHaveBeenCalledTimes(1);
    await emit(ONLINE);
    expect(screen.queryByTestId("connection-banner")).toBeNull();
    await emit(OFFLINE);
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it("the banner retries once on each reconnect", async () => {
    const onRetry = jest.fn();
    await render(<ConnectionBanner os={os} onRetry={onRetry} />);
    await settle();
    // A phone that was already online does not retry by itself.
    await emit(ONLINE);
    expect(onRetry).not.toHaveBeenCalled();
    await emit(OFFLINE);
    await emit(ONLINE);
    expect(onRetry).toHaveBeenCalledTimes(1);
    await emit(ONLINE);
    expect(onRetry).toHaveBeenCalledTimes(1);
    await emit(OFFLINE);
    await emit(ONLINE);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("hides its icon from accessibility", async () => {
    net.__set(OFFLINE);
    await render(<ConnectionBanner os={os} onRetry={() => {}} />);
    await settle();
    expect(screen.queryByTestId("connection-banner-icon")).toBeNull();
    const icon = screen.getByTestId("connection-banner-icon", { includeHiddenElements: true });
    expect(icon.props.accessible).toBe(false);
    expect(icon.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(icon.props.accessibilityElementsHidden).toBe(true);
  });

  it("reads the time of the data in English", async () => {
    (useMobile as jest.Mock).mockReturnValue(english);
    try {
      net.__set(OFFLINE);
      await render(<ConnectionBanner os={os} lastSeen={new Date(2026, 9, 13, 9, 5)} onRetry={() => {}} />);
      await settle();
      expect(screen.getByText("No connection")).toBeTruthy();
      expect(screen.getByText("Showing data from 09.05")).toBeTruthy();
    } finally {
      (useMobile as jest.Mock).mockReturnValue(null);
    }
  });

  it("stops listening when it leaves", async () => {
    const view = await render(<ConnectionBanner os={os} onRetry={() => {}} />);
    expect(net.__listeners.size).toBe(1);
    await view.unmount();
    expect(net.__listeners.size).toBe(0);
  });
});

describe("FormError", () => {
  it("shows the message with an icon and a polite live region", async () => {
    await render(<FormError os={os} message="Nomor belum cocok." />);
    expect(screen.getByText("Nomor belum cocok.")).toBeTruthy();
    expect(screen.getByTestId("form-error").props.accessibilityLiveRegion).toBe("polite");
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });

  it("hides its icon from accessibility", async () => {
    await render(<FormError os={os} message="Nomor belum cocok." />);
    expect(screen.queryByTestId("form-error-icon")).toBeNull();
    const icon = screen.getByTestId("form-error-icon", { includeHiddenElements: true });
    expect(icon.props.accessible).toBe(false);
    expect(icon.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(icon.props.accessibilityElementsHidden).toBe(true);
  });

  it("offers Coba lagi when it can retry", async () => {
    const retry = jest.fn();
    await render(<FormError os={os} message="Belum tersimpan." retry={retry} />);
    await fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("announces on iOS, once per message", async () => {
    os = "ios";
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const view = await render(<FormError os={os} message="Belum tersimpan." />);
    await view.rerender(<FormError os={os} message="Belum tersimpan." />);
    expect(announce).toHaveBeenCalledTimes(1);
    await view.rerender(<FormError os={os} message="Kode salah." />);
    expect(announce).toHaveBeenLastCalledWith("Kode salah.");
  });

  it("a repeated identical failure announces again on iOS when failureKey changes", async () => {
    os = "ios";
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const view = await render(<FormError os={os} message="Belum tersimpan." failureKey={1} />);
    await view.rerender(<FormError os={os} message="Belum tersimpan." failureKey={1} />);
    expect(announce).toHaveBeenCalledTimes(1);
    await view.rerender(<FormError os={os} message="Belum tersimpan." failureKey={2} />);
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith("Belum tersimpan.");
  });

  it("a repeated identical failure re-mounts the text inside the Android live region", async () => {
    os = "android";
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const view = await render(<FormError os={os} message="Belum tersimpan." failureKey={1} />);
    const first = screen.getByText("Belum tersimpan.");
    await view.rerender(<FormError os={os} message="Belum tersimpan." failureKey={1} />);
    expect(screen.getByText("Belum tersimpan.")).toBe(first);
    await view.rerender(<FormError os={os} message="Belum tersimpan." failureKey={2} />);
    // A new node is a content change, so TalkBack reads the region again.
    expect(screen.getByText("Belum tersimpan.")).not.toBe(first);
    expect(screen.getByTestId("form-error").props.accessibilityLiveRegion).toBe("polite");
    expect(announce).not.toHaveBeenCalled();
  });

  it("does not call announce on Android: the live region speaks", async () => {
    os = "android";
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    await render(<FormError os={os} message="Belum tersimpan." />);
    expect(announce).not.toHaveBeenCalled();
  });
});

describe("ReadError", () => {
  it("is shared from mobile-ui with its retry", async () => {
    const onRetry = jest.fn();
    await render(<ReadError message="Data belum bisa dimuat." onRetry={onRetry} />);
    await fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
