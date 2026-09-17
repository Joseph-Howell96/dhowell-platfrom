/**
 * Working with dates.
 *
 * Dates are plain "YYYY-MM-DD" text and every calculation is done in UTC, so
 * nothing shifts by a day when the clocks change. A job booked for the 16th is
 * on the 16th, full stop.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toISO(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function fromISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Show a stored date in British format, e.g. "15/09/2026". */
export function formatDateGB(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  // Built by hand from UTC parts so the server and the browser always agree.
  // Letting the machine's timezone decide can render two different dates and
  // make React complain that the page changed under it.
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/** A number of days later. Weekends and bank holidays all count. */
export function addCalendarDays(startISO: string, days: number): string {
  const date = fromISO(startISO);
  return toISO(
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days),
    ),
  );
}

/** Whole days between two dates, negative when the second is earlier. */
export function daysBetween(fromDate: string, toDate: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round(
    (fromISO(toDate).getTime() - fromISO(fromDate).getTime()) / MS_PER_DAY,
  );
}
