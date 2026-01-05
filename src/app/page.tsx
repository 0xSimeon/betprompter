import { FixturesPageClient } from "@/components/fixtures/fixtures-page-client";
import { getTodayGMT1 } from "@/lib/date";
import { getFixturesWithPredictions, getSelectedFixtures, getDailyFixtures } from "@/lib/kv";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = getTodayGMT1();

  // Fetch fixtures from KV (will be empty until cron jobs populate data)
  let fixtures = await getFixturesWithPredictions(today);
  let total = 0;

  const allFixtures = await getDailyFixtures(today);
  if (allFixtures) {
    total = allFixtures.length;
  }

  // If no data yet, use empty array (UI will show empty state)
  if (!fixtures) {
    fixtures = [];
  }

  return (
    <FixturesPageClient
      initialDate={today}
      initialFixtures={fixtures}
      totalFixtures={total}
    />
  );
}
