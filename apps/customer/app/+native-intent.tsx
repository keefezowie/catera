import { systemPath } from "../src/nav";

/** OS links (pushes opened by the system, exp:// and catera:// links): a tab root selects its tab. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return systemPath(path);
}
