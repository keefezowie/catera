import { useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { addDays, calendarDays, jakartaDay, type CustomerState } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { FadeSwap, MoodHeader, PressableScale, ReadError, Screen, StateArt, Text, useMoodColors } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { usePullToRefresh } from "../refresh";
import { JadwalCellsSkeleton } from "../skeletons";
import { CalendarLegend, MonthFrame, MonthGrid } from "./MonthGrid";
import { monthFullWeeks, monthOf, monthReadRange, monthTitle, shiftMonth } from "./dates";
import { WeekAgenda } from "./WeekAgenda";

/** The legend explains the cells and claims nothing about the month, so it holds its place in every state. */
function Legend() {
  const { t } = useMobile();
  return (
    <CalendarLegend
      labels={{
        delivery: t("Ada pengantaran", "Delivery"),
        unset: t("Menu belum diisi", "Menu not set"),
      }}
    />
  );
}

/**
 * The month band's title row: the month in `heroTitle` and, once there is a session, the two 44 chevrons. The header
 * already insets its row by the screen margin, so the title lines up with the agenda below.
 */
function MonthBar({
  month,
  chevrons,
  testID,
  children,
}: {
  month: string;
  chevrons?: ReactNode;
  testID?: string;
  children: ReactNode;
}) {
  const { locale } = useMobile();
  const mood = useMoodColors();
  return (
    <MoodHeader
      testID={testID}
      meta={
        <Text variant="heroTitle" style={{ color: mood.headerText }}>
          {monthTitle(month, locale)}
        </Text>
      }
      title={null}
      trailing={chevrons}
    >
      {children}
    </MoodHeader>
  );
}

/** Jadwal: the month at a glance and the week you are looking at. */
export function Jadwal() {
  const { actor, ready, t, locale } = useMobile();
  // Before the session is known, the header and this month's frame are already in place; only the cells wait.
  if (!ready) {
    const month = monthOf(jakartaDay(new Date()));
    return (
      <Screen
        header={
          <MonthBar month={month}>
            <JadwalCellsSkeleton month={month} locale={locale} />
            <Legend />
          </MonthBar>
        }
      >
        {null}
      </Screen>
    );
  }
  if (!actor) return <SignInFirst title={t("Jadwal", "Schedule")} next="/jadwal" headerTestID="jadwal-header" />;
  return <SignedInJadwal />;
}

function SignedInJadwal() {
  const { runtime, t, locale } = useMobile();
  const mood = useMoodColors();
  const today = jakartaDay(new Date());
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState(today);
  // Whole weeks: from the Monday of the month's first week to the Sunday of its last, so the agenda for a week that
  // straddles two months is complete. The grid still draws only the month's own days.
  const { from, to } = monthReadRange(month);
  const data = useData(`jadwal:${month}`, () => runtime.api.customer(`?from=${from}&to=${to}`));
  const state: CustomerState | null = data.data;
  const pull = usePullToRefresh(data.reload);

  const deliveries = useMemo(() => state?.deliveries ?? [], [state]);
  const days = useMemo(() => calendarDays(deliveries), [deliveries]);
  // No meal comes this month: every delivery of its own days is cancelled, or every meal of it is.
  const monthEmpty = !deliveries.some(
    (d) => monthOf(d.service_date) === month && d.status !== "cancelled" && (d.meals ?? []).some((m) => m.status !== "cancelled"),
  );

  // The whole week of the selected day, and the one after it (a Monday in the next month when this is the last row).
  const weeks = monthFullWeeks(month);
  const row = Math.max(0, weeks.findIndex((w) => w.includes(selected)));
  const week = weeks[row];
  const next = week.map((d) => addDays(d, 7));

  // Moving the month picks today in it, or its first day; a week opened from the agenda picks its own first day.
  const goToMonth = (m: string) => {
    setMonth(m);
    setSelected(monthOf(today) === m ? today : `${m}-01`);
  };
  const openWeek = (first: string) => {
    setMonth(monthOf(first));
    setSelected(first);
  };

  // The month moves from the header's trailing slot. The chevrons sit on the header, so they read its mood text colour.
  const chevrons = (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t("Bulan sebelumnya", "Previous month")}
        onPress={() => goToMonth(shiftMonth(month, -1))}
        style={arrow}
      >
        <Ionicons name="chevron-back" size={22} color={mood.headerText} />
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t("Bulan berikutnya", "Next month")}
        onPress={() => goToMonth(shiftMonth(month, 1))}
        style={arrow}
      >
        <Ionicons name="chevron-forward" size={22} color={mood.headerText} />
      </PressableScale>
    </View>
  );

  return (
    <Screen
      header={
        // The tab bar already names this tab, so the row holds the month and its arrows.
        <MonthBar testID="jadwal-header" month={month} chevrons={chevrons}>
          {/* The loaded grid and the frame that stands in for it while the month loads (a skeleton circle per day) are
              the same height: the weekday row and the month's own week rows, and the legend stays below. A month that
              could not be read keeps room for its message. The month fades in from its skeleton as one block. The grid
              spans the header's content width. */}
          <FadeSwap
            swapKey={state ? `${month}:ready` : data.error ? `${month}:error` : `${month}:loading`}
          >
            {state ? (
              <MonthGrid month={month} today={today} selected={selected} days={days} locale={locale} onSelect={setSelected} />
            ) : data.error ? (
              // Nothing is known about this month yet, so the frame says that instead of drawing its days as empty. The
              // failed read is the month, so the puzzled mascot leads it (spec 7.2), inside the frame: the art (120, or
              // 96 on a 360dp phone at font scale 1.3), the message and the 48dp retry fit its six 40dp rows.
              <MonthFrame month={month} locale={locale}>
                <View style={{ gap: 4, alignItems: "center" }}>
                  <StateArt pose="bingung" style={{ marginBottom: 8 }} />
                  <Text selectable style={{ color: mood.headerText, textAlign: "center" }}>
                    {data.error}
                  </Text>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t("Coba lagi", "Try again")}
                    onPress={() => void data.reload()}
                    style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center" }}
                  >
                    <Text variant="label" style={{ color: mood.headerText, textDecorationLine: "underline" }}>
                      {t("Coba lagi", "Try again")}
                    </Text>
                  </PressableScale>
                </View>
              </MonthFrame>
            ) : (
              <JadwalCellsSkeleton month={month} locale={locale} />
            )}
          </FadeSwap>
          <Legend />
        </MonthBar>
      }
      // Pulling down reads this month again; the grid and the agenda stay on screen until it answers.
      refreshControl={state ? pull : undefined}
    >
      {/* The agenda fades in with the month: this and the grid's FadeSwap swap on the same read, over the same time.
          While the month is read the panel is empty rather than a second skeleton. */}
      <FadeSwap swapKey={state ? "ready" : "loading"} style={{ gap: nativeLayout.space.lg }}>
        {state ? (
          <>
            {data.error ? (
              // A refresh failed but the month is on screen: the error stays with its retry in the page.
              <ReadError message={data.error} onRetry={() => void data.reload()} />
            ) : null}
            {/* A month with no meals at all: the resting mascot sits above the agenda, which says there is nothing. */}
            {monthEmpty ? <StateArt pose="tidur" /> : null}
            <WeekAgenda
              week={week}
              next={next}
              today={today}
              deliveries={deliveries}
              days={days}
              apiBase={runtime.apiBase}
              locale={locale}
              onOpenWeek={openWeek}
            />
          </>
        ) : null}
      </FadeSwap>
    </Screen>
  );
}

const arrow = {
  width: nativeLayout.control.icon,
  height: nativeLayout.control.icon,
  alignItems: "center",
  justifyContent: "center",
} as const;
