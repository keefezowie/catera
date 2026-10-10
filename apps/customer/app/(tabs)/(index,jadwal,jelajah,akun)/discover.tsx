import { useRedirectToTab } from "../../../src/nav";

// Old /discover links (web hrefs, older notifications) select Jelajah.
export default function Discover() {
  useRedirectToTab("jelajah");
  return null;
}
