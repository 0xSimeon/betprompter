/**
 * Date/time utilities
 * All operations in GMT+1 (Nigeria timezone)
 */

import { TIMEZONE } from "@/config/constants";

/**
 * Get current date in GMT+1 as YYYY-MM-DD
 */
export function getTodayGMT1(): string {
  return formatDateGMT1(new Date());
}

/**
 * Format a Date object to YYYY-MM-DD in GMT+1
 */
export function formatDateGMT1(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * Format a Date object to YYYY-MM in GMT+1
 */
export function formatYearMonthGMT1(date: Date): string {
  const full = formatDateGMT1(date);
  return full.slice(0, 7);
}

/**
 * Get current datetime as ISO string in GMT+1
 */
export function nowGMT1(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: TIMEZONE }).replace(" ", "T") + "+01:00";
}

/**
 * Convert UTC ISO string to GMT+1 ISO string
 */
export function utcToGMT1(utcString: string): string {
  const date = new Date(utcString);
  const gmt1String = date.toLocaleString("sv-SE", { timeZone: TIMEZONE });
  return gmt1String.replace(" ", "T") + "+01:00";
}

/**
 * Format kickoff time for display (e.g., "5:30 PM")
 */
export function formatKickoffTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format full date for display (e.g., "Monday, 5 January 2026")
 */
export function formatFullDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-GB", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format short date for display (e.g., "Mon, 5 Jan")
 */
export function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Get minutes until kickoff
 */
export function minutesUntilKickoff(kickoffIso: string): number {
  const kickoff = new Date(kickoffIso).getTime();
  const now = Date.now();
  return Math.floor((kickoff - now) / (1000 * 60));
}

/**
 * Check if a fixture is within the lineup refresh window (50-55 min before kickoff)
 */
export function isInLineupRefreshWindow(kickoffIso: string): boolean {
  const minutes = minutesUntilKickoff(kickoffIso);
  return minutes >= 50 && minutes <= 55;
}

/**
 * Check if a fixture has started
 */
export function hasKickedOff(kickoffIso: string): boolean {
  return new Date(kickoffIso).getTime() <= Date.now();
}

/**
 * Get relative time string (e.g., "5 min ago", "in 2 hours")
 */
export function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (Math.abs(diffMins) < 60) {
    if (diffMins === 0) return "now";
    if (diffMins > 0) return `in ${diffMins} min`;
    return `${Math.abs(diffMins)} min ago`;
  }

  if (Math.abs(diffHours) < 24) {
    if (diffHours > 0) return `in ${diffHours}h`;
    return `${Math.abs(diffHours)}h ago`;
  }

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `in ${diffDays}d`;
  return `${Math.abs(diffDays)}d ago`;
}

/**
 * Add days to a date string and return YYYY-MM-DD
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T12:00:00+01:00");
  date.setDate(date.getDate() + days);
  return formatDateGMT1(date);
}

// ============================================
// Week Date Utilities
// ============================================

/**
 * Get the day of week (0 = Monday, 6 = Sunday) for a date in GMT+1
 */
function getDayOfWeekGMT1(date: Date): number {
  const dayStr = date.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  });
  const dayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return dayMap[dayStr] ?? 0;
}

/**
 * Get Monday-Sunday dates for the week containing the reference date
 * @param referenceDate - YYYY-MM-DD format, defaults to today in GMT+1
 * @returns Array of 7 date strings [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
 */
export function getWeekDates(referenceDate?: string): string[] {
  const refDate = referenceDate
    ? new Date(referenceDate + "T12:00:00+01:00")
    : new Date();

  const refDateStr = formatDateGMT1(refDate);
  const dayOfWeek = getDayOfWeekGMT1(refDate);

  // Calculate Monday of this week
  const mondayStr = addDays(refDateStr, -dayOfWeek);

  // Generate Mon-Sun
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    weekDates.push(addDays(mondayStr, i));
  }

  return weekDates;
}

/**
 * Get current week's dates (Monday-Sunday) in GMT+1
 */
export function getCurrentWeekDates(): string[] {
  return getWeekDates(getTodayGMT1());
}

/**
 * Get upcoming week's dates (next Mon-Sun) for Sunday cron
 * If called on Sunday, returns the week starting tomorrow (Monday)
 */
export function getUpcomingWeekDates(): string[] {
  const today = getTodayGMT1();
  const todayDate = new Date(today + "T12:00:00+01:00");
  const dayOfWeek = getDayOfWeekGMT1(todayDate);

  // Days until next Monday
  const daysUntilMonday = dayOfWeek === 6 ? 1 : 7 - dayOfWeek;
  const nextMonday = addDays(today, daysUntilMonday);

  return getWeekDates(nextMonday);
}

/**
 * Get rolling 2-week window dates (today + next 13 days)
 * Per ENGINE_SPEC: fixtures are fetched for a rolling 2-week window
 * @returns Array of 14 date strings starting from today
 */
export function getRollingTwoWeekDates(): string[] {
  const today = getTodayGMT1();
  const dates: string[] = [];

  for (let i = 0; i < 14; i++) {
    dates.push(addDays(today, i));
  }

  return dates;
}

/**
 * Get a human-readable label for a date relative to today
 * e.g., "Today", "Tomorrow", "Wed, 8 Jan"
 */
export function getDateLabel(dateStr: string): string {
  const today = getTodayGMT1();
  const tomorrow = addDays(today, 1);

  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";

  const date = new Date(dateStr + "T12:00:00+01:00");
  return date.toLocaleDateString("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
