/**
 * Working out what a job is worth, from the client's agreed rates.
 *
 * Nothing here is stored. The figure is recalculated from the client's rate
 * lines every time it is shown, so correcting a rate on the client record
 * immediately corrects every job priced off it.
 *
 * A rate line carries both figures at once. Wood might be rebated at £42 a
 * tonne - money out - while still being charged £95 to come and collect it.
 * The tonnage rate follows the line's direction; the haulage rate is always
 * charged to the client, and a job may override the amount.
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

/** The material a generic haulage rate is filed under. */
export const HAULAGE = "Haulage";

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The line that prices the material itself, whichever way the money runs. */
export function findMaterialRate(
  customer: Customer | undefined,
  job: Pick<Job, "material">,
): RateLine | undefined {
  if (!customer) return undefined;
  return customer.rateLines.find(
    (line) =>
      same(line.material, job.material) && line.ratePerTonnePence !== null,
  );
}

/**
 * The line that charges for collecting it.
 *
 * A haulage line against this material is used first. Where there is none, a
 * haulage line filed under "Haulage" applies to everything, so one rate can
 * cover the lot rather than being repeated against every material.
 */
export function findHaulageRate(
  customer: Customer | undefined,
  job: Pick<Job, "material">,
): RateLine | undefined {
  if (!customer) return undefined;
  const haulageLines = customer.rateLines.filter(
    (line) => line.haulageRatePence !== null,
  );
  return (
    haulageLines.find((line) => same(line.material, job.material)) ??
    haulageLines.find((line) => same(line.material, HAULAGE))
  );
}

/**
 * What haulage costs on this job before any override: the client's rate for
 * the material, or null where they have none.
 */
export function standardHaulagePence(
  customer: Customer | undefined,
  job: Pick<Job, "material">,
): number | null {
  return findHaulageRate(customer, job)?.haulageRatePence ?? null;
}

/** Kept for anywhere that just wants the material's line. */
export const findRateLine = findMaterialRate;

/** The material itself, which is always priced by weight. */
function priceMaterial(line: RateLine, job: Job): JobPrice | null {
  if (line.ratePerTonnePence === null) return null;
  if (job.weightKg === null) return null;
  const tonnes = job.weightKg / 1000;
  return {
    pence: Math.round(line.ratePerTonnePence * tonnes),
    workedOut: `${tonnes.toFixed(2)} t at ${(line.ratePerTonnePence / 100).toFixed(2)}/t`,
  };
}

/**
 * What the material on a job comes to, or null when it cannot be worked out -
 * either because the client has no rate matching the material and size, or
 * because a per-tonne rate needs a weight the job does not have yet.
 */
export function priceJob(
  job: Job,
  customer: Customer | undefined,
): JobPrice | null {
  const line = findMaterialRate(customer, job);
  return line ? priceMaterial(line, job) : null;
}

/**
 * What haulage comes to on a job, or null when it is not being charged or the
 * client has no haulage rate that fits.
 *
 * Charged whichever way the material runs: collecting a skip costs the same
 * whether we are billing for what is in it or paying for it.
 */
export function haulageChargeFor(
  job: Job,
  customer: Customer | undefined,
): JobPrice | null {
  if (!job.chargeHaulage) return null;
  // An amount set on the job wins over the client's rate. It is what somebody
  // decided this particular run was worth, and a standing rate is only ever a
  // starting point.
  if (job.haulageRateOverridePence !== null) {
    return {
      pence: job.haulageRateOverridePence,
      workedOut: "haulage, set on this job",
    };
  }
  const standard = standardHaulagePence(customer, job);
  if (standard === null) return null;
  // A flat charge for the lorry, whatever the load weighs.
  return { pence: standard, workedOut: "haulage, the client's rate" };
}
