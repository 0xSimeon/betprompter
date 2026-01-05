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
 * Format kickoff time for display (e.g., "15:00")
 */
export function formatKickoffTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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
