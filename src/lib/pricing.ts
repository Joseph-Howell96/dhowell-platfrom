/**
 * Working out what a job is worth, from the client's agreed rates.
 *
 * Nothing here is stored. The figure is recalculated from the client's rate
 * lines every time it is shown, so correcting a rate on the client record
 * immediately corrects every job priced off it.
 */
import type { Customer, Job, RateLine } from "./types";

export type JobPrice = {
  /**
   * The amount in pence, always positive. Which way it goes is the job's own
   * direction, not this rate line's, since the two can disagree and the job
   * is the one someone actually chose.
   */
  pence: number;
  /** How it was worked out, for showing beside the figure. */
  workedOut: string;
};

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The rate line that applies to a job.
 *
 * A rate for the exact skip size wins. Failing that, a rate left blank applies
 * whatever size turned up. If a client only has an 8 yard rate and a 12 yard
 * job comes through, nothing matches and the job goes unpriced - better a
 * blank on the invoice than quietly charging the wrong size.
 */
export function findRateLine(
  customer: Customer | undefined,
  job: Pick<Job, "material" | "skipSize">,
): RateLine | undefined {
  if (!customer) return undefined;
  const forMaterial = customer.rateLines.filter((line) =>
    same(line.material, job.material),
  );
  const exactSize =
    job.skipSize.trim() !== ""
      ? forMaterial.find((line) => same(line.skipSize, job.skipSize))
      : undefined;
  return exactSize ?? forMaterial.find((line) => line.skipSize.trim() === "");
}

/**
 * What a job comes to, or null when it cannot be worked out - either because
 * the client has no rate matching the material and size, or because a
 * per-tonne rate needs a weight the job does not have yet.
 */
export function priceJob(job: Job, customer: Customer | undefined): JobPrice | null {
  const line = findRateLine(customer, job);
  if (!line) return null;

  if (line.basis === "Per tonne") {
    if (job.weightKg === null) return null;
    const tonnes = job.weightKg / 1000;
    return {
      pence: Math.round(line.ratePence * tonnes),
      workedOut: `${tonnes.toFixed(2)} t at ${(line.ratePence / 100).toFixed(2)}/t`,
    };
  }

  // Haulage fee, per lift and fixed price are all flat amounts.
  return {
    pence: line.ratePence,
    workedOut: line.basis.toLowerCase(),
  };
}

/** The material name a haulage rate line is filed under. */
export const HAULAGE = "Haulage";

/**
 * What haulage comes to on a job, or null when it is not being charged or the
 * client has no haulage rate for this skip size.
 *
 * Worked out by pricing the job as though its material were haulage, so the
 * size matching and the per-tonne handling are the same everywhere.
 */
export function haulageChargeFor(
  job: Job,
  customer: Customer | undefined,
): JobPrice | null {
  if (!job.chargeHaulage) return null;
  return priceJob({ ...job, material: HAULAGE }, customer);
}
