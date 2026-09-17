import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { addCalendarDays, daysBetween, formatDateGB } from "@/lib/dates";
import { readInvoices } from "@/lib/invoices";
import { formatInvoiceNumber, linesForJobs, totalsForLines } from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";
import {
  invoiceStanding,
  STANDING_CLASSES,
  STANDING_LABELS,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Invoices",
};

const headerCell =
  "px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted";

export default async function InvoicesPage() {
  await connection();

  const today = todayISO();
  const [invoices, customers, jobs, settings] = await Promise.all([
    readInvoices(),
    readCustomers(),
    readJobs(),
    readSettings(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));

  const rows = invoices.map((invoice) => {
    const client = clientsById.get(invoice.customerId);
    const billed = invoice.jobIds
      .map((id) => jobs.find((job) => job.id === id))
      .filter((job) => job !== undefined);
    const totals = totalsForLines(
      linesForJobs(billed, client),
      settings.vatPercent,
    );
    const dueDate = addCalendarDays(invoice.issueDate, settings.paymentTermsDays);
    return {
      invoice,
      clientName: client?.businessName ?? "Unknown client",
      jobCount: billed.length,
      totals,
      dueDate,
      daysRemaining: daysBetween(today, dueDate),
      standing: invoiceStanding(invoice.status, dueDate, today),
    };
  });

  const outstanding = rows.filter((row) => row.invoice.status === "sent");
  const owed = outstanding.reduce((sum, row) => sum + row.totals.grossPence, 0);
  const overdue = outstanding.filter((row) => row.daysRemaining < 0).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Invoices"
        description={
          outstanding.length === 0
            ? "Nothing outstanding."
            : `${formatPence(owed)} outstanding across ${outstanding.length} ${
                outstanding.length === 1 ? "invoice" : "invoices"
              }${overdue > 0 ? `, ${overdue} overdue` : ""}`
        }
        action={
          <Link
            href="/invoices/new"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover"
          >
            Raise invoice
          </Link>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-20 text-center">
          <p className="font-medium">No invoices yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Raise one to bill a week&rsquo;s jobs for a client. A job can be
            billed once it has been weighed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-line bg-elevated text-left">
                <th className={headerCell}>Number</th>
                <th className={headerCell}>Client</th>
                <th className={`${headerCell} text-right`}>Jobs</th>
                <th className={`${headerCell} text-right`}>Total</th>
                <th className={headerCell}>Date</th>
                <th className={headerCell}>Due</th>
                <th className={`${headerCell} text-right`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const late = row.standing === "overdue";
                return (
                  <tr
                    key={row.invoice.id}
                    className={`border-b border-line last:border-0 ${late ? "bg-danger-soft" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${row.invoice.id}`}
                        className="font-medium tabular-nums hover:text-accent"
                      >
                        {formatInvoiceNumber(
                          settings.invoiceNumberPrefix,
                          row.invoice.number,
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.clientName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.jobCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatPence(row.totals.grossPence)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateGB(row.invoice.issueDate)}
                    </td>
                    <td
                      className={`px-4 py-3 whitespace-nowrap ${late ? "font-medium text-danger" : "text-muted"}`}
                    >
                      {formatDateGB(row.dueDate)}
                      {late ? (
                        <span className="block text-xs">
                          {Math.abs(row.daysRemaining)} days overdue
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STANDING_CLASSES[row.standing]}`}
                      >
                        {STANDING_LABELS[row.standing]}
                        {late ? ` · ${Math.abs(row.daysRemaining)}d` : ""}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
