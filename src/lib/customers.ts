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
  ALL_BASES,
  DIRECTIONS,
  type Basis,
  type Customer,
  type Direction,
  type RateLine,
} from "./types";

const FILE = "clients.json";

/** Anything read off disk is unknown until we have checked it, so check it. */
/** Anything ever offered counts, so an older rate line is not thrown away. */
function isBasis(value: unknown): value is Basis {
  return ALL_BASES.includes(value as Basis);
}

function isDirection(value: unknown): value is Direction {
  return DIRECTIONS.includes(value as Direction);
}

function toRateLine(raw: unknown): RateLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const line = raw as Record<string, unknown>;
  if (typeof line.material !== "string") return null;
  if (!isBasis(line.basis)) return null;
  if (typeof line.ratePence !== "number" || !Number.isFinite(line.ratePence)) {
    return null;
  }
  if (!isDirection(line.direction)) return null;
  return {
    id: typeof line.id === "string" ? line.id : randomUUID(),
    material: line.material,
    skipSize: typeof line.skipSize === "string" ? line.skipSize.trim() : "",
    basis: line.basis,
    ratePence: Math.round(line.ratePence),
    direction: line.direction,
  };
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
    rateLines: Array.isArray(record.rateLines)
      ? record.rateLines.map(toRateLine).filter((line) => line !== null)
      : [],
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
