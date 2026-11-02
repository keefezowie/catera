import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import { CheckEmail } from "@catera/mobile-ui";

jest.mock("expo-intent-launcher", () => ({ startActivityAsync: jest.fn(async () => ({})) }));

describe("shared Cek emailmu", () => {
  const props = { email: "rani@example.test", intro: "Kami kirim tautan ke", resendBusy: false, onResend: () => undefined, onChangeEmail: () => undefined };

  it("Terkirim shows after resent and the countdown returns after 3s", async () => {
    jest.useFakeTimers();
    try {
      const { rerender } = await render(<CheckEmail {...props} resent={false} os="android" />);
      await act(() => jest.advanceTimersByTime(60_000));
      expect(screen.getByRole("button", { name: "Kirim ulang tautan" })).toBeTruthy();
      await rerender(<CheckEmail {...props} resent />);
      expect(screen.getByText("Terkirim")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Kirim ulang tautan" })).toBeNull();
      await act(() => jest.advanceTimersByTime(3000));
      expect(screen.queryByText("Terkirim")).toBeNull();
      expect(screen.getByRole("button", { name: /Kirim ulang dalam 0:5\d/ })).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("open mail on Android calls IntentLauncher with APP_EMAIL", async () => {
    await render(<CheckEmail {...props} resent={false} os="android" />);
    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Buka aplikasi email" }));
    });
    await waitFor(() =>
      expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith("android.intent.action.MAIN", {
        category: "android.intent.category.APP_EMAIL",
        flags: 268435456,
      }),
    );
  });

  it("falls back to mailto when the intent fails", async () => {
    (IntentLauncher.startActivityAsync as jest.Mock).mockRejectedValueOnce(new Error("none"));
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await render(<CheckEmail {...props} resent={false} os="android" />);
    await fireEvent.press(screen.getByRole("button", { name: "Buka aplikasi email" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("mailto:"));
    open.mockRestore();
  });

  it("open mail on iOS opens message://", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await render(<CheckEmail {...props} resent={false} os="ios" />);
    await fireEvent.press(screen.getByRole("button", { name: "Buka aplikasi email" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("message://"));
    open.mockRestore();
  });

  it("draws the reading mascot by default", async () => {
    await render(<CheckEmail {...props} resent={false} />);
    expect(await screen.findByTestId("mascot-membaca", { includeHiddenElements: true })).toBeTruthy();
  });

  it("puts Ubah email under the address and takes no art when art is null", async () => {
    await render(<CheckEmail {...props} resent={false} art={null} />);
    expect(screen.queryByTestId("mascot-membaca", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByRole("button", { name: "Ubah email" })).toBeTruthy();
    expect(screen.getByText("Buka tautannya di HP ini. Tidak ada? Cek folder spam atau promosi.")).toBeTruthy();
  });
});
