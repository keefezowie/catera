/** Web-only timing. Keep the existing shared/native motion contract unchanged. */
export const webMotion = {
  control: 120,
  selection: 180,
  content: 220,
  feature: 320,
  ease: "cubic-bezier(.16,1,.3,1)",
  exit: "cubic-bezier(.4,0,1,1)",
} as const;

export const webMotionVariables = {
  "--motion-control": `${webMotion.control}ms`,
  "--motion-selection": `${webMotion.selection}ms`,
  "--motion-content": `${webMotion.content}ms`,
  "--motion-feature": `${webMotion.feature}ms`,
  "--motion-ease": webMotion.ease,
  "--motion-exit": webMotion.exit,
};

export const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
export const prefersReducedMotion = () =>
  typeof window === "undefined" ||
  window.matchMedia(reducedMotionQuery).matches;

const running = new WeakMap<Element, () => void>();

/** The DOM always holds the final state; cancelling never hides usable content. */
export function animateSurface(
  element: Element,
  frames: Keyframe[],
  options: KeyframeAnimationOptions = {},
): () => void {
  running.get(element)?.();
  if (prefersReducedMotion() || !element.animate) return () => {};
  const media = window.matchMedia(reducedMotionQuery);
  const animation = element.animate(frames, {
    duration: webMotion.content,
    easing: webMotion.ease,
    ...options,
  });
  const cleanup = () => {
    media.removeEventListener("change", changed);
    if (running.get(element) === cancel) running.delete(element);
  };
  const cancel = () => {
    animation.cancel();
    cleanup();
  };
  const changed = () => {
    if (media.matches) cancel();
  };
  running.set(element, cancel);
  media.addEventListener("change", changed);
  animation.finished.then(cleanup, cleanup);
  return cancel;
}

export function contentFrames(direction = 0): Keyframe[] {
  return [
    {
      opacity: 0.65,
      transform: direction
        ? `translateX(${direction * 8}px)`
        : "translateY(6px)",
    },
    { opacity: 1, transform: "translate(0, 0)" },
  ];
}

const scrolling = new WeakMap<HTMLElement, () => void>();

/** Smooth scroll is functional motion too, including a preference change mid-scroll. */
export function scrollSurface(
  element: HTMLElement | null,
  left: number,
  { relative = true, animate = true } = {},
) {
  if (!element) return;
  scrolling.get(element)?.();
  const media = window.matchMedia(reducedMotionQuery);
  const scroll = (behavior: ScrollBehavior) =>
    relative
      ? element.scrollBy({ left, behavior })
      : element.scrollTo({ left, behavior });
  if (!animate || media.matches) {
    scroll("auto");
    return;
  }
  const stop = () => {
    element.scrollTo({ left: element.scrollLeft, behavior: "instant" });
    cleanup();
  };
  const changed = () => {
    if (media.matches) stop();
  };
  const cleanup = () => {
    media.removeEventListener("change", changed);
    element.removeEventListener("scrollend", cleanup);
    clearTimeout(timer);
    if (scrolling.get(element) === stop) scrolling.delete(element);
  };
  const timer = window.setTimeout(cleanup, 1500);
  scrolling.set(element, stop);
  media.addEventListener("change", changed);
  element.addEventListener("scrollend", cleanup, { once: true });
  scroll("smooth");
}
