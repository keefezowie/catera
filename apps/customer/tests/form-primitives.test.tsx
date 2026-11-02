import { useEffect, useState } from "react";
import { iconsIn } from "./find-hosts";
import { AccessibilityInfo } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { FormError, Field, PasswordField, PasswordMatch, PasswordRule, useFieldCheck } from "@catera/mobile-ui";

const email = (v: string) => (/^\S+@\S+\.\S+$/.test(v) ? "" : "Format email belum benar.");
const name = (v: string) => (v.trim().length >= 2 ? "" : "Tulis namamu.");

const focusName = jest.fn();

function Form({ onRun = () => {} }: { onRun?: () => void }) {
  const [n, setN] = useState("");
  const [e, setE] = useState("");
  const { fieldProps, submit } = useFieldCheck({ name: { value: n, check: name }, email: { value: e, check: email } });
  const nameProps = fieldProps("name");
  useEffect(() => {
    (nameProps.inputRef as { current: unknown }).current = { focus: focusName };
  });
  return (
    <>
      <Field label="Nama" value={n} onChangeText={setN} {...nameProps} />
      <Field label="Email" value={e} onChangeText={setE} {...fieldProps("email")} />
      <FormError message="x" action={{ label: "Kirim", onPress: () => submit(onRun) }} />
    </>
  );
}

describe("form primitives", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    focusName.mockClear();
  });

  it("no message while typing for the first time", async () => {
    await render(<Form />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "abc");
    expect(screen.queryByText("Format email belum benar.")).toBeNull();
  });

  it("blur with text shows the message", async () => {
    await render(<Form />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "abc");
    await fireEvent(screen.getByLabelText("Email"), "blur");
    expect(screen.getByText("Format email belum benar.")).toBeTruthy();
    expect(screen.getByLabelText("Email").props.accessibilityHint).toBe("Format email belum benar.");
  });

  it("an empty field left on blur stays quiet", async () => {
    await render(<Form />);
    await fireEvent(screen.getByLabelText("Email"), "blur");
    expect(screen.queryByText("Format email belum benar.")).toBeNull();
  });

  it("re-checks on change once shown", async () => {
    await render(<Form />);
    const input = screen.getByLabelText("Email");
    await fireEvent.changeText(input, "abc");
    await fireEvent(input, "blur");
    await fireEvent.changeText(input, "a@b.co");
    expect(screen.queryByText("Format email belum benar.")).toBeNull();
    await fireEvent.changeText(input, "a@b");
    expect(screen.getByText("Format email belum benar.")).toBeTruthy();
  });

  it("submit focuses the first failing field and announces the count", async () => {
    const spy = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const onRun = jest.fn();
    await render(<Form onRun={onRun} />);
    await fireEvent.press(screen.getByText("Kirim"));
    expect(spy).toHaveBeenCalledWith("2 isian perlu diperbaiki");
    expect(screen.getByText("Tulis namamu.")).toBeTruthy();
    expect(onRun).not.toHaveBeenCalled();
    expect(focusName).toHaveBeenCalledTimes(1);
  });

  it("submit runs when all checks pass", async () => {
    const onRun = jest.fn();
    await render(<Form onRun={onRun} />);
    await fireEvent.changeText(screen.getByLabelText("Nama"), "Sari");
    await fireEvent.changeText(screen.getByLabelText("Email"), "a@b.co");
    await fireEvent.press(screen.getByText("Kirim"));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("PasswordRule announces met once", async () => {
    const spy = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    spy.mockClear();
    const view = await render(<PasswordRule value="abc" failed={false} />);
    expect(spy).not.toHaveBeenCalled();
    await view.rerender(<PasswordRule value="abcdefgh" failed={false} />);
    await view.rerender(<PasswordRule value="abcdefghi" failed={false} />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("Syarat kata sandi terpenuhi");
    expect(screen.getByText("Minimal 8 karakter")).toBeTruthy();
  });

  it("PasswordRule failed and short shows danger text with the alert glyph", async () => {
    await render(<PasswordRule value="abc" failed />);
    expect(screen.getByText("Minimal 8 karakter")).toBeTruthy();
    expect(iconsIn(screen.getByTestId("password-rule")).map((i) => i.name)).toEqual(["alert-circle"]);
  });

  it("submit with one failing field announces a count of one", async () => {
    const spy = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    spy.mockClear();
    const view = await render(<Form />);
    await fireEvent.changeText(screen.getByLabelText("Nama"), "Sari");
    await fireEvent.press(screen.getByText("Kirim"));
    expect(spy).toHaveBeenCalledWith("1 isian perlu diperbaiki");
    await view.unmount();
  });

  it("PasswordMatch quiet until the second field is as long as the first", async () => {
    const view = await render(<PasswordMatch first="abcdefgh" second="abc" touched={false} />);
    expect(screen.queryByTestId("password-match")).toBeNull();
    await view.rerender(<PasswordMatch first="abcdefgh" second="abcdefgx" touched={false} />);
    expect(screen.getByText("Kata sandinya belum sama.")).toBeTruthy();
    await view.rerender(<PasswordMatch first="abcdefgh" second="abcdefgh" touched={false} />);
    expect(screen.getByText("Kata sandinya sama")).toBeTruthy();
  });

  it("toggling a controlled PasswordField pair shows both", async () => {
    function Pair() {
      const [shown, setShown] = useState(false);
      const p = { showA11y: "Tampilkan", hideA11y: "Sembunyikan", shown, onShownChange: setShown };
      return (
        <>
          <PasswordField label="Sandi" {...p} />
          <PasswordField label="Ulangi" {...p} />
        </>
      );
    }
    await render(<Pair />);
    expect(screen.getByLabelText("Sandi").props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getAllByLabelText("Tampilkan")[0]);
    expect(screen.getByLabelText("Sandi").props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText("Ulangi").props.secureTextEntry).toBe(false);
  });

  it("FormError action calls onPress, and retry still works", async () => {
    const onPress = jest.fn();
    const retry = jest.fn();
    const view = await render(<FormError message="x" action={{ label: "Kirim lagi", onPress }} />);
    await fireEvent.press(screen.getByText("Kirim lagi"));
    expect(onPress).toHaveBeenCalled();
    await view.rerender(<FormError message="x" retry={retry} />);
    await fireEvent.press(screen.getByText("Coba lagi"));
    expect(retry).toHaveBeenCalled();
  });
});
