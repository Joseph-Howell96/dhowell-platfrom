import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import DownloadButton from "./download-button";
import { readInvoice } from "@/lib/invoices";
import { pdfFileName } from "@/lib/invoice-files";
import { formatInvoiceNumber } from "@/lib/invoicing";
import { readSettings } from "@/lib/settings";
import { requireSession } from "@/lib/guard";

export const metadata: Metadata = {
  title: "Invoice PDF",
};

/**
 * The PDF with the app still around it.
 *
 * The PDF itself lives at .../pdf and is the plain file - which is what makes
 * it downloadable and printable, and also what made it a dead end: opening it
 * handed the whole window to the browser's own viewer, with no way back to the
 * invoice except the browser's back arrow, and on an iPad not even that.
 *
 * So the file stays where it is and this page wraps it: a bar with a way back
 * and a way to save, and the document itself underneath.
 */
export default async function InvoiceDocumentPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  await connection();
  await requireSession("/invoices");

  const { invoiceId } = await params;
  const invoice = await readInvoice(invoiceId);
  if (!invoice) notFound();

  const settings = await readSettings();
  const number = formatInvoiceNumber(settings.invoiceNumberPrefix, invoice.number);
  const file = pdfFileName(settings.invoiceNumberPrefix, invoice.number);
  const pdf = `/invoices/${invoiceId}/pdf`;

  return (
    <main className="flex min-h-screen flex-col px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/invoices/${invoiceId}`}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          ← Back to invoice
        </Link>

        <h1 className="mr-auto text-lg font-semibold">{number}</h1>

        <DownloadButton href={pdf} fileName={file} />

        {/* Opens the file on its own, which is what an iPad wants for
            printing, mailing or handing to another app. */}
        <a
          href={pdf}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          Open on its own
        </a>
      </div>

      {/* Tall enough to read a whole page of an invoice without scrolling the
          page behind it as well, which is maddening on a laptop. */}
      <div className="glass min-h-0 flex-1 overflow-hidden rounded-xl">
        <iframe
          src={pdf}
          title={`${number} as a PDF`}
          className="h-full min-h-[70vh] w-full"
        >
          {/* Shown where a browser will not put a PDF inside a page. Some
              versions of Safari on an iPad will not, so this is not a
              theoretical fallback. */}
          <p className="p-6 text-sm">
            This browser will not show the PDF here.{" "}
            <a href={pdf} className="text-accent underline">
              Open it on its own
            </a>
            .
          </p>
        </iframe>
      </div>
    </main>
  );
}
