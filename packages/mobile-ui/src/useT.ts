import { useMobile } from "@catera/mobile-core";

/** The app's translator, or Indonesian as written when no provider is mounted (isolated component tests). */
export function useT(): (id: string, en: string) => string {
  const mobile = useMobile() as { t?: (id: string, en: string) => string } | null;
  return mobile?.t ?? ((id) => id);
}
