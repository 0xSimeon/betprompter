import { HistoryPageClient } from "@/components/history";
import { getStats, getMonthlyHistory } from "@/lib/kv";
import { formatYearMonthGMT1 } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const currentMonth = formatYearMonthGMT1(new Date());

  // Fetch stats and current month's history
  const [stats, outcomes] = await Promise.all([
    getStats(),
    getMonthlyHistory(currentMonth),
  ]);

  // Generate available months (last 6 months)
  const availableMonths: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    availableMonths.push(formatYearMonthGMT1(date));
  }

  return (
    <HistoryPageClient
      initialStats={stats}
      initialOutcomes={outcomes || []}
      availableMonths={availableMonths}
      initialMonth={currentMonth}
    />
  );
}
