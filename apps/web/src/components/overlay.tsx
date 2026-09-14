"use client";

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";

// Registration order handles sibling confirmations as well as nested previews.
let layers: string[] = [];
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const publish = () => listeners.forEach((listener) => listener());
const snapshot = () => layers;
const empty: string[] = [];
export const OverlayLevel = createContext(100);
export const FormPending = createContext(false);
export const useFormPending = () => useContext(FormPending);
export const useOverlayLevel = () => useContext(OverlayLevel);

export function useDialogLayer(open: boolean) {
  const id = useId();
  const stack = useSyncExternalStore(subscribe, snapshot, () => empty);
  useLayoutEffect(() => {
    if (!open) return;
    layers = [...layers, id];
    publish();
    return () => {
      layers = layers.filter((layer) => layer !== id);
      publish();
    };
  }, [id, open]);
  const index = stack.indexOf(id);
  return {
    level: 120 + Math.max(0, index) * 10,
    inactive: index >= 0 && stack.at(-1) !== id,
  };
}
