/**
 * The sums behind the dashboard.
 *
 * Nothing here is stored. Every figure is worked out from the jobs and the
 * clients' rates each time the page is opened, so correcting a rate or a
 * weight corrects the dashboard too.
 *
 * The one rule worth knowing: a figure nobody has recorded is left out rather
 * than treated as zero. A job with no disposal cost against it has a revenue
 * but no profit, and the page says how many jobs are in that position. Treating
 * a blank as nothing would quietly report every job as pure profit.
 */
import { priceJob } from "./pricing";
import type { Customer, Job } from "./types";
import { isWeighedOrLater } from "./types";

export type JobEconomics = {
  /** What comes in: the charge on a sale, the onward sale on a purchase. */
  revenuePence: number | null;
  /** What goes out: the disposal cost on a sale, the client on a purchase. */
  costPence: number | null;
  /** Revenue less cost, or null when either side is unknown. */
  profitPence: number | null;
};

/** What a single job is worth, from whichever side of it we are on. */
export function jobEconomics(
  job: Job,
  customer: Customer | undefined,
): JobEconomics {
  const rated = priceJob(job, customer)?.pence ?? null;

  // On a sale the client's rate is what we charge; on a purchase it is what we
  // pay them. The other half comes from what was recorded against the job.
  const revenuePence = job.direction === "sale" ? rated : job.onwardSalePence;
  const costPence = job.direction === "sale" ? job.disposalCostPence : rated;

  return {
    revenuePence,
    costPence,
    profitPence:
      revenuePence !== null && costPence !== null
        ? revenuePence - costPence
        : null,
  };
}

export type Totals = {
  jobs: number;
  revenuePence: number;
  /** Profit across only those jobs where both halves are known. */
  profitPence: number;
  /** How many of the jobs contributed a profit figure. */
  jobsWithProfit: number;
  /** Revenue of just those jobs, so margin compares like with like. */
  revenueOfProfitableJobs: number;
};

const EMPTY: Totals = {
  jobs: 0,
  revenuePence: 0,
  profitPence: 0,
  jobsWithProfit: 0,
  revenueOfProfitableJobs: 0,
};

function accumulate(totals: Totals, economics: JobEconomics): Totals {
  const next = { ...totals, jobs: totals.jobs + 1 };
  if (economics.revenuePence !== null) {
    next.revenuePence += economics.revenuePence;
  }
  if (economics.profitPence !== null) {
    next.profitPence += economics.profitPence;
    next.jobsWithProfit += 1;
    next.revenueOfProfitableJobs += economics.revenuePence ?? 0;
  }
  return next;
}

export function totalsFor(
  jobs: Job[],
  clientsById: Map<string, Customer>,
): Totals {
  return jobs.reduce(
    (totals, job) => accumulate(totals, jobEconomics(job, clientsById.get(job.customerId))),
    EMPTY,
  );
}

/**
 * Profit as a percentage of revenue, over the jobs that have both figures.
 * Null when nothing has a profit yet, rather than a misleading zero.
 */
export function marginPercent(totals: Totals): number | null {
  if (totals.jobsWithProfit === 0) return null;
  if (totals.revenueOfProfitableJobs === 0) return null;
  return (totals.profitPence / totals.revenueOfProfitableJobs) * 100;
}

/** A job counts as done once it has been weighed; before that it is scheduled. */
export function isCompleted(job: Job): boolean {
  return isWeighedOrLater(job.status);
}

export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type MonthTotals = { label: string; totals: Totals };

/** The twelve months of a year, in order, even where a month has no jobs. */
export function byMonth(
  jobs: Job[],
  clientsById: Map<string, Customer>,
): MonthTotals[] {
  const months: Totals[] = Array.from({ length: 12 }, () => EMPTY);
  for (const job of jobs) {
    const index = Number(job.date.slice(5, 7)) - 1;
    if (index < 0 || index > 11) continue;
    months[index] = accumulate(
      months[index],
      jobEconomics(job, clientsById.get(job.customerId)),
    );
  }
  return months.map((totals, index) => ({
    label: MONTH_SHORT[index],
    totals,
  }));
}

export type MaterialTotals = { material: string; totals: Totals };

/** Totals per material, busiest by revenue first. */
export function byMaterial(
  jobs: Job[],
  clientsById: Map<string, Customer>,
): MaterialTotals[] {
  const groups = new Map<string, Totals>();
  for (const job of jobs) {
    // Group on the name as typed but ignoring capitalisation, so "wood" and
    // "Wood" are one material rather than two.
    const key = job.material.trim() || "Not recorded";
    const existing = [...groups.keys()].find(
      (name) => name.toLowerCase() === key.toLowerCase(),
    );
    const name = existing ?? key;
    groups.set(
      name,
      accumulate(
        groups.get(name) ?? EMPTY,
        jobEconomics(job, clientsById.get(job.customerId)),
      ),
    );
  }
  return [...groups.entries()]
    .map(([material, totals]) => ({ material, totals }))
    .sort((a, b) => b.totals.revenuePence - a.totals.revenuePence);
}

/** Every year that has a job in it, newest first, always including this one. */
export function yearsWithJobs(jobs: Job[], thisYear: string): string[] {
  const years = new Set(jobs.map((job) => job.date.slice(0, 4)));
  years.add(thisYear);
  return [...years].sort().reverse();
}
