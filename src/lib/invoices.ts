/**
 * Reading and writing invoices, kept in data/invoices.json.
 *
 * An invoice stores which jobs it covers, not a copy of their figures. The
 * numbers are worked out again each time it is opened, so a corrected weight
 * or rate corrects the invoice. The one thing that is fixed for good is the
 * invoice number.
 */
import { randomUUID } from "node:crypto";

import { isValidISODate } from "./calendar";
import { readJsonList, writeJsonList } from "./store";
import { INVOICE_STATUSES, type Invoice, type InvoiceStatus } from "./types";

const FILE = "invoices.json";

function toStatus(value: unknown): InvoiceStatus {
  return INVOICE_STATUSES.includes(value as InvoiceStatus)
    ? (value as InvoiceStatus)
    : "draft";
}

function toInvoice(raw: unknown): Invoice | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  // Without a number or a date it is not an invoice anyone could send.
  if (typeof record.number !== "number" || !Number.isFinite(record.number)) {
    return null;
  }
  if (typeof record.issueDate !== "string" || !isValidISODate(record.issueDate)) {
    return null;
  }
  if (typeof record.customerId !== "string" || record.customerId === "") {
    return null;
  }

  const text = (key: string) =>
    typeof record[key] === "string" ? (record[key] as string) : "";

  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    number: Math.round(record.number),
    customerId: record.customerId,
    issueDate: record.issueDate,
    customerPO: text("customerPO"),
    jobIds: Array.isArray(record.jobIds)
      ? record.jobIds.filter((id): id is string => typeof id === "string")
      : [],
    status: toStatus(record.status),
    paidDate:
      typeof record.paidDate === "string" && isValidISODate(record.paidDate)
        ? record.paidDate
        : null,
    pdfSavedAt: typeof record.pdfSavedAt === "string" ? record.pdfSavedAt : null,
    createdAt: text("createdAt") || new Date().toISOString(),
  };
}

/** Every invoice, newest number first. */
export async function readInvoices(): Promise<Invoice[]> {
  const rows = await readJsonList(FILE);
  return rows
    .map(toInvoice)
    .filter((invoice) => invoice !== null)
    .sort((a, b) => b.number - a.number);
}

export async function readInvoice(id: string): Promise<Invoice | null> {
  const invoices = await readInvoices();
  return invoices.find((invoice) => invoice.id === id) ?? null;
}

/**
 * The number the next invoice gets: one past the highest used so far, or the
 * starting number from settings where none have been raised yet. Worked out
 * from what exists rather than kept in a counter, so it cannot drift.
 */
export function nextInvoiceNumber(
  invoices: Invoice[],
  startNumber: number,
): number {
  const highest = invoices.reduce(
    (top, invoice) => Math.max(top, invoice.number),
    0,
  );
  return highest === 0 ? startNumber : Math.max(highest + 1, startNumber);
}

/** Which jobs are already spoken for, so they cannot be billed twice. */
export function invoicedJobIds(invoices: Invoice[]): Set<string> {
  return new Set(invoices.flatMap((invoice) => invoice.jobIds));
}

export async function addInvoice(
  details: Omit<Invoice, "id" | "createdAt">,
): Promise<Invoice> {
  const invoices = await readInvoices();
  const invoice: Invoice = {
    ...details,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await writeJsonList(FILE, [invoice, ...invoices]);
  return invoice;
}

export async function updateInvoice(
  id: string,
  changes: Partial<Omit<Invoice, "id" | "number" | "createdAt">>,
): Promise<Invoice | null> {
  const invoices = await readInvoices();
  const existing = invoices.find((invoice) => invoice.id === id);
  if (!existing) return null;

  const updated: Invoice = { ...existing, ...changes };
  await writeJsonList(
    FILE,
    invoices.map((invoice) => (invoice.id === id ? updated : invoice)),
  );
  return updated;
}
