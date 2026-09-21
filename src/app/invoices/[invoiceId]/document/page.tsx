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

        <DownloadButton href={pdf} fileName={file} title={`Invoice ${number}`} />

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
          page behind it as well, which is maddening on a laptop.

          Nothing inside the iframe. Putting fallback content there is an old
          habit from when some browsers had no iframes at all; in HTML as it is
          now an iframe's content model is nothing, so the browser throws those
          children away while the server has dutifully rendered them - and the
          two disagreeing is a hydration error on a page that otherwise works.
          Unlike <object>, an <iframe> has no fallback. The line underneath
          does that job instead, where it is always visible. */}
      <div className="glass min-h-0 flex-1 overflow-hidden rounded-xl">
        <iframe
          // Fit the width and leave the thumbnail strip shut. Without this the
          // viewer opens at its own zoom, which on a frame this shape means a
          // corner of the letterhead and not one figure. The toolbar is left
          // on deliberately: it carries the page numbers, and an invoice
          // covering a busy week runs to more than one page.
          // Chrome, Edge and Firefox honour these; Safari ignores them harmlessly.
          src={`${pdf}#navpanes=0&view=FitH`}
          title={`${number} as a PDF`}
          className="h-full min-h-[70vh] w-full"
        />
      </div>

      {/* Both of these are said out loud rather than worked out. Whether a
          browser will show a PDF inside a page cannot be asked reliably -
          navigator.pdfViewerEnabled answers yes in places that then show
          nothing - and what "Save" will do depends on the device, which is
          not known until it is pressed. So say both plainly. */}
      <div className="mt-3 space-y-1 text-sm text-muted">
        <p>
          <span className="font-medium text-ink">Save as</span> opens a folder
          picker on a computer. On an iPad it opens the share sheet — choose{" "}
          <span className="font-medium text-ink">Save to Files</span>, then the
          client&rsquo;s folder. The same sheet will mail it or AirDrop it.
        </p>
        <p>
          Nothing showing above?{" "}
          <a href={pdf} target="_blank" rel="noreferrer" className="text-accent underline">
            Open it on its own
          </a>{" "}
          — some browsers, iPads especially, will not put a PDF inside a page.
        </p>
      </div>
    </main>
  );
}
