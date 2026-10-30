import { screen, within } from "@testing-library/react-native";

/** The strip's day tab `offset` days from today (0 today, 1 Besok). The Siang / Malam switch is a tab pair of its own. */
export const dayTab = (offset: number) => within(screen.getByTestId("week-strip")).getAllByRole("tab")[offset];
