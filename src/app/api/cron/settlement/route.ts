/**
 * Post-Match Settlement Cron Job
 * Schedule: 23:00 GMT+1 daily (22:00 UTC)
 *
 * 1. Fetch final scores for finished matches
 * 2. Evaluate predictions
 * 3. Record outcomes in history
 * 4. Update aggregate stats
 */

import { NextRequest, NextResponse } from "next/server";
import { getTodayGMT1, nowGMT1 } from "@/lib/date";
import { setJobLastRun } from "@/lib/kv";
import { settleFixturesForDate } from "@/services/settlement";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayGMT1();
  console.log(`[Settlement] Starting cron job for ${today}`);

  try {
    const result = await settleFixturesForDate(today);

    // Record job execution
    await setJobLastRun("settlement", nowGMT1());

    console.log("[Settlement] Cron job completed:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Settlement] Cron job failed:", error);
    return NextResponse.json(
      { error: "Job failed", details: String(error) },
      { status: 500 }
    );
  }
}
