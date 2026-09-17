/**
 * Working out which dates belong in a month grid.
 *
 * Every calculation here is done in UTC. Dates are handled as plain
 * "YYYY-MM-DD" text rather than as points in time, so a job booked for the
 * 16th stays on the 16th regardless of clocks, time zones or British Summer
 * Time. Mixing the two is the usual source of "why is it showing yesterday".
 */

/** A month, written as "YYYY-MM". */
export type MonthKey = string;

export type DayCell = {
  /** The date as "YYYY-MM-DD". */
  iso: string;
  /** The number to print in the corner, 1 to 31. */
  dayOfMonth: number;
  /** False for the greyed-out days either side that belong to another month. */
  inMonth: boolean;
};

/** Monday first, the way a UK working week reads. */
export const WEEKDAY_NAMES = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Today's date in London, as "YYYY-MM-DD". */
export function todayISO(): string {
  // "en-CA" happens to format dates as YYYY-MM-DD, which saves assembling it
  // by hand, and the time zone is pinned to London rather than the server's.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Is this text a real date written as "YYYY-MM-DD"? */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Catches the 31st of a 30-day month: the Date rolls over to the 1st of the
  // next one, so the pieces no longer match what went in.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** The "YYYY-MM" a date belongs to. */
export function monthKeyOf(isoDate: string): MonthKey {
  return isoDate.slice(0, 7);
}

export function isValidMonthKey(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** "2026-09" becomes "September 2026". */
export function monthLabel(month: MonthKey): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

/** Step forwards or backwards a number of months, e.g. addMonths("2026-12", 1). */
export function addMonths(month: MonthKey, step: number): MonthKey {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1 + step;
  // Date handles rolling over the end of a year for us.
  const moved = new Date(Date.UTC(year, monthIndex, 1));
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}`;
}

/**
 * The Monday of the week a date falls in.
 *
 * Monday, because that is how the calendar grid is laid out and how a working
 * week reads here. A Sunday belongs to the week that started six days before
 * it, not to the one about to begin.
 */
export function weekStartOf(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // getUTCDay() counts Sunday as 0; shifting by 6 and wrapping makes Monday 0.
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - sinceMonday);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Every cell of the month grid, including the days either side needed to fill
 * out the first and last weeks. Always a whole number of weeks.
 */
export function buildMonthGrid(month: MonthKey): DayCell[] {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;

  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  // getUTCDay() counts Sunday as 0. Shifting by 6 and wrapping turns that into
  // Monday as 0, which is how the grid is laid out.
  const leadingDays = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

  const cells: DayCell[] = [];
  for (let index = 0; index < totalCells; index += 1) {
    const date = new Date(
      Date.UTC(year, monthIndex, index - leadingDays + 1),
    );
    cells.push({
      iso: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
      dayOfMonth: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthIndex,
    });
  }
  return cells;
}
