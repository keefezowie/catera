import { useCallback, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import type { StoryPart } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";

/** Which part of which delivery: the id a viewed mark is kept under. */
export const partId = (part: Pick<StoryPart, "deliveryId" | "meal">) => `${part.deliveryId}.${part.meal}`;

// The row on Beranda stays mounted behind the story, so a mark written there has to reach it. Each hook that reads the
// marks listens here, and a write tells them to read again; nothing about a mark is kept in memory between reads.
const listeners = new Set<() => void>();

/**
 * Which parts of tomorrow's story the customer has opened, kept on the phone only (one SecureStore key per delivery and
 * meal, value "seen"). Until the marks have been read the set is empty, so a covered plate never shows a dish early.
 */
export function useViewedParts(parts: StoryPart[]): { viewed: Set<string>; markViewed: (part: StoryPart) => void } {
  const { runtime } = useMobile();
  const [viewed, setViewed] = useState<Set<string>>(() => new Set());
  const ids = parts.map(partId);
  const signature = ids.join("|");

  const read = useCallback(async () => {
    const wanted = signature ? signature.split("|") : [];
    const marks = await Promise.all(
      wanted.map((id) =>
        SecureStore.getItemAsync(runtime.storageKey(`story.${id}`))
          .catch(() => null)
          .then((value) => (value === "seen" ? id : null)),
      ),
    );
    return new Set(marks.filter((id): id is string => id !== null));
  }, [runtime, signature]);

  useEffect(() => {
    let live = true;
    const refresh = () => {
      void read().then((next) => {
        if (live) setViewed(next);
      });
    };
    refresh();
    listeners.add(refresh);
    return () => {
      live = false;
      listeners.delete(refresh);
    };
  }, [read]);

  // A part is written once per hook; showing it again changes nothing.
  const written = useRef(new Set<string>());
  const markViewed = useCallback(
    (part: StoryPart) => {
      const id = partId(part);
      if (written.current.has(id)) return;
      written.current.add(id);
      setViewed((prev) => new Set(prev).add(id));
      void SecureStore.setItemAsync(runtime.storageKey(`story.${id}`), "seen")
        .catch(() => undefined)
        .then(() => listeners.forEach((l) => l()));
    },
    [runtime],
  );

  return { viewed, markViewed };
}
