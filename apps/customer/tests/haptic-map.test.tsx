import { useEffect } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { LayoutScaleProvider, SaveHeart, SettingsSwitchRow, ThemeProvider, ToastProvider, useToast, type ToastInput } from "@catera/mobile-ui";

// The haptic map: a toast plays the haptic its tone means, once; a switch and a heart tick.
const flush = async () => await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const shell = async (ui: React.ReactElement) =>
  await render(
    <ThemeProvider storageKey="haptic-map-test">
      <LayoutScaleProvider>
        <ToastProvider>{ui}</ToastProvider>
      </LayoutScaleProvider>
    </ThemeProvider>,
  );

function Show({ input }: { input: ToastInput }) {
  const toast = useToast();
  useEffect(() => toast.show(input), [toast, input]);
  return null;
}

async function toastWith(input: ToastInput) {
  await shell(<Show input={input} />);
  await flush();
}

const notified = Haptics.notificationAsync as jest.Mock;
const selected = Haptics.selectionAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("toast haptics", () => {
  it.each([
    ["success", Haptics.NotificationFeedbackType.Success],
    ["error", Haptics.NotificationFeedbackType.Error],
    ["warning", Haptics.NotificationFeedbackType.Warning],
  ] as const)("a %s toast plays its notification once", async (tone, type) => {
    await toastWith({ message: "x", tone });
    expect(notified).toHaveBeenCalledTimes(1);
    expect(notified).toHaveBeenCalledWith(type);
  });

  it("a toast with no tone plays nothing", async () => {
    await toastWith({ message: "x" });
    expect(notified).not.toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
  });

  it("the haptic override replaces the tone's haptic", async () => {
    await toastWith({ message: "Nomor disalin", tone: "success", haptic: "select" });
    expect(notified).not.toHaveBeenCalled();
    expect(selected).toHaveBeenCalledTimes(1);
  });

  it('haptic "none" keeps a toned toast silent', async () => {
    await toastWith({ message: "x", tone: "error", haptic: "none" });
    expect(notified).not.toHaveBeenCalled();
  });
});

describe("switch row and save heart", () => {
  it("toggling a switch row ticks once and reports the change", async () => {
    const onValueChange = jest.fn();
    await shell(<SettingsSwitchRow label="Notifikasi" supporting="Kabar" value={false} onValueChange={onValueChange} />);
    await fireEvent(screen.getByRole("switch", { name: "Notifikasi" }), "valueChange", true);
    expect(selected).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it.each([false, true])("pressing a heart that is saved=%s ticks once", async (saved) => {
    const onToggle = jest.fn();
    await shell(<SaveHeart saved={saved} onToggle={onToggle} label="Simpan" />);
    await fireEvent.press(screen.getByLabelText("Simpan"));
    expect(selected).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
