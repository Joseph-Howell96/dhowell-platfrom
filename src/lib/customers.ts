/**
 * Reading and writing the client list.
 *
 * For now the whole list lives in one file, data/clients.json. That is
 * deliberate: it is easy to open, read and correct by hand while the shape of
 * the data is still settling. Swapping this file for a real database later
 * means rewriting these two functions and nothing else.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  BASES,
  DIRECTIONS,
  type Basis,
  type Customer,
  type Direction,
  type RateLine,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "clients.json");

/** Anything read off disk is unknown until we have checked it, so check it. */
function isBasis(value: unknown): value is Basis {
  return BASES.includes(value as Basis);
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
  let contents: string;
  try {
    contents = await readFile(DATA_FILE, "utf8");
  } catch (error) {
    // No file yet simply means no customers yet, which is not an error.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  if (contents.trim() === "") return [];

  const parsed: unknown = JSON.parse(contents);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(toCustomer)
    .filter((customer) => customer !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Save the list back to disk.
 *
 * Written to a temporary file first, then renamed over the real one. A rename
 * either happens completely or not at all, so a crash mid-save leaves the
 * previous list intact rather than half a file of broken JSON.
 */
async function writeCustomers(customers: Customer[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryFile = `${DATA_FILE}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(customers, null, 2)}\n`, "utf8");
  await rename(temporaryFile, DATA_FILE);
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
  await writeCustomers([customer, ...customers]);
  return customer;
}
