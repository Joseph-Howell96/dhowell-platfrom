import "server-only";

/**
 * Where generated invoice PDFs are kept.
 *
 * One file per invoice, named after its number, in a private Supabase Storage
 * bucket. Private because an invoice carries a client's details and what they
 * were charged; nothing reaches one except through this app.
 */
import { db } from "./db";

const BUCKET = "invoices";

/** The file an invoice's PDF is saved as. */
export function pdfFileName(prefix: string, number: number): string {
  // Anything that would upset a file name is taken out of the prefix.
  const safePrefix = prefix.replace(/[^A-Za-z0-9_-]/g, "");
  return `${safePrefix}${number}.pdf`;
}

export async function readSavedPdf(fileName: string): Promise<Uint8Array | null> {
  const { data, error } = await db().storage.from(BUCKET).download(fileName);
  // Nothing filed yet is the ordinary case, not a fault: the caller builds a
  // fresh PDF when this comes back empty.
  if (error) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function savePdf(fileName: string, bytes: Uint8Array): Promise<void> {
  const { error } = await db()
    .storage.from(BUCKET)
    .upload(fileName, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Filing the invoice PDF failed: ${error.message}`);
}

/**
 * Throw away the filed copy, so the next request builds a fresh one.
 *
 * Used when something an invoice was adding up has been deleted underneath it.
 * A sent invoice is normally served from this file untouched, which is right
 * while it still matches the records - and wrong the moment it does not. A
 * missing file is not an error: there may never have been one.
 */
export async function deleteSavedPdf(fileName: string): Promise<void> {
  const { error } = await db().storage.from(BUCKET).remove([fileName]);
  if (error) throw new Error(`Removing the invoice PDF failed: ${error.message}`);
}
