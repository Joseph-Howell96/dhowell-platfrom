import "server-only";

/**
 * Where receipt photographs are kept.
 *
 * One file per receipt, named after its id, in a private Supabase Storage
 * bucket. Private matters: a receipt is a photograph of somebody's real
 * paperwork, and the bucket having no public address means the only way to
 * one is through this app, which asks who is looking first.
 *
 * The picture is stored exactly as the camera produced it. Shrinking it would
 * need an image library and would throw away detail on the one thing that has
 * to stay readable - the small print at the bottom of a weighbridge ticket.
 */
import { db } from "./db";

const BUCKET = "receipts";

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
  contentType = "application/octet-stream",
): Promise<void> {
  const { error } = await db()
    .storage.from(BUCKET)
    // Uint8Array rather than a Blob, because this runs on the server and a
    // Blob would mean copying the whole photograph again for nothing.
    .upload(fileName, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Saving the photograph failed: ${error.message}`);
}

export async function readReceiptFile(
  fileName: string,
): Promise<Uint8Array | null> {
  const { data, error } = await db().storage.from(BUCKET).download(fileName);
  if (error) {
    // A missing object is not a fault worth an error page. The record says
    // there is a photograph and the bucket disagrees, which shows as a
    // receipt with no picture - true, and more use than a crash.
    return null;
  }
  return new Uint8Array(await data.arrayBuffer());
}

/** A missing file is not an error: there may never have been one. */
export async function deleteReceiptFile(fileName: string): Promise<void> {
  // remove() treats a name that is not there as nothing to do, so there is no
  // "already gone" case to handle.
  const { error } = await db().storage.from(BUCKET).remove([fileName]);
  if (error) throw new Error(`Removing the photograph failed: ${error.message}`);
}
