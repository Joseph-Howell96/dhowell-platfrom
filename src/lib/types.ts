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

/** Where a job has got to. They happen in this order, left to right. */
export const JOB_STATUSES = [
  "booked",
  "weighed",
  "generate-invoice",
  "invoice-sent",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const STATUS_LABELS: Record<JobStatus, string> = {
  booked: "Booked",
  weighed: "Weighed",
  "generate-invoice": "Generate invoice",
  "invoice-sent": "Invoice sent",
};

export const STATUS_HINTS: Record<JobStatus, string> = {
  booked: "In the diary, not done yet",
  weighed: "Weighbridge ticket in",
  "generate-invoice": "Ready to invoice, not sent",
  "invoice-sent": "Invoice out, waiting on payment",
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
  /** The day the invoice went out, as "YYYY-MM-DD". Null until it has. */
  invoiceSentDate: string | null;
  createdAt: string;
};
