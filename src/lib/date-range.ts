import { getYesterdayDateInTimezone } from "./google-ads/queries";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_RANGE_DAYS = 366;

export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Read `start` & `end` (YYYY-MM-DD) from the query string, or fall back to the
 * last `days` days (default 30) ending yesterday in Singapore time.
 */
export function resolveDateRange(
  params: URLSearchParams
): { startDate: string; endDate: string } | { error: string } {
  const start = params.get("start");
  const end = params.get("end");

  if (start || end) {
    if (!start || !end || !ISO_DATE.test(start) || !ISO_DATE.test(end)) {
      return { error: "Use start and end dates in YYYY-MM-DD format." };
    }
    if (start > end) return { error: "Start date must be on or before the end date." };
    if (shiftDate(start, MAX_RANGE_DAYS - 1) < end) {
      return { error: `Pick a range of at most ${MAX_RANGE_DAYS} days.` };
    }
    return { startDate: start, endDate: end };
  }

  const days = Math.min(Math.max(Number(params.get("days")) || 30, 1), MAX_RANGE_DAYS);
  const endDate = getYesterdayDateInTimezone("Asia/Singapore");
  return { startDate: shiftDate(endDate, -(days - 1)), endDate };
}
