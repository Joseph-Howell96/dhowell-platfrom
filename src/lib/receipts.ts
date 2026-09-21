/**
 * The receipts: what was bought, what it cost, and the photograph of it.
 *
 * A shoebox rather than a ledger. Nothing here is tied to a job or a client on
 * purpose - the things that pile up in a lorry cab are fuel, parts, tip
 * tickets and a sandwich, and making somebody file each one against a job
 * before it can be kept is how receipts end up not being kept at all.
 */
import { randomUUID } from "node:crypto";

import { isValidISODate } from "./calendar";
import { readJsonList, writeJsonList } from "./store";

const FILE = "receipts.json";

export type Receipt = {
  id: string;
  /** The day on the receipt, as "YYYY-MM-DD". */
  date: string;
  /** What it was for, in whatever words the person used. */
  description: string;
  /** What it came to, in pence. Null where nobody typed one. */
  amountPence: number | null;
  notes: string;
  /** The picture, as it sits in data/receipts. */
  fileName: string;
  /** What kind of picture it is, so it can be served back correctly. */
  contentType: string;
  createdAt: string;
};

function toReceipt(raw: unknown): Receipt | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  // A receipt with no picture is not a receipt, and one with no date has
  // nowhere to sit in the list. Either way there is nothing to show.
  const fileName =
    typeof record.fileName === "string" ? record.fileName : "";
  if (fileName === "") return null;
  const date = typeof record.date === "string" ? record.date : "";
  if (!isValidISODate(date)) return null;

  const text = (key: string) =>
    typeof record[key] === "string" ? (record[key] as string) : "";

  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    date,
    description: text("description"),
    // Zero is a real answer, so only a proper number counts.
    amountPence:
      typeof record.amountPence === "number" &&
      Number.isFinite(record.amountPence)
        ? Math.round(record.amountPence)
        : null,
    notes: text("notes"),
    fileName,
    contentType: text("contentType") || "application/octet-stream",
    createdAt: text("createdAt") || new Date().toISOString(),
  };
}

/** Everything kept, newest receipt first - the one just taken is the top one. */
export async function readReceipts(): Promise<Receipt[]> {
  const rows = await readJsonList(FILE);
  return rows
    .map(toReceipt)
    .filter((receipt) => receipt !== null)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
}

export async function readReceipt(id: string): Promise<Receipt | null> {
  return (await readReceipts()).find((receipt) => receipt.id === id) ?? null;
}

export async function addReceipt(
  receipt: Omit<Receipt, "id" | "createdAt"> & { id: string },
): Promise<Receipt> {
  const saved: Receipt = { ...receipt, createdAt: new Date().toISOString() };
  await writeJsonList(FILE, [saved, ...(await readReceipts())]);
  return saved;
}

/** Returns false where the id matches nothing, which is not worth a fuss. */
export async function deleteReceipt(id: string): Promise<boolean> {
  const receipts = await readReceipts();
  if (!receipts.some((receipt) => receipt.id === id)) return false;
  await writeJsonList(
    FILE,
    receipts.filter((receipt) => receipt.id !== id),
  );
  return true;
}
