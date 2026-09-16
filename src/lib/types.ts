/**
 * The shape of the data we store. Everything the app saves or reads
 * must match these descriptions, and TypeScript checks that for us.
 */

/** What we charge or pay for, per material. */
export const MATERIALS = [
  "Wood",
  "General rubbish",
  "Mixed paper",
  "Corex",
  "Cardboard",
  "Metal",
  "Green waste",
] as const;

/** How a rate is worked out. */
export const BASES = [
  "Per tonne",
  "Haulage fee",
  "Per lift",
  "Fixed price",
] as const;

export type Basis = (typeof BASES)[number];

/**
 * Which way the money flows.
 * "charge" - we invoice the customer for this.
 * "pay"    - we buy the material from the customer, so we owe them.
 */
export const DIRECTIONS = ["charge", "pay"] as const;

export type Direction = (typeof DIRECTIONS)[number];

export const DIRECTION_LABELS: Record<Direction, string> = {
  charge: "We charge the customer",
  pay: "We pay the customer",
};

/** One priced line on a customer's account, e.g. "Wood, per tonne, £85, we charge". */
export type RateLine = {
  id: string;
  material: string;
  basis: Basis;
  /** Held in pence, so £85.50 is stored as 8550. See src/lib/money.ts for why. */
  ratePence: number;
  direction: Direction;
};

export type Customer = {
  id: string;
  businessName: string;
  siteAddress: string;
  billingAddress: string;
  contactName: string;
  phone: string;
  email: string;
  /** How many days after invoicing payment is due, e.g. 30. */
  paymentTermsDays: number;
  notes: string;
  rateLines: RateLine[];
  /** When the record was created, as an ISO timestamp. Displayed as DD/MM/YYYY. */
  createdAt: string;
};

/* ---------------------------------------------------------------------------
 * Jobs
 * ------------------------------------------------------------------------- */

/**
 * Which way the money goes on a job.
 *
 * Held on the job itself rather than worked out from the client's rates. The
 * form fills it in for you when you pick a material, but a job that uses a
 * material the client has no rate for still has to know whether it is a sale
 * or a purchase, and only the job can answer that.
 */
export const JOB_DIRECTIONS = ["sale", "purchase"] as const;

export type JobDirection = (typeof JOB_DIRECTIONS)[number];

export const DIRECTION_JOB_LABELS: Record<JobDirection, string> = {
  sale: "Sale — we charge the client",
  purchase: "Purchase — we pay the client",
};

/** Which rate lines produce which kind of job. */
export function directionForRate(rateDirection: Direction): JobDirection {
  return rateDirection === "charge" ? "sale" : "purchase";
}

/**
 * The run of work for a job we are invoicing out.
 * Money coming in: do the job, weigh it, raise the invoice, send it.
 */
export const SALE_STATUSES = [
  "booked",
  "weighed",
  "generate-invoice",
  "invoice-sent",
] as const;

/**
 * The run of work for material we are buying off the client and selling on.
 * Money going out: do the job, weigh it, raise a purchase order, pay them.
 */
export const PURCHASE_STATUSES = [
  "booked",
  "weighed",
  "po-raised",
  "paid",
] as const;

/** Every status either path can use. */
export const JOB_STATUSES = [
  "booked",
  "weighed",
  "generate-invoice",
  "invoice-sent",
  "po-raised",
  "paid",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** The four statuses a job of this kind moves through, in order. */
export function statusesFor(
  direction: JobDirection,
): readonly JobStatus[] {
  return direction === "sale" ? SALE_STATUSES : PURCHASE_STATUSES;
}

export function isStatusValidFor(
  status: JobStatus,
  direction: JobDirection,
): boolean {
  return statusesFor(direction).includes(status);
}

/**
 * The same point on the other path, used when a job is switched between a sale
 * and a purchase. Both paths have four stages, so a job three steps along
 * stays three steps along rather than dropping back to the start.
 */
export function equivalentStatus(
  status: JobStatus,
  newDirection: JobDirection,
): JobStatus {
  const from = statusesFor(newDirection === "sale" ? "purchase" : "sale");
  const stage = from.indexOf(status);
  if (stage === -1) return status;
  return statusesFor(newDirection)[stage];
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  booked: "Booked",
  weighed: "Weighed",
  "generate-invoice": "Generate invoice",
  "invoice-sent": "Invoice sent",
  "po-raised": "PO raised",
  paid: "Paid",
};

export const STATUS_HINTS: Record<JobStatus, string> = {
  booked: "In the diary, not done yet",
  weighed: "Weighbridge ticket in",
  "generate-invoice": "Ready to invoice, not sent",
  "invoice-sent": "Invoice out, waiting on payment",
  "po-raised": "Order out to them, not paid yet",
  paid: "We have paid them",
};

/**
 * Statuses a job has already been weighed at. From "weighed" onwards the
 * weight is known, so the form asks for it and keeps showing it.
 */
export function isWeighedOrLater(status: JobStatus): boolean {
  return status !== "booked";
}

/**
 * The colour each status shows in. The actual colours live in globals.css so
 * that everything visual stays in one place; these are just the class names
 * that point at them.
 */
export const STATUS_CLASSES: Record<JobStatus, string> = {
  booked: "bg-booked-soft text-booked",
  weighed: "bg-weighed-soft text-weighed",
  "generate-invoice": "bg-generate-soft text-generate",
  "invoice-sent": "bg-sent-soft text-sent",
  "po-raised": "bg-po-soft text-po",
  paid: "bg-paid-soft text-paid",
};

/** The materials a job can be for. "Other" lets you type your own. */
export const JOB_MATERIALS = [
  "Wood",
  "General rubbish",
  "Mixed paper",
  "Corex",
  "Other",
] as const;

/** Common skip sizes, offered as suggestions rather than a fixed list. */
export const SKIP_SIZES = [
  "4 yard",
  "6 yard",
  "8 yard",
  "12 yard",
  "14 yard",
  "16 yard",
  "20 yard",
  "35 yard RoRo",
  "40 yard RoRo",
] as const;

export type Job = {
  id: string;
  /** Which client this is for, matching a Customer id. */
  customerId: string;
  siteAddress: string;
  /**
   * The day of the job as "YYYY-MM-DD", e.g. "2026-09-16".
   *
   * Stored this way rather than as a full timestamp on purpose. A job booked
   * for the 16th is on the 16th whatever the clocks are doing, and this
   * format also sorts correctly when compared as plain text.
   */
  date: string;
  skipSize: string;
  material: string;
  notes: string;
  status: JobStatus;
  /**
   * The weighbridge figure, held in whole kilograms. 2.45 tonnes is stored as
   * 2450, for the same reason money is held in pence: whole numbers do not
   * drift the way decimals do. Null until the job has been weighed.
   */
  weightKg: number | null;
  /** Whether we are charging the client for this job or paying them for it. */
  direction: JobDirection;

  /* Sale side. Both stay null on a purchase. */
  /** The day the invoice went out, as "YYYY-MM-DD". Null until it has. */
  invoiceSentDate: string | null;

  /* Purchase side. All stay null on a sale. */
  /** Our purchase order number, given to the client we are buying from. */
  supplierPO: string | null;
  /** The day that order was raised, which their payment terms run from. */
  poRaisedDate: string | null;
  /** Their invoice number, where they send one. Blank when we self-bill. */
  supplierInvoiceRef: string | null;
  /** The day we paid them. */
  paidDate: string | null;

  /* The other half of each sum, which no rate line can tell us. */
  /**
   * On a sale: what the tip or outlet charged us to take this load, in pence.
   * Null means nobody has recorded it, which is not the same as nothing:
   * profit is left unknown rather than overstated.
   */
  disposalCostPence: number | null;
  /**
   * On a purchase: what the outlet paid us for the load once it was sold on,
   * in pence. Null means not recorded yet. Prices for paper and plastics move
   * week to week, so this is held per load rather than per material.
   */
  onwardSalePence: number | null;

  createdAt: string;
};
