import { FixturesPageClient } from "@/components/fixtures/fixtures-page-client";
import { getTodayGMT1, get72HourWindowDates, getDateLabel } from "@/lib/date";
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
  // Per UI_UX_SPEC: Homepage default is 72h window (today + 1-2 days)
  const displayDates = get72HourWindowDates();

  // Fetch fixtures for each day in the 72h window
  const fixturesByDate: FixturesByDate[] = await Promise.all(
    displayDates.map(async (date) => {
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
