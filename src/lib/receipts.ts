/**
 * The receipts: what was bought, what it cost, and the photograph of it.
 *
 * A shoebox rather than a ledger. Nothing here is tied to a job or a client on
 * purpose - the things that pile up in a lorry cab are fuel, parts, tip
 * tickets and a sandwich, and making somebody file each one against a job
 * before it can be kept is how receipts end up not being kept at all.
 */
import { db, orThrow } from "./db";

export type Receipt = {
  id: string;
  /** The day on the receipt, as "YYYY-MM-DD". */
  date: string;
  /** What it was for, in whatever words the person used. */
  description: string;
  /** What it came to, in pence, VAT included. Null where nobody typed one. */
  amountPence: number | null;
  /**
   * The VAT inside that, in pence. Null where nobody typed one.
   *
   * Typed rather than worked out, because not everything carries it: food is
   * zero-rated, insurance is exempt, and a small supplier may not be
   * registered at all. The form offers the standard share as a starting point
   * and anyone can change it or zero it, which is the only way a reclaim total
   * is worth adding up.
   */
  vatPence: number | null;
  notes: string;
  /** The picture, as it sits in the receipts bucket. */
  fileName: string;
  /** What kind of picture it is, so it can be served back correctly. */
  contentType: string;
  createdAt: string;
};

type Row = {
  id: string;
  receipt_date: string;
  description: string | null;
  amount_pence: number | null;
  vat_pence: number | null;
  notes: string | null;
  file_name: string;
  content_type: string | null;
  created_at: string;
};

function toReceipt(row: Row): Receipt {
  return {
    id: row.id,
    date: row.receipt_date,
    description: row.description ?? "",
    amountPence: row.amount_pence,
    vatPence: row.vat_pence,
    notes: row.notes ?? "",
    fileName: row.file_name,
    contentType: row.content_type || "application/octet-stream",
    createdAt: row.created_at,
  };
}

const COLUMNS =
  "id, receipt_date, description, amount_pence, vat_pence, notes, file_name, content_type, created_at";

/** Everything kept, newest receipt first - the one just taken is the top one. */
export async function readReceipts(): Promise<Receipt[]> {
  const rows = orThrow<Row[]>(
    "Reading the receipts",
    await db()
      .from("receipts")
      .select(COLUMNS)
      // Two orderings, not one. Several receipts carry the same day, and the
      // one just photographed has to come out on top of the others from that
      // morning rather than wherever the database felt like putting it.
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Row[]>(),
  );
  return rows.map(toReceipt);
}

export async function readReceipt(id: string): Promise<Receipt | null> {
  const { data, error } = await db()
    .from("receipts")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<Row>();
  if (error) throw new Error(`Reading a receipt failed: ${error.message}`);
  return data ? toReceipt(data) : null;
}

export async function addReceipt(
  receipt: Omit<Receipt, "id" | "createdAt"> & { id: string },
): Promise<Receipt> {
  const saved = orThrow<Row>(
    "Saving a receipt",
    await db()
      .from("receipts")
      .insert({
        id: receipt.id,
        receipt_date: receipt.date,
        description: receipt.description,
        amount_pence: receipt.amountPence,
        vat_pence: receipt.vatPence,
        notes: receipt.notes,
        file_name: receipt.fileName,
        content_type: receipt.contentType,
      })
      .select(COLUMNS)
      .single<Row>(),
  );
  return toReceipt(saved);
}

/** Returns false where the id matches nothing, which is not worth a fuss. */
export async function deleteReceipt(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("receipts")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Deleting a receipt failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
