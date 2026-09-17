/**
 * Where generated invoice PDFs are kept.
 *
 * One file per invoice, named after its number, in data/invoices. They are not
 * committed with the code: they hold client details and are produced from the
 * records rather than being source.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const PDF_DIR = path.join(process.cwd(), "data", "invoices");

/** The file an invoice's PDF is saved as. */
export function pdfFileName(prefix: string, number: number): string {
  // Anything that would upset a file name is taken out of the prefix.
  const safePrefix = prefix.replace(/[^A-Za-z0-9_-]/g, "");
  return `${safePrefix}${number}.pdf`;
}

export async function readSavedPdf(fileName: string): Promise<Uint8Array | null> {
  try {
    return await readFile(path.join(PDF_DIR, fileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function savePdf(fileName: string, bytes: Uint8Array): Promise<void> {
  await mkdir(PDF_DIR, { recursive: true });
  await writeFile(path.join(PDF_DIR, fileName), bytes);
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
  try {
    await unlink(path.join(PDF_DIR, fileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
