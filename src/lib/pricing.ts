/**
 * Working out what a job is worth, from the client's agreed rates.
 *
 * Nothing here is stored. The figure is recalculated from the client's rate
 * lines every time it is shown, so correcting a rate on the client record
 * immediately corrects every job priced off it.
 */
import type { Customer, Job } from "./types";

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

/**
 * What a job comes to, or null when it cannot be worked out - either because
 * the client has no rate for that material, or because a per-tonne rate needs
 * a weight the job does not have yet.
 */
export function priceJob(job: Job, customer: Customer | undefined): JobPrice | null {
  if (!customer) return null;

  // Match on the material name, ignoring capitalisation, so "wood" typed into
  // the Other box still finds a "Wood" rate line.
  const line = customer.rateLines.find(
    (rate) => rate.material.toLowerCase() === job.material.toLowerCase(),
  );
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
