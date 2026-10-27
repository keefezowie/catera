import { useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
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

  it("no message while typing for the first time", () => {
    render(<Form />);
    fireEvent.changeText(screen.getByLabelText("Email"), "abc");
    expect(screen.queryByText("Format email belum benar.")).toBeNull();
  });

  it("blur with text shows the message", () => {
    render(<Form />);
    fireEvent.changeText(screen.getByLabelText("Email"), "abc");
    fireEvent(screen.getByLabelText("Email"), "blur");
    expect(screen.getByText("Format email belum benar.")).toBeTruthy();
    expect(screen.getByLabelText("Email").props.accessibilityHint).toBe("Format email belum benar.");
  });

  it("an empty field left on blur stays quiet", () => {
    render(<Form />);
    fireEvent(screen.getByLabelText("Email"), "blur");
    expect(screen.queryByText("Format email belum benar.")).toBeNull();
  });

  it("re-checks on change once shown", () => {
    render(<Form />);
    const input = screen.getByLabelText("Email");
    fireEvent.changeText(input, "abc");
    fireEvent(input, "blur");
    fireEvent.changeText(input, "a@b.co");
    expect(screen.queryByText("Format email belum benar.")).toBeNull();
    fireEvent.changeText(input, "a@b");
    expect(screen.getByText("Format email belum benar.")).toBeTruthy();
  });

  it("submit focuses the first failing field and announces the count", () => {
    const spy = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const onRun = jest.fn();
    render(<Form onRun={onRun} />);
    fireEvent.press(screen.getByText("Kirim"));
    expect(spy).toHaveBeenCalledWith("2 isian perlu diperbaiki");
    expect(screen.getByText("Tulis namamu.")).toBeTruthy();
    expect(onRun).not.toHaveBeenCalled();
    expect(focusName).toHaveBeenCalledTimes(1);
  });

  it("submit runs when all checks pass", () => {
    const onRun = jest.fn();
    render(<Form onRun={onRun} />);
    fireEvent.changeText(screen.getByLabelText("Nama"), "Sari");
    fireEvent.changeText(screen.getByLabelText("Email"), "a@b.co");
    fireEvent.press(screen.getByText("Kirim"));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("PasswordRule announces met once", () => {
    const spy = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    spy.mockClear();
    const view = render(<PasswordRule value="abc" failed={false} />);
    expect(spy).not.toHaveBeenCalled();
    view.rerender(<PasswordRule value="abcdefgh" failed={false} />);
    view.rerender(<PasswordRule value="abcdefghi" failed={false} />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("Syarat kata sandi terpenuhi");
    expect(screen.getByText("Minimal 8 karakter")).toBeTruthy();
  });

  it("PasswordRule failed and short shows danger text with the alert glyph", () => {
    render(<PasswordRule value="abc" failed />);
    expect(screen.getByText("Minimal 8 karakter")).toBeTruthy();
    expect(screen.getByTestId("password-rule").findByType(Ionicons).props.name).toBe("alert-circle");
  });

  it("submit with one failing field announces the singular count in English", () => {
    const spy = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    spy.mockClear();
    const view = render(<Form />);
    fireEvent.changeText(screen.getByLabelText("Nama"), "Sari");
    fireEvent.press(screen.getByText("Kirim"));
    expect(spy).toHaveBeenCalledWith("1 isian perlu diperbaiki");
    view.unmount();
  });

  it("PasswordMatch quiet until the second field is as long as the first", () => {
    const view = render(<PasswordMatch first="abcdefgh" second="abc" touched={false} />);
    expect(screen.queryByTestId("password-match")).toBeNull();
    view.rerender(<PasswordMatch first="abcdefgh" second="abcdefgx" touched={false} />);
    expect(screen.getByText("Kata sandinya belum sama.")).toBeTruthy();
    view.rerender(<PasswordMatch first="abcdefgh" second="abcdefgh" touched={false} />);
    expect(screen.getByText("Kata sandinya sama")).toBeTruthy();
  });

  it("toggling a controlled PasswordField pair shows both", () => {
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
    render(<Pair />);
    expect(screen.getByLabelText("Sandi").props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getAllByLabelText("Tampilkan")[0]);
    expect(screen.getByLabelText("Sandi").props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText("Ulangi").props.secureTextEntry).toBe(false);
  });

  it("FormError action calls onPress, and retry still works", () => {
    const onPress = jest.fn();
    const retry = jest.fn();
    const view = render(<FormError message="x" action={{ label: "Kirim lagi", onPress }} />);
    fireEvent.press(screen.getByText("Kirim lagi"));
    expect(onPress).toHaveBeenCalled();
    view.rerender(<FormError message="x" retry={retry} />);
    fireEvent.press(screen.getByText("Coba lagi"));
    expect(retry).toHaveBeenCalled();
  });
});
