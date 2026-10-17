import { BahasaSheet, TampilanSheet as SharedTampilanSheet } from "@catera/mobile-ui";

/** The choice sheets live in mobile-ui; the Tampilan note speaks in "kamu", as the whole app does. */
export { BahasaSheet };
export const TampilanSheet = () => <SharedTampilanSheet voice="kamu" />;
