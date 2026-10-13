import { BahasaSheet, TampilanSheet as SharedTampilanSheet } from "@catera/mobile-ui";

/** The choice sheets live in mobile-ui; the customer app still says "Anda" in the Tampilan note until the copy pass. */
export { BahasaSheet };
export const TampilanSheet = () => <SharedTampilanSheet voice="Anda" />;
