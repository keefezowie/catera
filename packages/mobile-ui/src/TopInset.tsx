import { createContext, useContext, type ReactNode } from "react";

const TopInsetOwned = createContext(false);

/**
 * Says who pays for the status-bar inset. While the demo strip is shown it sits above the stack and owns the
 * inset, so `Screen`, `MoodHeader` and the Android native header below it must not add a second one.
 */
export function TopInsetOwner({ owned, children }: { owned: boolean; children: ReactNode }) {
  return <TopInsetOwned.Provider value={owned}>{children}</TopInsetOwned.Provider>;
}

/** True when something above this screen already covers the status-bar inset. */
export function useTopInsetOwned(): boolean {
  return useContext(TopInsetOwned);
}
