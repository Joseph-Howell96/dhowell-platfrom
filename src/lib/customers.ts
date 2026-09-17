/**
 * Reading and writing the client list.
 *
 * For now the whole list lives in one file, data/clients.json. That is
 * deliberate: it is easy to open, read and correct by hand while the shape of
 * the data is still settling. Swapping this file for a real database later
 * means rewriting these two functions and nothing else.
 */
import { randomUUID } from "node:crypto";

import { readJsonList, writeJsonList } from "./store";
import {
  DIRECTIONS,
  LEGACY_BASES,
  type Customer,
  type Direction,
  type RateLine,
} from "./types";

const FILE = "clients.json";

/** Anything read off disk is unknown until we have checked it, so check it. */
function isDirection(value: unknown): value is Direction {
  return DIRECTIONS.includes(value as Direction);
}

function pence(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Read a rate line, in either the shape it has now or the one it had before.
 *
 * Rate lines used to carry a single figure and a basis saying what it meant,
 * so a material we both rebated and charged haulage on needed two rows. They
 * now hold both figures at once, which means those pairs have to be brought
 * together rather than one of them being thrown away.
 */
function toRateLines(raw: unknown): RateLine[] {
  if (!Array.isArray(raw)) return [];

  const merged = new Map<string, RateLine>();

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;

    const material = text(row.material);
    if (material === "") continue;
    const skipSize = text(row.skipSize);

    // One row per material and size; anything sharing both is the same row.
    const key = `${material.toLowerCase()}|${skipSize.toLowerCase()}`;
    const existing = merged.get(key) ?? {
      id: text(row.id) || randomUUID(),
      material,
      skipSize,
      ratePerTonnePence: null,
      haulageRatePence: null,
      direction: "charge" as Direction,
    };

    if ("basis" in row) {
      // The older shape: one figure, and a basis saying which it was.
      const basis = text(row.basis);
      const amount = pence(row.ratePence);
      if (amount === null || !LEGACY_BASES.includes(basis as never)) continue;

      if (basis === "Per tonne") {
        existing.ratePerTonnePence = amount;
        if (isDirection(row.direction)) existing.direction = row.direction;
      } else {
        // A haulage fee, and the older per lift and fixed price, were all one
        // flat amount for turning up. The haulage rate is the only flat figure
        // left, so they go there and keep their value. Putting a per-lift
        // charge into the tonnage rate would multiply it by the load.
        existing.haulageRatePence = amount;
      }
    } else {
      const perTonne = pence(row.ratePerTonnePence);
      const haulage = pence(row.haulageRatePence);
      if (perTonne !== null) existing.ratePerTonnePence = perTonne;
      if (haulage !== null) existing.haulageRatePence = haulage;
      if (isDirection(row.direction)) existing.direction = row.direction;
    }

    merged.set(key, existing);
  }

  // A row with neither figure prices nothing, so it is not worth keeping.
  return [...merged.values()].filter(
    (line) => line.ratePerTonnePence !== null || line.haulageRatePence !== null,
  );
}

function toCustomer(raw: unknown): Customer | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.businessName !== "string") return null;

  const text = (key: string) =>
    typeof record[key] === "string" ? (record[key] as string) : "";

  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    businessName: record.businessName,
    siteAddress: text("siteAddress"),
    billingAddress: text("billingAddress"),
    contactName: text("contactName"),
    phone: text("phone"),
    email: text("email"),
    paymentTermsDays:
      typeof record.paymentTermsDays === "number" &&
      Number.isFinite(record.paymentTermsDays)
        ? record.paymentTermsDays
        : 0,
    notes: text("notes"),
    rateLines: toRateLines(record.rateLines),
    createdAt: text("createdAt") || new Date().toISOString(),
  };
}

/** Every customer we hold, newest first. */
export async function readCustomers(): Promise<Customer[]> {
  const rows = await readJsonList(FILE);
  return rows
    .map(toCustomer)
    .filter((customer) => customer !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Add one customer to the list and save. Returns the customer that was stored. */
export async function addCustomer(
  details: Omit<Customer, "id" | "createdAt">,
): Promise<Customer> {
  const customers = await readCustomers();
  const customer: Customer = {
    ...details,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await writeJsonList(FILE, [customer, ...customers]);
  return customer;
}
