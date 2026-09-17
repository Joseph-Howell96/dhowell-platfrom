/**
 * Working out what a job is worth, from the client's agreed rates.
 *
 * Nothing here is stored. The figure is recalculated from the client's rate
 * lines every time it is shown, so correcting a rate on the client record
 * immediately corrects every job priced off it.
 *
 * A rate line prices the material and nothing else. Wood might be rebated at
 * £42 a tonne - money out - and the lorry that fetched it is still charged for,
 * at the client's haulage fee, which is a separate figure on their record and
 * applies to every collection whichever way the material runs.
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

/** What haulage is called on an invoice and in a breakdown. */
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
 * What haulage comes to on a job.
 *
 * Every collection carries the client's haulage fee - there is nothing to tick
 * and nothing to decide. Ten collections is ten fees, because it is ten lorry
 * movements, and the lorry costs the same whether we are billing for what was
 * in the skip or paying for it.
 *
 * Null only where the client is not known, which is a broken record rather
 * than a job without haulage.
 */
export function haulageChargeFor(
  _job: Job,
  customer: Customer | undefined,
): JobPrice | null {
  if (!customer) return null;
  // A flat charge for the lorry, whatever the load weighs.
  return {
    pence: customer.haulageFeePence,
    workedOut: "one collection at the client's haulage fee",
  };
}
