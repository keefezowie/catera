"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  animateSurface,
  contentFrames,
  prefersReducedMotion,
  reducedMotionQuery,
  webMotion,
} from "@/lib/motion";

/** Keep Radix's focus trap and layer registration alive for the brief exit. */
export function useExitPresence(open: boolean) {
  const [previous, setPrevious] = useState(open);
  const [retained, setRetained] = useState(open);
  if (previous !== open) {
    setPrevious(open);
    setRetained(open || !prefersReducedMotion());
  }
  useEffect(() => {
    if (open || !retained) return;
    const media = window.matchMedia(reducedMotionQuery);
    const finish = () => setRetained(false);
    const changed = () => {
      if (media.matches) finish();
    };
    const timer = window.setTimeout(finish, webMotion.control);
    media.addEventListener("change", changed);
    changed();
    return () => {
      clearTimeout(timer);
      media.removeEventListener("change", changed);
    };
  }, [open, retained]);
  return open || retained;
}

/** Animate a committed state change without keying/remounting its form or controls. */
export function useContentMotion(
  ref: RefObject<HTMLElement | null>,
  value: string | number,
  {
    initial = false,
    ready = true,
    directional = false,
    visibleChildren = false,
  } = {},
) {
  const previous = useRef<string | number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    const before = previous.current;
    previous.current = value;
    if (before === value || (before === undefined && !initial)) return;
    const direction =
      directional && typeof before === "number" && typeof value === "number"
        ? Math.sign(value - before)
        : 0;
    // Catalogs may be long: only the visible cards enter, together, without a list-sized layer.
    const targets = visibleChildren
      ? Array.from(ref.current.children).filter((child) => {
          const bounds = child.getBoundingClientRect();
          return bounds.bottom > 0 && bounds.top < window.innerHeight;
        })
      : [ref.current];
    const stops = targets.map((target) =>
      animateSurface(target, contentFrames(direction)),
    );
    return () => stops.forEach((stop) => stop());
  }, [ref, value, initial, ready, directional, visibleChildren]);
}

/** Only the incoming heading moves. Persistent chrome, lists and forms stay mounted. */
export function RouteMotion({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = root.current;
    // Confirmed payment owns its artwork/checkmark moment, without a second route entrance.
    if (!container || path.startsWith("payment/")) return;
    let stop: (() => void) | undefined;
    const reveal = () => {
      const heading = container.querySelector(
        ".page-heading, .detail-heading, .login-story h1, .catalog-heading, .empty h2",
      );
      if (!heading) return false;
      stop = animateSurface(heading, contentFrames());
      return true;
    };
    // Data and dynamic route components can become ready after the route commits.
    const observer = new MutationObserver(() => {
      if (reveal()) observer.disconnect();
    });
    if (!reveal())
      observer.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      stop?.();
    };
  }, [path]);
  return (
    <div ref={root} className="route-motion" data-motion-route={path}>
      {children}
    </div>
  );
}
