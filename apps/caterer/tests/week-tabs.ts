import { screen } from "@testing-library/react-native";
import { jakartaDay } from "@catera/domain";

/** The calendar's day tab `offset` days from today (0 today, 1 Besok), by its date; the clock is pinned by the test. */
export const dayTab = (offset: number) => screen.getByTestId(`week-day-${jakartaDay(new Date(), offset)}`);
