import { FixturesPageClient } from "@/components/fixtures/fixtures-page-client";
import { getTodayGMT1, getRollingTwoWeekDates, getDateLabel } from "@/lib/date";
import { getFixturesWithPredictions, getDailyFixtures } from "@/lib/kv";
import type { FixtureWithPrediction } from "@/types";

export const dynamic = "force-dynamic";

export interface FixturesByDate {
  date: string;
  label: string;
  fixtures: FixtureWithPrediction[];
  total: number;
}

export default async function HomePage() {
  const today = getTodayGMT1();
  // Fetch full 2-week window (UI_UX_SPEC: default shows 72h, date tabs for rest)
  const allDates = getRollingTwoWeekDates();

  // Fetch fixtures for all dates
  const fixturesByDate: FixturesByDate[] = await Promise.all(
    allDates.map(async (date) => {
      const fixtures = (await getFixturesWithPredictions(date)) || [];
      const allFixtures = await getDailyFixtures(date);
      const total = allFixtures?.length || 0;

      return {
        date,
        label: getDateLabel(date),
        fixtures,
        total,
      };
    })
  );

  return (
    <FixturesPageClient
      today={today}
      fixturesByDate={fixturesByDate}
    />
  );
}
