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
 * charged to the client.
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

/**
 * The best line for a skip size out of a set already narrowed to one material.
 *
 * A rate for the exact size wins. Failing that, a rate left blank applies
 * whatever size turned up. If a client only has an 8 yard rate and a 12 yard
 * job comes through, nothing matches and the job goes unpriced - better a
 * blank on the invoice than quietly charging the wrong size.
 */
function bestForSize(lines: RateLine[], skipSize: string): RateLine | undefined {
  const exact =
    skipSize.trim() !== ""
      ? lines.find((line) => same(line.skipSize, skipSize))
      : undefined;
  return exact ?? lines.find((line) => line.skipSize.trim() === "");
}

/** The line that prices the material itself, whichever way the money runs. */
export function findMaterialRate(
  customer: Customer | undefined,
  job: Pick<Job, "material" | "skipSize">,
): RateLine | undefined {
  if (!customer) return undefined;
  return bestForSize(
    customer.rateLines.filter(
      (line) =>
        same(line.material, job.material) && line.ratePerTonnePence !== null,
    ),
    job.skipSize,
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
  job: Pick<Job, "material" | "skipSize">,
): RateLine | undefined {
  if (!customer) return undefined;
  const haulageLines = customer.rateLines.filter(
    (line) => line.haulageRatePence !== null,
  );
  return (
    bestForSize(
      haulageLines.filter((line) => same(line.material, job.material)),
      job.skipSize,
    ) ??
    bestForSize(
      haulageLines.filter((line) => same(line.material, HAULAGE)),
      job.skipSize,
    )
  );
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
  const line = findHaulageRate(customer, job);
  if (!line || line.haulageRatePence === null) return null;
  // A flat charge for the lorry, whatever the load weighs.
  return { pence: line.haulageRatePence, workedOut: "haulage" };
}
