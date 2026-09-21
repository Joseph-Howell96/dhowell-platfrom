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

    // One row per material. Records written when rates were also split by
    // skip size will have several rows for the same material; they fold
    // together here, the last one read setting each figure. A client who
    // charged different rates for different sizes therefore needs their rate
    // looking at once, which is the honest outcome - the alternative is
    // silently picking one of two prices and never saying so.
    const key = material.toLowerCase();
    const existing = merged.get(key) ?? {
      id: text(row.id) || randomUUID(),
      material,
      ratePerTonnePence: null,
      direction: "charge" as Direction,
      onwardRatePerTonnePence: null,
    };

    if ("basis" in row) {
      // The older shape: one figure, and a basis saying which it was.
      const basis = text(row.basis);
      const amount = pence(row.ratePence);
      if (amount === null || !LEGACY_BASES.includes(basis as never)) continue;

      if (basis === "Per tonne") {
        existing.ratePerTonnePence = amount;
        if (isDirection(row.direction)) existing.direction = row.direction;
      }
      // A haulage fee, and the older per lift and fixed price, were all one
      // flat amount for turning up. Haulage is one figure on the client now,
      // read separately below, so nothing is done with them here.
    } else {
      const perTonne = pence(row.ratePerTonnePence);
      if (perTonne !== null) existing.ratePerTonnePence = perTonne;
      if (isDirection(row.direction)) existing.direction = row.direction;
      // Absent on every record written before this existed, which reads as
      // null and simply leaves the second figure to the job, as before.
      const onward = pence(row.onwardRatePerTonnePence);
      if (onward !== null) existing.onwardRatePerTonnePence = onward;
    }

    merged.set(key, existing);
  }

  // A row with no rate prices nothing, so it is not worth keeping.
  return [...merged.values()].filter(
    (line) => line.ratePerTonnePence !== null,
  );
}

/**
 * The client's haulage fee, in pence.
 *
 * Records written before haulage became one figure per client carry it on
 * their rate lines instead - sometimes a line filed under "Haulage", sometimes
 * one against a particular material. The general one is taken where there is
 * one, otherwise the first that exists, so an existing client keeps charging
 * what they were charging. Nothing to go on means zero, which shows on their
 * record as a fee somebody has to look at rather than a blank.
 */
function toHaulageFee(record: Record<string, unknown>): number {
  const direct = pence(record.haulageFeePence);
  if (direct !== null) return direct;

  const lines = Array.isArray(record.rateLines) ? record.rateLines : [];
  const rows = lines.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null,
  );
  const named = rows.find(
    (row) => text(row.material).trim().toLowerCase() === "haulage",
  );
  const fee =
    pence(named?.haulageRatePence) ??
    pence(named?.ratePence) ??
    rows.map((row) => pence(row.haulageRatePence)).find((v) => v !== null) ??
    null;
  return fee ?? 0;
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
    haulageFeePence: toHaulageFee(record),
    rateLines: toRateLines(record.rateLines),
    archivedAt:
      typeof record.archivedAt === "string" ? record.archivedAt : null,
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

/** Just the clients still in use, for lists and for picking one out of. */
export async function readActiveCustomers(): Promise<Customer[]> {
  return (await readCustomers()).filter((customer) => customer.archivedAt === null);
}

/** Add one customer to the list and save. Returns the customer that was stored. */
export async function addCustomer(
  details: Omit<Customer, "id" | "createdAt" | "archivedAt">,
): Promise<Customer> {
  const customers = await readCustomers();
  const customer: Customer = {
    ...details,
    id: randomUUID(),
    archivedAt: null,
    createdAt: new Date().toISOString(),
  };
  await writeJsonList(FILE, [customer, ...customers]);
  return customer;
}

/**
 * Change an existing client. Returns the updated record, or null where the id
 * matches nothing.
 */
export async function updateCustomer(
  id: string,
  changes: Partial<Omit<Customer, "id" | "createdAt">>,
): Promise<Customer | null> {
  const customers = await readCustomers();
  const existing = customers.find((customer) => customer.id === id);
  if (!existing) return null;

  const updated: Customer = { ...existing, ...changes, id: existing.id };
  await writeJsonList(
    FILE,
    customers.map((customer) => (customer.id === id ? updated : customer)),
  );
  return updated;
}
