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
import { haulageChargeFor, priceJob } from "./pricing";
import type { Customer, Job } from "./types";
import { isWeighedOrLater } from "./types";

/**
 * Add up whatever is known, or null when nothing is.
 *
 * A job can be half-priced: haulage charged on it while the material has no
 * rate yet. The part we do know is still money, and counting it as zero would
 * hide it.
 */
export function sumKnown(...values: (number | null)[]): number | null {
  const known = values.filter((value) => value !== null);
  return known.length === 0 ? null : known.reduce((total, v) => total + v, 0);
}

export type JobEconomics = {
  /** What comes in: the charge on a charge job, the onward sale on a rebate. */
  revenuePence: number | null;
  /** What goes out: disposal on a charge job, rebate plus haulage on a rebate one. */
  costPence: number | null;
  /** Revenue less cost, or null when either side is unknown. */
  profitPence: number | null;
};

/**
 * What a single job is worth.
 *
 * A charge job is the straightforward one: we invoice the client and pay the
 * tip. A rebate job runs the other way, and its margin is the wording the yard
 * uses - material income, less the rebate, less haulage:
 *
 *   margin = what the load sold on for
 *          + any haulage we charged the client
 *          - what we paid the client
 *          - what it cost to get the load there
 *
 * What it sold on for is typed against the job. Until it is, the job has a
 * cost and no income, so it counts towards neither profit nor margin rather
 * than being reported as a loss.
 */
export function jobEconomics(
  job: Job,
  customer: Customer | undefined,
): JobEconomics {
  const rated = priceJob(job, customer)?.pence ?? null;

  // What we charge the client to collect, whichever way the material runs.
  const haulage = haulageChargeFor(job, customer)?.pence ?? null;

  if (job.direction === "sale") {
    const revenuePence = sumKnown(rated, haulage);
    const costPence = job.disposalCostPence;
    return {
      revenuePence,
      // Profit needs the material priced as well. Haulage alone would
      // understate what the job cost against what it brought in.
      profitPence:
        rated !== null && costPence !== null && revenuePence !== null
          ? revenuePence - costPence
          : null,
      costPence,
    };
  }

  // What the load fetched when it was sold on. Recorded against the job, since
  // that is the only place it is known.
  const incomePence = job.onwardSalePence;

  // The rebate is what the client's rate says we pay them. Haulage is on top,
  // and counts as nothing only when someone has said so.
  const rebatePence = rated;
  const haulagePence = job.haulageCostPence;
  const costPence =
    rebatePence !== null && haulagePence !== null
      ? rebatePence + haulagePence
      : null;

  // On a rebate job the haulage we charge is money in, on top of whatever the
  // the load fetched when it was sold on.
  const revenuePence = sumKnown(incomePence, haulage);

  return {
    revenuePence,
    costPence,
    profitPence:
      incomePence !== null && costPence !== null && revenuePence !== null
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
    (totals, job) =>
      accumulate(
        totals,
        jobEconomics(job, clientsById.get(job.customerId)),
      ),
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

/**
 * Has this job been done?
 *
 * Weighed is what "done" means: the load is off site and the weighbridge
 * ticket is in, so there is a figure to put against it. Before that it is
 * still in the diary and counts as scheduled.
 */
export function isWeighed(job: Job): boolean {
  return isWeighedOrLater(job.status);
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
