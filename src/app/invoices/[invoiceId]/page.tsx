import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import InvoiceActions from "./invoice-actions-bar";
import { readCustomers } from "@/lib/customers";
import { addCalendarDays, formatDateGB } from "@/lib/dates";
import { readInvoice } from "@/lib/invoices";
import { formatInvoiceNumber, linesForJobs, totalsForLines } from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";
import { INVOICE_STATUS_CLASSES, INVOICE_STATUS_LABELS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Invoice",
};

/** A labelled line in the Bill To block, left out entirely when blank. */
function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-muted print:text-black">{label}</span>
      <span className="whitespace-pre-line">{value}</span>
    </div>
  );
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  await connection();

  const { invoiceId } = await params;
  const invoice = await readInvoice(invoiceId);
  if (!invoice) notFound();

  const [customers, jobs, settings] = await Promise.all([
    readCustomers(),
    readJobs(),
    readSettings(),
  ]);

  const client = customers.find((c) => c.id === invoice.customerId);
  const billed = invoice.jobIds
    .map((id) => jobs.find((job) => job.id === id))
    .filter((job) => job !== undefined);

  const lines = linesForJobs(billed, client);
  const totals = totalsForLines(lines, settings.vatPercent);
  const dueDate = addCalendarDays(invoice.issueDate, settings.paymentTermsDays);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10 print:max-w-none print:px-0 print:py-0">
      {/* Everything in this bar is for working with the invoice, so none of it
          belongs on the printed page. */}
      <div className="print:hidden">
        <Link
          href="/invoices"
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          ← Back to invoices
        </Link>
        <div className="mt-4 mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {formatInvoiceNumber(settings.invoiceNumberPrefix, invoice.number)}
            </h1>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${INVOICE_STATUS_CLASSES[invoice.status]}`}
            >
              {INVOICE_STATUS_LABELS[invoice.status]}
            </span>
          </div>
          <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
        </div>
      </div>

      {/* The document. White on black is unreadable on paper, so it is plain
          black on white whichever way the screen is set. */}
      <article className="rounded-xl border border-line bg-white p-10 text-black print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-gray-300 pb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Invoice</h2>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 text-gray-500">Invoice no.</dt>
                <dd className="font-medium">
                  {formatInvoiceNumber(settings.invoiceNumberPrefix, invoice.number)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 text-gray-500">Date</dt>
                <dd>{formatDateGB(invoice.issueDate)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 text-gray-500">Due</dt>
                <dd>{formatDateGB(dueDate)}</dd>
              </div>
            </dl>
          </div>
          <div className="text-right text-sm">
            <p className="text-lg font-semibold">
              {settings.companyName || "Company name not set"}
            </p>
            <p className="mt-1 whitespace-pre-line text-gray-700">
              {settings.address}
            </p>
            {settings.phone ? (
              <p className="mt-1 text-gray-700">Phone: {settings.phone}</p>
            ) : null}
            {settings.email ? (
              <p className="text-gray-700">E-mail: {settings.email}</p>
            ) : null}
          </div>
        </header>

        <section className="border-b border-gray-300 py-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Bill to
          </h3>
          <div className="space-y-1 text-sm">
            <Detail label="Company" value={client?.businessName ?? ""} />
            <Detail label="Name" value={client?.contactName ?? ""} />
            <Detail label="Address" value={client?.billingAddress || client?.siteAddress || ""} />
            <Detail label="Phone" value={client?.phone ?? ""} />
            <Detail label="Email" value={client?.email ?? ""} />
            <Detail label="PO / Ref" value={invoice.customerPO} />
          </div>
        </section>

        <table className="w-full py-6 text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="py-2 font-semibold">SKU</th>
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit price</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-500">
                  No billable lines. The jobs on this invoice have no matching
                  rate on the client record.
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.jobId} className="border-b border-gray-200">
                  <td className="py-2.5 align-top">{line.sku}</td>
                  <td className="py-2.5 align-top">{line.description}</td>
                  <td className="py-2.5 text-right align-top tabular-nums">
                    {line.quantity % 1 === 0
                      ? line.quantity
                      : line.quantity.toFixed(2)}
                  </td>
                  <td className="py-2.5 text-right align-top tabular-nums">
                    {formatPence(line.unitPricePence)}
                  </td>
                  <td className="py-2.5 text-right align-top tabular-nums">
                    {formatPence(line.amountPence)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex justify-end pt-4">
          <dl className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Subtotal</dt>
              <dd className="tabular-nums">{formatPence(totals.netPence)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">VAT {settings.vatPercent}%</dt>
              <dd className="tabular-nums">{formatPence(totals.vatPence)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-1 text-base font-semibold">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{formatPence(totals.grossPence)}</dd>
            </div>
          </dl>
        </div>

        <footer className="mt-10 grid gap-8 border-t border-gray-300 pt-6 text-sm sm:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold">Terms &amp; other comments</h3>
            <p className="text-gray-700">
              Payment terms {settings.paymentTermsDays} days from invoice.
            </p>
            <p className="text-gray-700">
              Please note invoice number in payment method.
            </p>
            {settings.companyName ? (
              <p className="mt-2 text-gray-700">
                {settings.companyName} terms &amp; conditions of sale.
              </p>
            ) : null}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Banking information</h3>
            {settings.bankAccountName ? (
              <p className="text-gray-700">{settings.bankAccountName}</p>
            ) : null}
            {settings.bankAccountNumber ? (
              <p className="text-gray-700">
                Account no: {settings.bankAccountNumber}
              </p>
            ) : null}
            {settings.bankSortCode ? (
              <p className="text-gray-700">Sort code: {settings.bankSortCode}</p>
            ) : null}
            {settings.vatNumber ? (
              <p className="text-gray-700">VAT no: {settings.vatNumber}</p>
            ) : null}
          </div>
        </footer>

        <p className="mt-8 border-t border-gray-300 pt-4 text-center text-xs text-gray-600">
          {settings.address.split("\n").join(", ")}
          {settings.companyNumber
            ? ` · Company registration no: ${settings.companyNumber}`
            : ""}
        </p>
      </article>
    </main>
  );
}
