/**
 * Turning jobs into the lines and totals that appear on an invoice.
 *
 * Nothing here is stored. Everything is worked out from the jobs and the
 * client's rates when the invoice is opened.
 */
import { priceJob } from "./pricing";
import { materialCode, type Customer, type Job } from "./types";

export type InvoiceLine = {
  jobId: string;
  /** The stock code, from the material. */
  sku: string;
  description: string;
  /** Tonnes on a per-tonne rate, otherwise one lift or one job. */
  quantity: number;
  /** What a single one of those costs, in pence. */
  unitPricePence: number;
  /** quantity times unit price, in pence. */
  amountPence: number;
};

export type InvoiceTotals = {
  netPence: number;
  vatPence: number;
  grossPence: number;
};

/** The line an invoice shows for one job. */
export function lineForJob(
  job: Job,
  customer: Customer | undefined,
): InvoiceLine | null {
  const price = priceJob(job, customer);
  if (!price) return null;

  const rate = customer?.rateLines.find(
    (line) => line.material.toLowerCase() === job.material.toLowerCase(),
  );

  // A per-tonne rate bills the weight; everything else bills as one of a thing.
  const perTonne = rate?.basis === "Per tonne";
  const quantity = perTonne && job.weightKg !== null ? job.weightKg / 1000 : 1;
  const unitPricePence = perTonne ? (rate?.ratePence ?? 0) : price.pence;

  const parts = [job.material];
  if (job.skipSize) parts.push(job.skipSize);
  if (rate && !perTonne) parts.push(rate.basis.toLowerCase());

  return {
    jobId: job.id,
    sku: materialCode(job.material),
    description: parts.join(", "),
    quantity,
    unitPricePence,
    // Taken from the priced job rather than multiplied again here, so the
    // invoice can never disagree with the rest of the app by a penny.
    amountPence: price.pence,
  };
}

export function linesForJobs(
  jobs: Job[],
  customer: Customer | undefined,
): InvoiceLine[] {
  return jobs
    .map((job) => lineForJob(job, customer))
    .filter((line) => line !== null);
}

/** Net, VAT and gross for a set of lines, at the given rate. */
export function totalsForLines(
  lines: InvoiceLine[],
  vatPercent: number,
): InvoiceTotals {
  const netPence = lines.reduce((sum, line) => sum + line.amountPence, 0);
  // Rounded to the penny once, on the total, the way an invoice is added up.
  const vatPence = Math.round((netPence * vatPercent) / 100);
  return { netPence, vatPence, grossPence: netPence + vatPence };
}

/** "INV-1001", from the prefix in settings. */
export function formatInvoiceNumber(prefix: string, number: number): string {
  return `${prefix}${number}`;
}
