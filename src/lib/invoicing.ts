/**
 * Turning jobs into the lines and totals that appear on an invoice.
 *
 * Nothing here is stored. Everything is worked out from the jobs and the
 * client's rates when the invoice is opened.
 */
import { findRateLine, HAULAGE, haulageChargeFor, priceJob } from "./pricing";
import { materialCode, type Customer, type Job } from "./types";

export type InvoiceLine = {
  jobId: string;
  /** Set apart so two lines from the same job keep distinct keys. */
  key: string;
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

  const rate = findRateLine(customer, job);

  // The material is always billed by weight, so the quantity is the tonnage
  // and the unit price is the rate per tonne.
  const quantity = job.weightKg !== null ? job.weightKg / 1000 : 1;
  const unitPricePence = rate?.ratePerTonnePence ?? price.pence;

  const parts = [job.material];
  if (job.skipSize) parts.push(job.skipSize);

  return {
    jobId: job.id,
    key: `${job.id}-material`,
    sku: materialCode(job.material),
    description: parts.join(", "),
    quantity,
    unitPricePence,
    // Taken from the priced job rather than multiplied again here, so the
    // invoice can never disagree with the rest of the app by a penny.
    amountPence: price.pence,
  };
}

/** The haulage line a job adds, where haulage is being charged on it. */
export function haulageLineForJob(
  job: Job,
  customer: Customer | undefined,
): InvoiceLine | null {
  const price = haulageChargeFor(job, customer);
  if (!price) return null;

  const parts = [HAULAGE];
  if (job.skipSize) parts.push(job.skipSize);

  return {
    jobId: job.id,
    key: `${job.id}-haulage`,
    sku: materialCode(HAULAGE),
    description: parts.join(", "),
    quantity: 1,
    unitPricePence: price.pence,
    amountPence: price.pence,
  };
}

/**
 * Every line an invoice shows. A job contributes its material and, where it is
 * charged, a haulage line straight after it, so the two read together.
 */
export function linesForJobs(
  jobs: Job[],
  customer: Customer | undefined,
): InvoiceLine[] {
  return jobs.flatMap((job) => {
    // A rebate job's material is money out and is settled by purchase order,
    // so it never appears on a sales invoice. The haulage charged on it does.
    const material = job.direction === "sale" ? lineForJob(job, customer) : null;
    return [material, haulageLineForJob(job, customer)].filter(
      (line) => line !== null,
    );
  });
}

/** Is there anything on this job to put on a sales invoice? */
export function isBillable(job: Job, customer: Customer | undefined): boolean {
  return linesForJobs([job], customer).length > 0;
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
