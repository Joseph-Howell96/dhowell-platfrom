/**
 * Turning jobs into the lines and totals that appear on an invoice.
 *
 * Nothing here is stored. Everything is worked out from the jobs and the
 * client's rates when the invoice is opened.
 */
import { findRateLine, HAULAGE, haulageChargeFor, priceJob } from "./pricing";
import { formatPence } from "./money";
import {
  isWeighedOrLater,
  materialCode,
  type Customer,
  type Invoice,
  type Job,
} from "./types";

export type InvoiceLine = {
  jobId: string;
  /** Set apart so two lines from the same job keep distinct keys. */
  key: string;
  /** The stock code, from the material. */
  sku: string;
  description: string;
  /** Tonnes on a material line, one collection on a haulage line. */
  quantity: number;
  /** The quantity as it reads on the document, e.g. "3.00 t". */
  quantityLabel: string;
  /** What a single one of those costs, in pence. */
  unitPricePence: number;
  /** The unit price as it reads, e.g. "£42.00 per tonne". */
  unitPriceLabel: string;
  /** quantity times unit price, in pence. */
  amountPence: number;
};

/**
 * How a skip size reads on an invoice.
 *
 * A plain size gets the word skip after it, so "40 yard" reads "40 yard skip".
 * Anything already naming what it is - a RoRo, a grab lorry - is left alone.
 */
export function describeSkipSize(skipSize: string): string {
  const size = skipSize.trim();
  if (size === "") return "";
  return /^\d+\s*(yard|yd)s?$/i.test(size) ? `${size} skip` : size;
}

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
  // and the unit price is the rate per tonne. Both are spelled out, because an
  // invoice that only shows a total invites a phone call.
  const quantity = job.weightKg !== null ? job.weightKg / 1000 : 1;
  const unitPricePence = rate?.ratePerTonnePence ?? price.pence;

  const parts = [job.material];
  const size = describeSkipSize(job.skipSize);
  if (size) parts.push(size);

  return {
    jobId: job.id,
    key: `${job.id}-material`,
    sku: materialCode(job.material),
    description: parts.join(", "),
    quantity,
    quantityLabel: `${quantity.toFixed(2)} t`,
    unitPricePence,
    unitPriceLabel: `${formatPence(unitPricePence)} per tonne`,
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
  const size = describeSkipSize(job.skipSize);
  if (size) parts.push(size);

  return {
    jobId: job.id,
    key: `${job.id}-haulage`,
    sku: materialCode(HAULAGE),
    description: parts.join(", "),
    // Haulage is one flat charge for the lorry, not a rate against the load.
    quantity: 1,
    quantityLabel: "1",
    unitPricePence: price.pence,
    unitPriceLabel: formatPence(price.pence),
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

/**
 * Is this job waiting to be invoiced?
 *
 * Two conditions, and only two: it has been weighed, and it is not already on
 * an invoice. Being on one is checked against what the invoices actually hold,
 * never against anything written on the job, which is what stops a job being
 * billed twice.
 *
 * Kept here, in one function, because every screen that offers to bill has to
 * agree on the answer: the week button on the calendar, the invoice form, the
 * dashboard count and the actions behind them. Four copies of the same test is
 * how they drift apart.
 */
export function isAwaitingInvoice(job: Job, alreadyBilled: Set<string>): boolean {
  return isWeighedOrLater(job.status) && !alreadyBilled.has(job.id);
}

/**
 * Can this job be put on an invoice today?
 *
 * Waiting to be invoiced, and priced. A weighed job whose material has no
 * matching rate on the client record has nothing to bill, so it is held back
 * rather than put on an invoice as a blank line - but it is still waiting, and
 * the screens say so rather than letting it disappear.
 */
export function isReadyToInvoice(
  job: Job,
  customer: Customer | undefined,
  alreadyBilled: Set<string>,
): boolean {
  return isAwaitingInvoice(job, alreadyBilled) && isBillable(job, customer);
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

/**
 * What an invoice comes to, including VAT.
 *
 * An invoice holds which jobs it covers rather than a copy of their figures,
 * so the total is added up from those jobs and the client's rates each time.
 * A job an invoice names that is no longer there is simply skipped.
 */
export function invoiceGrossPence(
  invoice: Invoice,
  jobsById: Map<string, Job>,
  customer: Customer | undefined,
  vatPercent: number,
): number {
  const billed = invoice.jobIds
    .map((id) => jobsById.get(id))
    .filter((job) => job !== undefined);
  return totalsForLines(linesForJobs(billed, customer), vatPercent).grossPence;
}

/** "INV-1001", from the prefix in settings. */
export function formatInvoiceNumber(prefix: string, number: number): string {
  return `${prefix}${number}`;
}
