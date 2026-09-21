/**
 * Where receipt photographs are kept.
 *
 * One file per receipt, named after its id, in data/receipts. They are not
 * committed with the code: they are photographs of somebody's real paperwork,
 * and they are not source.
 *
 * The picture is stored exactly as the camera produced it. Shrinking it would
 * need an image library and would throw away detail on the one thing that has
 * to stay readable - the small print at the bottom of a weighbridge ticket.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const RECEIPT_DIR = path.join(process.cwd(), "data", "receipts");

/** The kinds of picture a phone or a scanner actually produces. */
export const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/** Ten megabytes, which is a generous phone photograph and a mean video. */
export const LARGEST_RECEIPT = 10 * 1024 * 1024;

/** The file a receipt's picture is saved as. */
export function receiptFileName(id: string, extension: string): string {
  // The id is ours and the extension comes off the list above, so neither can
  // carry a path separator into this.
  return `${id}.${extension}`;
}

export async function saveReceiptFile(
  fileName: string,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(RECEIPT_DIR, { recursive: true });
  await writeFile(path.join(RECEIPT_DIR, fileName), bytes);
}

export async function readReceiptFile(
  fileName: string,
): Promise<Uint8Array | null> {
  try {
    return await readFile(path.join(RECEIPT_DIR, fileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** A missing file is not an error: there may never have been one. */
export async function deleteReceiptFile(fileName: string): Promise<void> {
  try {
    await unlink(path.join(RECEIPT_DIR, fileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
