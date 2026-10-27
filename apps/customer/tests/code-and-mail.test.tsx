import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import { CheckEmail, CodeInput, maskPhone } from "@catera/mobile-ui";

jest.mock("expo-intent-launcher", () => ({ startActivityAsync: jest.fn(async () => ({})) }));

function Code(props: Partial<React.ComponentProps<typeof CodeInput>> & { onFilled?: (code: string) => void }) {
  return <CodeInput label="Kode dari SMS" value="" onChangeText={() => undefined} onFilled={() => undefined} {...props} />;
}

describe("shared code entry", () => {
  it("maskPhone keeps 4 and 4", () => {
    expect(maskPhone("0812 3456 7890")).toBe("0812 •••• 7890");
    expect(maskPhone("+62 812 3456 7890")).toBe("6281 •••• 7890");
  });

  it("writes the masked number above the boxes", () => {
    render(<Code sentTo="0812 3456 7890" />);
    expect(screen.getByText("Kode dikirim ke 0812 •••• 7890")).toBeTruthy();
  });

  it("wrong code shows the message under the boxes", () => {
    render(<Code error="Kodenya salah. Cek SMS-nya, lalu coba lagi." errorKey={1} />);
    const message = screen.getByText("Kodenya salah. Cek SMS-nya, lalu coba lagi.");
    expect(message.props.selectable).toBe(true);
    expect(screen.getByTestId("code-error")).toBeTruthy();
  });

  it("onFilled fires once for a code filled twice", () => {
    const onFilled = jest.fn();
    render(<Code onFilled={onFilled} />);
    const input = screen.getByLabelText("Kode dari SMS");
    fireEvent.changeText(input, "123456");
    fireEvent.changeText(input, "123456");
    expect(onFilled).toHaveBeenCalledTimes(1);
    expect(onFilled).toHaveBeenCalledWith("123456");
  });

  it("verified ring renders with testID code-verified", () => {
    const { rerender } = render(<Code />);
    expect(screen.queryByTestId("code-verified")).toBeNull();
    rerender(<Code verified />);
    expect(screen.getByTestId("code-verified")).toBeTruthy();
  });
});

describe("shared Cek emailmu", () => {
  const props = { email: "rani@example.test", intro: "Kami kirim tautan ke", resendBusy: false, onResend: () => undefined, onChangeEmail: () => undefined };

  it("Terkirim shows after resent and the countdown returns after 3s", () => {
    jest.useFakeTimers();
    try {
      const { rerender } = render(<CheckEmail {...props} resent={false} os="android" />);
      act(() => jest.advanceTimersByTime(60_000));
      expect(screen.getByRole("button", { name: "Kirim ulang tautan" })).toBeTruthy();
      rerender(<CheckEmail {...props} resent />);
      expect(screen.getByText("Terkirim")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Kirim ulang tautan" })).toBeNull();
      act(() => jest.advanceTimersByTime(3000));
      expect(screen.queryByText("Terkirim")).toBeNull();
      expect(screen.getByRole("button", { name: /Kirim ulang dalam 0:5\d/ })).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("open mail on Android calls IntentLauncher with APP_EMAIL", async () => {
    render(<CheckEmail {...props} resent={false} os="android" />);
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Buka aplikasi email" }));
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
    render(<CheckEmail {...props} resent={false} os="android" />);
    fireEvent.press(screen.getByRole("button", { name: "Buka aplikasi email" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("mailto:"));
    open.mockRestore();
  });

  it("open mail on iOS opens message://", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<CheckEmail {...props} resent={false} os="ios" />);
    fireEvent.press(screen.getByRole("button", { name: "Buka aplikasi email" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("message://"));
    open.mockRestore();
  });

  it("puts Ubah email under the address and takes no art when art is null", () => {
    render(<CheckEmail {...props} resent={false} art={null} />);
    expect(screen.getByRole("button", { name: "Ubah email" })).toBeTruthy();
    expect(screen.getByText("Buka tautannya di HP ini. Tidak ada? Cek folder spam atau promosi.")).toBeTruthy();
  });
});
