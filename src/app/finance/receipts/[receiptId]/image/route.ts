/**
 * The photograph of one receipt.
 *
 * Served through the app rather than from a public folder so that the same
 * rule as the rest of Finance applies: signed in, and an admin. A photograph
 * of a receipt carries a card number often enough that it should not sit at a
 * guessable address with nothing in front of it.
 */
import { readSession } from "@/lib/session";
import { readReceiptFile } from "@/lib/receipt-files";
import { readReceipt } from "@/lib/receipts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const session = await readSession();
  if (session?.role !== "admin") {
    return new Response("Not yours to look at", { status: 403 });
  }

  const { receiptId } = await params;
  const receipt = await readReceipt(receiptId);
  if (!receipt) return new Response("No such receipt", { status: 404 });

  const bytes = await readReceiptFile(receipt.fileName);
  if (!bytes) return new Response("The picture is missing", { status: 404 });

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": receipt.contentType,
      // It never changes once taken, but it is also nobody else's business,
      // so it is cached by the one browser looking at it and nowhere else.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
