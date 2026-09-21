/**
 * The PDF for one invoice.
 *
 * Asking for this address builds the PDF, saves it and hands it back, so
 * downloading one and keeping a copy are the same action - there is no way to
 * send an invoice without a copy of it being filed.
 *
 * A draft is rebuilt every time, because it is still being changed. Once an
 * invoice has been sent the saved file is served untouched, so what the client
 * received is what stays on record even if a rate is corrected afterwards.
 *
 * Add ?download and the same file comes back as a download instead of opening
 * in the browser's viewer, so it can be saved and attached to an e-mail.
 *
 * Signed in and an admin, like everything else under Finance. The proxy keeps
 * strangers out of the whole app, but that only asks whether somebody is
 * signed in - not who they are. Without the check below, anybody with an
 * account, including a driver who can only see clients and the calendar,
 * could read any invoice in the business by its address.
 */
import { readCustomers } from "@/lib/customers";
import { addCalendarDays } from "@/lib/dates";
import { pdfFileName, readSavedPdf, savePdf } from "@/lib/invoice-files";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { readInvoice, updateInvoice } from "@/lib/invoices";
import { linesForJobs, totalsForLines } from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import { readSession } from "@/lib/session";
import { readSettings } from "@/lib/settings";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await readSession();
  if (session?.role !== "admin") {
    return new Response("Not yours to look at", { status: 403 });
  }

  const { invoiceId } = await params;
  const wantsDownload =
    new URL(request.url).searchParams.get("download") !== null;
  const invoice = await readInvoice(invoiceId);
  if (!invoice) {
    return new Response("No such invoice", { status: 404 });
  }

  const settings = await readSettings();
  const fileName = pdfFileName(settings.invoiceNumberPrefix, invoice.number);

  const serve = (bytes: Uint8Array) =>
    new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        // "inline" opens it in the browser's own viewer, where it can then be
        // read or printed; "attachment" saves it to the computer instead.
        "Content-Disposition": `${
          wantsDownload ? "attachment" : "inline"
        }; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });

  if (invoice.status !== "draft") {
    const saved = await readSavedPdf(fileName);
    if (saved) return serve(saved);
  }

  const [customers, jobs] = await Promise.all([readCustomers(), readJobs()]);
  const client = customers.find((c) => c.id === invoice.customerId);
  const billed = invoice.jobIds
    .map((id) => jobs.find((job) => job.id === id))
    .filter((job) => job !== undefined);

  const lines = linesForJobs(billed, client);
  const bytes = await renderInvoicePdf({
    invoice,
    client,
    lines,
    totals: totalsForLines(lines, settings.vatPercent),
    settings,
    dueDate: addCalendarDays(invoice.issueDate, settings.paymentTermsDays),
  });

  await savePdf(fileName, bytes);
  await updateInvoice(invoice.id, { pdfSavedAt: new Date().toISOString() });

  return serve(bytes);
}
