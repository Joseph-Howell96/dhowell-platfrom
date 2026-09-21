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
/**
 * Bases a rate used to be recorded under, before a rate line held both a
 * tonnage rate and a haulage rate at once. Only needed to read older records.
 */
export const LEGACY_BASES = [
  "Per tonne",
  "Haulage fee",
  "Per lift",
  "Fixed price",
] as const;

/**
 * Which way the money flows.
 * "charge" - we invoice the customer for this.
 * "pay"    - we buy the material from the customer, so we owe them.
 */
export const DIRECTIONS = ["charge", "pay"] as const;

export type Direction = (typeof DIRECTIONS)[number];

export const DIRECTION_LABELS: Record<Direction, string> = {
  charge: "Charge",
  pay: "Rebate",
};

/** The longer wording, for places with room to explain which way money goes. */
export const DIRECTION_HINTS: Record<Direction, string> = {
  charge: "We charge the client for this",
  pay: "We pay the client for this and sell it on",
};

/**
 * What a client is charged or paid for one material.
 *
 * One row per material, and one figure: what a tonne of it is worth. The
 * direction says which way that money runs.
 *
 * Haulage is not here. It is one fee per client, on the client record below,
 * because it is a charge for sending the lorry and the lorry costs the same
 * whatever is in the skip.
 */
export type RateLine = {
  id: string;
  material: string;
  /** What a tonne of the material is worth, in pence. Null where unpriced. */
  ratePerTonnePence: number | null;
  /** Whether the tonnage rate is charged to the client or paid to them. */
  direction: Direction;
  /**
   * The other side of the same trade, per tonne, in pence. Null where nobody
   * has set one.
   *
   * Every load has two prices on it. On a charge material we invoice the
   * client to take it away and then pay the tip to be rid of it; on a rebate
   * material we pay the client for it and then sell it on. Only the client's
   * half was ever a rate - the other half had to be typed against each job as
   * a lump sum, which meant that in practice nobody typed it and the profit
   * on the work was simply never known.
   *
   * Setting it here works the second figure out from the weight, the same way
   * the first one is worked out. What a job actually fetched, or actually cost
   * at the weighbridge, still overrides it: this is what we expect, and the
   * job is what happened.
   */
  onwardRatePerTonnePence: number | null;
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
  /**
   * What this client is charged to send the lorry, in pence. Required.
   *
   * Every collection carries it: ten collections in a day is ten haulage
   * charges, because that is ten lorry movements. It is not a tickbox and it
   * is not per material - a client who is not charged for haulage is a client
   * whose fee is zero, said out loud, rather than a field somebody forgot.
   */
  haulageFeePence: number;
  rateLines: RateLine[];
  /**
   * When the client was archived, as an ISO timestamp, or null while active.
   *
   * Archiving hides a client from the lists and from the boxes you pick one
   * out of, without removing them. Their old jobs and invoices still name
   * them, which deleting would break.
   */
  archivedAt: string | null;
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
  sale: "Charge — we invoice the client",
  purchase: "Rebate — we pay the client",
};

/** Which rate lines produce which kind of job. */
export function directionForRate(rateDirection: Direction): JobDirection {
  return rateDirection === "charge" ? "sale" : "purchase";
}

/**
 * The run of work on a job. Three, and the same three whichever way the money
 * goes: it is in the diary, it has been weighed, someone has checked it off.
 *
 * Whether it has been billed is not one of them. A job is invoiced because it
 * appears on an invoice, and that is the only place it is written down.
 *
 * Raising a purchase order to pay a client for their material is not a status
 * either. It is paperwork that follows a job being checked off, so the order
 * number and its dates are fields on a rebate job rather than steps it moves
 * through - a job does not become less done for an order not being raised yet.
 */
export const JOB_STATUSES = ["booked", "weighed", "complete"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * How a job reads once whether it has been billed is taken into account.
 *
 * "Invoiced" is not a status anyone sets. It is true when the job appears on
 * an invoice, and stops being true if it is taken off one.
 */
export const JOB_STANDINGS = [
  "booked",
  "weighed",
  "complete",
  "invoiced",
] as const;

export type JobStanding = (typeof JOB_STANDINGS)[number];

export const JOB_STANDING_LABELS: Record<JobStanding, string> = {
  booked: "Booked",
  weighed: "Weighed",
  complete: "Complete",
  invoiced: "Invoiced",
};

/**
 * The colour each one shows in, running blue to green as the work moves along.
 * The actual colours live in globals.css; these are the names that point there.
 */
export const JOB_STANDING_CLASSES: Record<JobStanding, string> = {
  booked: "bg-booked-soft text-booked",
  weighed: "bg-weighed-soft text-weighed",
  complete: "bg-attention-soft text-attention",
  invoiced: "bg-sent-soft text-sent",
};

/** Where a job reads, given whether it is on an invoice. */
export function jobStanding(status: JobStatus, invoiced: boolean): JobStanding {
  return invoiced ? "invoiced" : status;
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  booked: "Booked",
  weighed: "Weighed",
  complete: "Complete",
};

export const STATUS_HINTS: Record<JobStatus, string> = {
  booked: "In the diary, not done yet",
  weighed: "Weighbridge ticket in, not checked",
  complete: "Checked and ready to invoice",
};

/**
 * Statuses a job has already been weighed at. From "weighed" onwards the
 * weight is known, so the form asks for it and keeps showing it.
 *
 * This is also what stops a job being marked complete off the back of nothing:
 * complete is one of these statuses, so it cannot be saved without a weight.
 */
export function isWeighedOrLater(status: JobStatus): boolean {
  return status !== "booked";
}

/**
 * Has this job been signed off?
 *
 * "Complete" is the point someone has checked the ticket and said the figures
 * are right. Nothing is invoiced before that, which is the whole point of
 * having the step: a weight on its own is a weighbridge reading, not a
 * decision.
 */
export function isCompleteOrLater(status: JobStatus): boolean {
  return status === "complete";
}

/**
 * The colour each status shows in. The actual colours live in globals.css so
 * that everything visual stays in one place; these are just the class names
 * that point at them.
 */
export const STATUS_CLASSES: Record<JobStatus, string> = {
  booked: "bg-booked-soft text-booked",
  weighed: "bg-weighed-soft text-weighed",
  complete: "bg-attention-soft text-attention",
};

/** The materials a job can be for. "Other" lets you type your own. */
export const JOB_MATERIALS = [
  "Wood",
  "General rubbish",
  "Mixed paper",
  "Corex",
  "Other",
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
  /* Haulage is not recorded on a job at all. Every collection is charged the
     client's haulage fee, so there is nothing to decide and nothing to store -
     the job is the collection, and the fee comes off the client record. */

  /* Purchase side. All stay null on a sale, and none of them is a status:
     they are the paperwork that follows a rebate job being checked off. */
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
   * On a sale: what the tip charged us to take this load, in pence.
   * Null means nobody has recorded it, which is not the same as nothing:
   * profit is left unknown rather than overstated.
   */
  disposalCostPence: number | null;
  /**
   * On a rebate job: what it cost us to get the load away, in pence.
   * Margin is what it sold on for, less the rebate, less this.
   */
  haulageCostPence: number | null;
  /**
   * On a rebate job: what the load fetched when it was sold on, in pence.
   * Null until somebody records it, which leaves the job with a cost and no
   * income rather than a loss.
   */
  onwardSalePence: number | null;

  createdAt: string;
};

/* ---------------------------------------------------------------------------
 * Company settings
 * ------------------------------------------------------------------------- */

/**
 * The details that belong on an invoice: who we are, how to pay us, and how
 * long a client has to do it.
 *
 * Held as data rather than written into the code so that a change of address
 * or bank account is a thing someone types in, not a change a developer makes.
 */
export type CompanySettings = {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  vatNumber: string;
  companyNumber: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankSortCode: string;
  /** How many days a client has to pay, counted from the invoice date. */
  paymentTermsDays: number;
  /** VAT charged on an invoice, as a percentage. */
  vatPercent: number;
  /** What goes in front of an invoice number, e.g. "INV-". */
  invoiceNumberPrefix: string;
  /** Where numbering starts, so an existing series can be carried on. */
  invoiceNumberStart: number;
};

/* ---------------------------------------------------------------------------
 * Invoices
 * ------------------------------------------------------------------------- */

/**
 * Where an invoice has got to.
 * "draft"  - put together, not sent, still changeable.
 * "sent"   - gone to the client, the clock is running.
 * "paid"   - settled.
 */
export const INVOICE_STATUSES = ["draft", "sent", "paid"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * How an invoice reads on screen.
 *
 * Only two of these are anyone's to choose. An invoice is sent, or it is
 * settled; whether a sent one is merely due or actually late is a matter of
 * the date, worked out fresh each time rather than set by hand and forgotten.
 */
export const INVOICE_STANDINGS = ["draft", "due", "overdue", "paid"] as const;

export type InvoiceStanding = (typeof INVOICE_STANDINGS)[number];

export const STANDING_LABELS: Record<InvoiceStanding, string> = {
  draft: "Draft",
  due: "Due",
  overdue: "Overdue",
  paid: "Paid",
};

export const STANDING_CLASSES: Record<InvoiceStanding, string> = {
  draft: "bg-elevated text-muted",
  due: "bg-attention-soft text-attention",
  overdue: "bg-danger-soft text-danger",
  paid: "bg-sent-soft text-sent",
};

/** Where an invoice stands today, given when it falls due. */
export function invoiceStanding(
  status: InvoiceStatus,
  dueDate: string,
  today: string,
): InvoiceStanding {
  if (status === "paid") return "paid";
  if (status === "draft") return "draft";
  return today > dueDate ? "overdue" : "due";
}

/**
 * One invoice, covering a week's work for a client.
 *
 * It holds which jobs it covers rather than a copy of their figures. The lines
 * are worked out from those jobs each time the invoice is opened, so
 * correcting a weight or a rate corrects the invoice too.
 */
export type Invoice = {
  id: string;
  /** The number that goes on the document, unique and never reused. */
  number: number;
  customerId: string;
  /** The invoice date. Payment terms run from this. */
  issueDate: string;
  /** The client's own purchase order reference, where they use one. */
  customerPO: string;
  /** The jobs being billed. */
  jobIds: string[];
  status: InvoiceStatus;
  paidDate: string | null;
  /**
   * When the PDF was last written out, as an ISO timestamp. Null until one has
   * been. Once an invoice is sent the saved file is kept and served as it was,
   * so what the client received is what stays on record.
   */
  pdfSavedAt: string | null;
  /**
   * When the invoice was deleted, as an ISO timestamp, or null while it stands.
   *
   * Deleting an invoice does not remove it. It is set aside, out of the money
   * owed and off the client's list, but still there to look at - an invoice
   * number that was issued and then withdrawn is a thing a bookkeeper has to
   * be able to account for. The number is never given to another invoice.
   *
   * The jobs it covered are freed by this: nothing else records that a job has
   * been billed, so a job on a deleted invoice goes back to waiting.
   */
  deletedAt: string | null;
  createdAt: string;
};
