import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * Whether the on-screen keyboard is up, and its height (0 while it is down). iOS announces it a beat earlier (`will`),
 * Android only when it is shown (`did`). On an edge-to-edge Android window the keyboard draws over the page instead of
 * resizing it, so a screen that must keep its action visible adds this height under its content.
 */
export function useKeyboard(): { up: boolean; height: number } {
  const [state, setState] = useState({ up: false, height: 0 });
  useEffect(() => {
    const ios = process.env.EXPO_OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e?: { endCoordinates?: { height?: number } }) =>
      setState({ up: true, height: Math.max(0, Math.round(e?.endCoordinates?.height ?? 0)) }),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setState({ up: false, height: 0 }));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return state;
}
