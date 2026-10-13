import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { ConnectionBanner, FormError, ReadError } from "@catera/mobile-ui";

const emit = (state: { isConnected: boolean }) => (NetInfo as unknown as { __emit: (s: unknown) => void }).__emit(state);
const original = Platform.OS;

beforeEach(() => {
  // The preset already mocks AccessibilityInfo, so a restore does not clear its calls.
  (AccessibilityInfo.announceForAccessibility as jest.Mock | undefined)?.mockClear?.();
});
afterEach(() => {
  Platform.OS = original;
  jest.restoreAllMocks();
});

describe("ConnectionBanner", () => {
  it("shows the title, the time of the data and the retry", () => {
    const onRetry = jest.fn();
    render(<ConnectionBanner lastSeen={new Date(2026, 9, 13, 9, 5)} onRetry={onRetry} />);
    expect(screen.getByText("Tidak ada koneksi")).toBeTruthy();
    expect(screen.getByText("Menampilkan data terakhir, 09.05")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("with nothing cached it leaves the time line out", () => {
    render(<ConnectionBanner onRetry={() => {}} />);
    expect(screen.getByText("Tidak ada koneksi")).toBeTruthy();
    expect(screen.queryByText(/Menampilkan data terakhir/)).toBeNull();
  });

  it("the banner announces once and hides on reconnect", () => {
    Platform.OS = "ios";
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const view = render(<ConnectionBanner lastSeen={new Date(2026, 9, 13, 14, 30)} onRetry={() => {}} />);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Tidak ada koneksi. Menampilkan data terakhir, 14.30");
    view.rerender(<ConnectionBanner lastSeen={new Date(2026, 9, 13, 14, 30)} onRetry={() => {}} />);
    act(() => emit({ isConnected: false }));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("connection-banner").props.accessibilityLiveRegion).toBe("polite");
    act(() => emit({ isConnected: true }));
    expect(screen.queryByTestId("connection-banner")).toBeNull();
  });

  it("the banner retries on reconnect", () => {
    const onRetry = jest.fn();
    render(<ConnectionBanner onRetry={onRetry} />);
    // A phone that was already online (the server is the problem) does not retry by itself.
    act(() => emit({ isConnected: true }));
    expect(onRetry).not.toHaveBeenCalled();
    expect(screen.getByTestId("connection-banner")).toBeTruthy();
    act(() => emit({ isConnected: false }));
    act(() => emit({ isConnected: true }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    act(() => emit({ isConnected: true }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("stops listening when it leaves", () => {
    const view = render(<ConnectionBanner onRetry={() => {}} />);
    const listeners = (NetInfo as unknown as { __listeners: Set<unknown> }).__listeners;
    expect(listeners.size).toBe(1);
    view.unmount();
    expect(listeners.size).toBe(0);
  });
});

describe("FormError", () => {
  it("shows the message with an icon and a polite live region", () => {
    render(<FormError message="Nomor belum cocok." />);
    expect(screen.getByText("Nomor belum cocok.")).toBeTruthy();
    expect(screen.getByTestId("form-error").props.accessibilityLiveRegion).toBe("polite");
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });

  it("offers Coba lagi when it can retry", () => {
    const retry = jest.fn();
    render(<FormError message="Belum tersimpan." retry={retry} />);
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("announces on iOS, once per message", () => {
    Platform.OS = "ios";
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const view = render(<FormError message="Belum tersimpan." />);
    view.rerender(<FormError message="Belum tersimpan." />);
    expect(announce).toHaveBeenCalledTimes(1);
    view.rerender(<FormError message="Kode salah." />);
    expect(announce).toHaveBeenLastCalledWith("Kode salah.");
  });

  it("does not call announce on Android: the live region speaks", () => {
    Platform.OS = "android";
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    render(<FormError message="Belum tersimpan." />);
    expect(announce).not.toHaveBeenCalled();
  });
});

describe("ReadError", () => {
  it("is shared from mobile-ui with its retry", () => {
    const onRetry = jest.fn();
    render(<ReadError message="Data belum bisa dimuat." onRetry={onRetry} />);
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
