import { HelpForm } from "../../src/help/HelpForm";
import { flowSheet } from "../../src/flowSheet";

/** The help form over a purchase; opened cold, it gives way to the tab's form over Bantuan. */
export default flowSheet(HelpForm, "/bantuan-form");
