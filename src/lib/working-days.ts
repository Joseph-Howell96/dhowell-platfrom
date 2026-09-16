/**
 * Working days and UK bank holidays, for working out when an invoice is due.
 *
 * These are the bank holidays for England and Wales. Scotland and Northern
 * Ireland have a different list; if the business ever invoices from there this
 * is the file to revisit.
 *
 * As everywhere else in Dennis, dates are plain "YYYY-MM-DD" text and all the
 * arithmetic is done in UTC, so nothing shifts by a day when the clocks change.
 */

/**
 * One-off bank holidays that no rule predicts - jubilees, funerals,
 * coronations. When the government announces another one, add it here.
 */
const EXTRA_BANK_HOLIDAYS = new Set([
  "2022-06-03", // Platinum Jubilee
  "2022-09-19", // State Funeral of Queen Elizabeth II
  "2023-05-08", // Coronation of King Charles III
]);

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

/**
 * Which day Easter Sunday falls on in a given year.
 *
 * Easter has no fixed date - it is the first Sunday after the first full moon
 * on or after the spring equinox. This is the standard published method for
 * calculating it; the workings are not meant to be read, only trusted, and the
 * tests check it against known dates.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days),
  );
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** The Monday-or-later date a holiday moves to when it lands on a weekend. */
function shiftOffWeekendAndClashes(date: Date, taken: Set<string>): Date {
  let moved = date;
  while (isWeekend(moved) || taken.has(toISO(moved))) {
    moved = addDays(moved, 1);
  }
  return moved;
}

/** The nth given weekday of a month, e.g. the first Monday in May. */
function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  n: number,
): Date {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + offset + (n - 1) * 7));
}

/** The last given weekday of a month, e.g. the last Monday in August. */
function lastWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
): Date {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, last.getUTCDate() - offset));
}

const holidayCache = new Map<number, Set<string>>();

/** Every England and Wales bank holiday in a given year, as "YYYY-MM-DD". */
export function bankHolidaysFor(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const dates = new Set<string>();
  const add = (date: Date) => {
    dates.add(toISO(shiftOffWeekendAndClashes(date, dates)));
  };

  // New Year's Day, moved to the Monday if it lands on a weekend.
  add(new Date(Date.UTC(year, 0, 1)));

  const easter = easterSunday(year);
  dates.add(toISO(addDays(easter, -2))); // Good Friday, always a Friday
  dates.add(toISO(addDays(easter, 1))); // Easter Monday, always a Monday

  dates.add(toISO(nthWeekdayOfMonth(year, 4, 1, 1))); // First Monday in May
  dates.add(toISO(lastWeekdayOfMonth(year, 4, 1))); // Last Monday in May
  dates.add(toISO(lastWeekdayOfMonth(year, 7, 1))); // Last Monday in August

  // Christmas first, then Boxing Day, so that when both fall at a weekend the
  // substitute days land in the right order.
  add(new Date(Date.UTC(year, 11, 25)));
  add(new Date(Date.UTC(year, 11, 26)));

  for (const extra of EXTRA_BANK_HOLIDAYS) {
    if (extra.startsWith(String(year))) dates.add(extra);
  }

  holidayCache.set(year, dates);
  return dates;
}

/** Is this a day the office works: not a weekend, not a bank holiday? */
export function isWorkingDay(iso: string): boolean {
  const date = fromISO(iso);
  if (isWeekend(date)) return false;
  return !bankHolidaysFor(date.getUTCFullYear()).has(iso);
}

/**
 * The date a given number of working days after a starting date.
 *
 * Counting starts the day after the start date, so one working day after a
 * Friday is the following Monday, and the start date itself is never counted
 * even when it is a working day.
 */
export function addWorkingDays(startISO: string, workingDays: number): string {
  let date = fromISO(startISO);
  let remaining = workingDays;
  while (remaining > 0) {
    date = addDays(date, 1);
    if (isWorkingDay(toISO(date))) remaining -= 1;
  }
  return toISO(date);
}

/** How many payment days an invoice gets from the day it is sent. */
export const PAYMENT_WORKING_DAYS = 28;

/** When an invoice sent on this date falls due. */
export function invoiceDueDate(sentISO: string): string {
  return addWorkingDays(sentISO, PAYMENT_WORKING_DAYS);
}

/** Whole days between two dates, negative when the second is earlier. */
export function daysBetween(fromISO_: string, toISO_: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round(
    (fromISO(toISO_).getTime() - fromISO(fromISO_).getTime()) / MS_PER_DAY,
  );
}

/**
 * A number of ordinary days later, weekends and holidays included.
 *
 * Used for what we owe a supplier, where the terms are the plain "30 days"
 * kind rather than the working-day count we give our own customers.
 */
export function addCalendarDays(startISO: string, days: number): string {
  return toISO(addDays(fromISO(startISO), days));
}
