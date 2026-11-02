import { useCallback, useRef, useState, type RefObject } from "react";
import { AccessibilityInfo, type TextInput, type TextInputInstance } from "react-native";
import { useHaptic } from "../motion/useHaptic";
import { useT } from "../useT";

type Fields<K extends string> = Record<K, { value: string; check: (v: string) => string }>;

/**
 * Inline validation (spec 3.1): quiet while typing the first time, checked on blur when there is text, re-checked on
 * every change once shown. `submit` checks everything, focuses the first failing field and announces the count.
 */
export function useFieldCheck<K extends string>(fields: Fields<K>) {
  const t = useT();
  const haptic = useHaptic();
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const refs = useRef<Partial<Record<K, RefObject<TextInputInstance | null>>>>({});
  const keys = Object.keys(fields) as K[];
  const messageOf = (k: K) => fields[k].check(fields[k].value);
  const touch = (ks: K[]) => setTouched((prev) => ({ ...prev, ...Object.fromEntries(ks.map((k) => [k, true])) }));

  const messages: Partial<Record<K, string>> = {};
  for (const k of keys) if (touched[k]) messages[k] = messageOf(k);

  const fieldProps = (k: K) => {
    refs.current[k] ??= { current: null };
    return {
      error: messages[k] || undefined,
      onBlur: () => {
        if (fields[k].value) touch([k]);
      },
      inputRef: refs.current[k] as RefObject<TextInputInstance>,
    };
  };

  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const submit = useCallback(
    (run: () => void) => {
      const all = Object.keys(fieldsRef.current) as K[];
      touch(all);
      const failing = all.filter((k) => fieldsRef.current[k].check(fieldsRef.current[k].value));
      if (!failing.length) return run();
      refs.current[failing[0]]?.current?.focus();
      haptic.error();
      AccessibilityInfo.announceForAccessibility(
        (failing.length === 1 ? t("{n} isian perlu diperbaiki", "1 field needs fixing") : t("{n} isian perlu diperbaiki", "{n} fields need fixing")).replace("{n}", String(failing.length)),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run reads the latest fields through fieldsRef; touch is a stable setState wrapper
    [haptic, t],
  );

  const reset = () => setTouched({});
  return { fieldProps, submit, messages, reset };
}
