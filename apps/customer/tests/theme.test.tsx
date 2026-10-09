import { act, render, screen, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ThemeProvider, themedStyles, useColors, useThemePreference } from "@catera/mobile-ui";

// The customer setup has no SecureStore mock, so this file keeps its own in-memory one. getItemAsync is a jest.fn
// that tests can make reject.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const LIGHT_CANVAS = "#FDFAF3";
const DARK_CANVAS = "#151514";
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

let setPreferenceRef: (p: "system" | "light" | "dark") => void = () => {};

function Probe() {
  const colors = useColors();
  const { preference, setPreference } = useThemePreference();
  setPreferenceRef = setPreference;
  return (
    <View>
      <Text testID="canvas">{colors.canvas}</Text>
      <Text testID="preference">{preference}</Text>
    </View>
  );
}

function mockSystemScheme(scheme: "light" | "dark" | null) {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
}

const text = (id: string) => screen.getByTestId(id).props.children;

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockSystemScheme("light");
});

describe("theme", () => {
  it("uses the light palette with no provider", () => {
    render(<Probe />);
    expect(text("canvas")).toBe(LIGHT_CANVAS);
  });

  it("follows the system scheme by default", async () => {
    mockSystemScheme("dark");
    render(
      <ThemeProvider storageKey="k">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("k"));
    expect(text("canvas")).toBe(DARK_CANVAS);
    expect(text("preference")).toBe("system");
  });

  it("treats a null system scheme as light", async () => {
    mockSystemScheme(null);
    render(
      <ThemeProvider storageKey="k">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalled());
    expect(text("canvas")).toBe(LIGHT_CANVAS);
  });

  it("applies a stored preference", async () => {
    store.set("k", "dark");
    mockSystemScheme("light");
    render(
      <ThemeProvider storageKey="k">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(text("canvas")).toBe(DARK_CANVAS));
    expect(text("preference")).toBe("dark");
  });

  it("ignores an unknown stored value", async () => {
    store.set("k", "blue");
    mockSystemScheme("dark");
    render(
      <ThemeProvider storageKey="k">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("k"));
    expect(text("preference")).toBe("system");
    expect(text("canvas")).toBe(DARK_CANVAS);
  });

  it("survives a failing storage read", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error("keystore locked"));
    render(
      <ThemeProvider storageKey="k">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("k"));
    expect(text("preference")).toBe("system");
    expect(text("canvas")).toBe(LIGHT_CANVAS);
  });

  it("setPreference stores and applies immediately", async () => {
    render(
      <ThemeProvider storageKey="k">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("k"));
    act(() => setPreferenceRef("dark"));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("k", "dark");
    expect(text("canvas")).toBe(DARK_CANVAS);
    expect(text("preference")).toBe("dark");
  });

  it("keeps the choice in memory when the write fails", async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error("disk full"));
    render(
      <ThemeProvider storageKey="k">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("k"));
    act(() => setPreferenceRef("dark"));
    await act(async () => {});
    expect(text("canvas")).toBe(DARK_CANVAS);
  });

  it("themedStyles memoises per theme", async () => {
    const useStyles = themedStyles((c) => ({ box: { backgroundColor: c.canvas } }));
    const seen: Array<ReturnType<typeof useStyles>> = [];
    function Styled() {
      const a = useStyles();
      const b = useStyles();
      seen.push(a, b);
      return <View testID="box" style={a.box} />;
    }
    render(
      <ThemeProvider storageKey="k">
        <Styled />
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("k"));
    expect(seen[0]).toBe(seen[1]);
    expect(ReactNative.StyleSheet.flatten(screen.getByTestId("box").props.style).backgroundColor).toBe(LIGHT_CANVAS);

    act(() => setPreferenceRef("dark"));
    const last = seen[seen.length - 1];
    expect(ReactNative.StyleSheet.flatten(screen.getByTestId("box").props.style).backgroundColor).toBe(DARK_CANVAS);
    expect(seen[seen.length - 2]).toBe(last);
    expect(last).not.toBe(seen[0]);
  });
});
