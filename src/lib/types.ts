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
