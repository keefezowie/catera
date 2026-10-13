import { BahasaSheet, TampilanSheet as SharedTampilanSheet } from "@catera/mobile-ui";

/** The choice sheets live in mobile-ui; Dapur speaks to its staff as "kamu". */
export { BahasaSheet };
export const TampilanSheet = () => <SharedTampilanSheet voice="kamu" />;
