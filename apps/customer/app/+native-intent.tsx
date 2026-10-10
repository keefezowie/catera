import { systemPath } from "../src/nav";

/** OS links (pushes opened by the system, exp:// and catera:// links): a tab root selects its tab; a cold Ada masalah
 * link opens its Hari first (`systemPath`). */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  return systemPath(path, initial);
}
