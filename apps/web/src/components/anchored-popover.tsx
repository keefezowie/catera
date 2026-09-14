"use client";

import * as Popover from "@radix-ui/react-popover";
import { useRef, type ComponentProps, type ReactNode } from "react";
import { OverlayLevel, useOverlayLevel } from "./overlay";

type Props = ComponentProps<typeof Popover.Content> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
};

/** A non-modal child surface; Radix owns focus, dismissal and collision handling. */
export function AnchoredPopover({
  open,
  onOpenChange,
  trigger,
  children,
  ...props
}: Props) {
  const level = useOverlayLevel() + 2;
  const content = useRef<HTMLDivElement>(null);
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          {...props}
          ref={content}
          style={{ ...props.style, zIndex: level }}
          onOpenAutoFocus={(event) => {
            props.onOpenAutoFocus?.(event);
            const day = content.current?.querySelector<HTMLElement>(
              '[data-calendar-day][tabindex="0"]',
            );
            if (!event.defaultPrevented && day) {
              event.preventDefault();
              day.focus({ preventScroll: true });
            }
          }}
        >
          <OverlayLevel.Provider value={level}>
            {children}
          </OverlayLevel.Provider>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
