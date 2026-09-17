import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import MarkPaidButton from "./mark-paid-button";
import PageHeader from "@/components/page-header";
import { requireSession } from "@/lib/guard";
import { readCustomers } from "@/lib/customers";
import { formatDateGB } from "@/lib/dates";
import { readDeletedInvoices, readInvoices } from "@/lib/invoices";
import { formatInvoiceNumber, invoiceGrossPence } from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Finance",
};

/**
 * One invoice, as it reads on the list: client, number, date, amount, and
 * whether the money has come in.
 */
type Row = {
  id: string;
  number: number;
  reference: string;
  clientName: string;
  date: string;
  grossPence: number;
  paid: boolean;
};

/**
 * A button that is really a link: opening or saving a PDF is a plain request
 * for a file, not something that changes a record.
 *
 * Sized and worded to match the real buttons next to it, because from the
 * outside they are all just things to press.
 */
function LinkButton({
  href,
  children,
  download,
}: {
  href: string;
  children: string;
  /** Save the file rather than open it. */
  download?: boolean;
}) {
  return (
    <a
      href={href}
      {...(download
        ? { download: "" }
        : { target: "_blank", rel: "noreferrer" })}
      className="rounded-lg border-2 border-line px-5 py-3 text-base font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </a>
  );
}

export default async function FinancePage() {
  // Read the files on every visit, so the list is what is on disk now.
  await connection();
  await requireSession("/finance");

  const [jobs, customers, settings, invoices, deleted] = await Promise.all([
    readJobs(),
    readCustomers(),
    readSettings(),
    readInvoices(),
    readDeletedInvoices(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  const named = (customerId: string) =>
    clientsById.get(customerId)?.businessName ?? "Unknown client";

  const rows: Row[] = invoices
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      reference: formatInvoiceNumber(
        settings.invoiceNumberPrefix,
        invoice.number,
      ),
      clientName: named(invoice.customerId),
      date: invoice.issueDate,
      grossPence: invoiceGrossPence(
        invoice,
        jobsById,
        clientsById.get(invoice.customerId),
        settings.vatPercent,
      ),
      paid: invoice.status === "paid",
    }))
    // Newest at the bottom, so the list reads like a ledger and the invoice
    // just raised is the last thing on the page.
    .sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);

  const unpaid = rows.filter((row) => !row.paid);
  const owed = unpaid.reduce((sum, row) => sum + row.grossPence, 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10">
      <PageHeader title="Finance" description="Every invoice, oldest first." />

      {rows.length === 0 ? (
        <div className="glass-dashed rounded-xl px-6 py-16 text-center">
          <p className="text-lg font-medium">No invoices yet</p>
          <p className="mx-auto mt-2 max-w-md text-base text-muted">
            Mark a job complete on the calendar, then press &ldquo;Generate
            invoices&rdquo; at the end of that week. The invoice appears here.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-base text-muted">
            {rows.length} {rows.length === 1 ? "invoice" : "invoices"}.{" "}
            {unpaid.length === 0 ? (
              "All paid."
            ) : (
              <>
                <span className="font-semibold text-ink">
                  {formatPence(owed)}
                </span>{" "}
                still to come in, across {unpaid.length}{" "}
                {unpaid.length === 1 ? "invoice" : "invoices"}.
              </>
            )}
          </p>

          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="glass rounded-xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                  <div className="min-w-0">
                    <p className="text-xl font-semibold">{row.clientName}</p>
                    <p className="mt-1 text-base text-muted">
                      {/* Underlined rather than lit up on hover: a thing you
                          can press has to look like one before the mouse gets
                          there. */}
                      <Link
                        href={`/invoices/${row.id}`}
                        className="font-semibold text-accent underline underline-offset-2"
                      >
                        {row.reference}
                      </Link>{" "}
                      · {formatDateGB(row.date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatPence(row.grossPence)}
                    </p>
                    <p
                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-base font-semibold ${
                        row.paid
                          ? "bg-sent-soft text-sent"
                          : "bg-attention-soft text-attention"
                      }`}
                    >
                      {row.paid ? "Paid" : "Not paid"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <LinkButton href={`/invoices/${row.id}/pdf`}>
                    Open PDF
                  </LinkButton>
                  {/* The same file, asked for as a download, so it lands in
                      the Downloads folder ready to attach to an e-mail. */}
                  <LinkButton
                    href={`/invoices/${row.id}/pdf?download=yes`}
                    download
                  >
                    Download PDF
                  </LinkButton>
                  {/* Set apart from the two PDF buttons, so a hand going for
                      "Download PDF" cannot land on the one that changes a
                      record. */}
                  <span className="sm:ml-4">
                    <MarkPaidButton invoiceId={row.id} paid={row.paid} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {deleted.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Deleted invoices</h2>
          <p className="mt-1 mb-3 text-base text-muted">
            Withdrawn, and not counted in anything above. Open one to put it
            back.
          </p>
          <ul className="glass-dashed divide-y divide-line overflow-hidden rounded-xl">
            {deleted.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-base text-muted"
              >
                <span className="font-semibold line-through">
                  {formatInvoiceNumber(
                    settings.invoiceNumberPrefix,
                    invoice.number,
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {named(invoice.customerId)}
                </span>
                <span>
                  deleted{" "}
                  {formatDateGB((invoice.deletedAt as string).slice(0, 10))}
                </span>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="font-semibold text-accent underline underline-offset-2"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
