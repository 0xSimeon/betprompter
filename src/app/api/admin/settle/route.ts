/**
 * Manual Settlement Endpoint
 * GET /api/admin/settle?date=YYYY-MM-DD
 *
 * Allows manual triggering of settlement for a specific date.
 * Useful for:
 * - Catching up on missed settlements
 * - Re-running settlement after late match finishes
 * - Testing settlement logic
 */

import { NextRequest, NextResponse } from "next/server";
import { settleFixturesForDate } from "@/services/settlement";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: "Missing date parameter. Use ?date=YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }

  console.log(`[Manual Settlement] Running settlement for ${date}`);

  try {
    const result = await settleFixturesForDate(date);

    console.log("[Manual Settlement] Completed:", result);
    return NextResponse.json({
      ...result,
      message: `Manual settlement for ${date} completed`,
    });
  } catch (error) {
    console.error("[Manual Settlement] Failed:", error);
    return NextResponse.json(
      { error: "Settlement failed", details: String(error) },
      { status: 500 }
    );
  }
}
