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
  // Not a material, but it is charged the same way: a rate line per client,
  // at whatever was agreed with them.
  "Haulage",
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
 * One row per material and skip size, holding both figures: what a tonne of
 * the material is worth, and what we charge to come and collect it. Either can
 * be left empty - a material we only haul has no tonnage rate, and a tonnage
 * rate with no haulage means the lorry is not charged separately.
 *
 * The direction applies to the tonnage rate alone. Haulage is always charged
 * to the client, never paid to them.
 */
export type RateLine = {
  id: string;
  material: string;
  /**
   * Which skip this rate is for, e.g. "8 yard". Left blank the rate applies
   * whatever size turns up.
   */
  skipSize: string;
  /** What a tonne of the material is worth, in pence. Null where unpriced. */
  ratePerTonnePence: number | null;
  /** What we charge to collect it, in pence. Null where not charged. */
  haulageRatePence: number | null;
  /** Whether the tonnage rate is charged to the client or paid to them. */
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
 * The run of work for a job we are invoicing out.
 *
 * Just the two: it is in the diary, or it has been weighed. Whether it has
 * been billed is not recorded here. A job is invoiced because it appears on an
 * invoice, and that is the only place it is written down.
 */
export const SALE_STATUSES = ["booked", "weighed"] as const;

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
  "po-raised",
  "paid",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** The statuses a job of this kind moves through, in order. */
export function statusesFor(direction: JobDirection): readonly JobStatus[] {
  return direction === "sale" ? SALE_STATUSES : PURCHASE_STATUSES;
}

export function isStatusValidFor(
  status: JobStatus,
  direction: JobDirection,
): boolean {
  return statusesFor(direction).includes(status);
}

/**
 * Where a job lands when it is switched between a sale and a purchase.
 *
 * Booked and weighed mean the same on both paths, so they carry across. The
 * purchase-only steps have no sale equivalent - there is no purchase order on
 * a job we are invoicing - so those fall back to weighed, which is as far
 * along as a sale job goes on its own.
 */
export function equivalentStatus(
  status: JobStatus,
  newDirection: JobDirection,
): JobStatus {
  if (isStatusValidFor(status, newDirection)) return status;
  return status === "booked" ? "booked" : "weighed";
}

/**
 * How a job reads once whether it has been billed is taken into account.
 *
 * "Invoiced" is not a status anyone sets. It is true when the job appears on
 * an invoice, and stops being true if it is taken off one.
 */
export const JOB_STANDINGS = [
  "booked",
  "weighed",
  "invoiced",
  "po-raised",
  "paid",
] as const;

export type JobStanding = (typeof JOB_STANDINGS)[number];

export const JOB_STANDING_LABELS: Record<JobStanding, string> = {
  booked: "Booked",
  weighed: "Weighed",
  invoiced: "Invoiced",
  "po-raised": "PO raised",
  paid: "Paid",
};

export const JOB_STANDING_CLASSES: Record<JobStanding, string> = {
  booked: "bg-booked-soft text-booked",
  weighed: "bg-weighed-soft text-weighed",
  invoiced: "bg-sent-soft text-sent",
  "po-raised": "bg-po-soft text-po",
  paid: "bg-paid-soft text-paid",
};

/** Where a job reads, given whether it is on an invoice. */
export function jobStanding(status: JobStatus, invoiced: boolean): JobStanding {
  return invoiced ? "invoiced" : status;
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  booked: "Booked",
  weighed: "Weighed",
  "po-raised": "PO raised",
  paid: "Paid",
};

export const STATUS_HINTS: Record<JobStatus, string> = {
  booked: "In the diary, not done yet",
  weighed: "Weighbridge ticket in, ready to bill",
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
  "po-raised": "bg-po-soft text-po",
  paid: "bg-paid-soft text-paid",
};

/** The materials a job can be for. "Other" lets you type your own. */
export const JOB_MATERIALS = [
  "Wood",
  "General rubbish",
  "Mixed paper",
  "Corex",
  "Haulage",
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
  /**
   * Whether haulage is charged on this job as well as the material.
   *
   * One lorry movement is one job, so the haulage sits on the same record
   * rather than needing a second one. It is priced from the client's Haulage
   * rate for this skip size, and shows as its own line on the invoice.
   */
  chargeHaulage: boolean;

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
   * On a rebate job: which outlet the load went to, matching an Outlet id.
   * Their rate for the material is what the load earned.
   */
  outletId: string | null;
  /**
   * On a rebate job: what it cost us to get the load to the outlet, in pence.
   * Margin is the outlet's income less the rebate less this.
   */
  haulageCostPence: number | null;
  /**
   * On a rebate job: what the load actually fetched, in pence, where it went
   * for something other than the outlet's standing rate. Left blank, the
   * outlet's rate is used instead.
   */
  onwardSalePence: number | null;

  createdAt: string;
};

/* ---------------------------------------------------------------------------
 * Outlets
 * ------------------------------------------------------------------------- */

/** What an outlet pays us for a tonne of a given material. */
export type OutletMaterial = {
  id: string;
  material: string;
  /** Held in pence per tonne, as with every other rate. */
  incomePence: number;
};

/**
 * A reprocessor we sell material on to, such as Edwards.
 *
 * Kept apart from clients on purpose: a client is who we collect from, an
 * outlet is who we deliver to, and the money runs the opposite way.
 */
export type Outlet = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  materials: OutletMaterial[];
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

/** Short codes for the stock column, so a line reads like a product. */
const MATERIAL_CODES: Record<string, string> = {
  wood: "WOOD",
  "general rubbish": "GEN",
  "mixed paper": "PAPER",
  corex: "COREX",
  cardboard: "CARD",
  metal: "METAL",
  "green waste": "GREEN",
  haulage: "HAUL",
};

/** The stock code for a material, made up from its name where none is known. */
export function materialCode(material: string): string {
  const known = MATERIAL_CODES[material.trim().toLowerCase()];
  if (known) return known;
  return material.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

/**
 * Where an invoice has got to.
 * "draft"  - put together, not sent, still changeable.
 * "sent"   - gone to the client, the clock is running.
 * "paid"   - settled.
 */
export const INVOICE_STATUSES = ["draft", "sent", "paid"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
};

export const INVOICE_STATUS_CLASSES: Record<InvoiceStatus, string> = {
  draft: "bg-elevated text-muted",
  sent: "bg-sent-soft text-sent",
  paid: "bg-paid-soft text-paid",
};

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
  due: "bg-generate-soft text-generate",
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
  createdAt: string;
};
