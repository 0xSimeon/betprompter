import { FixturesPageClient } from "@/components/fixtures/fixtures-page-client";
import { getTodayGMT1, getCurrentWeekDates, getDateLabel } from "@/lib/date";
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
  const weekDates = getCurrentWeekDates();

  // Fetch fixtures for each day of the week
  const fixturesByDate: FixturesByDate[] = await Promise.all(
    weekDates.map(async (date) => {
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
