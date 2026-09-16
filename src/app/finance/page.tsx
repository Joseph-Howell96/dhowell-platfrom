import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { formatDateGB } from "@/lib/dates";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { priceJob } from "@/lib/pricing";
import { daysBetween, invoiceDueDate } from "@/lib/working-days";

export const metadata: Metadata = {
  title: "Finance",
};

export default async function FinancePage() {
  // Read the files on every visit, and work out "today" then too, so the days
  // remaining are right rather than frozen at whenever the site was built.
  await connection();

  const today = todayISO();
  const [jobs, customers] = await Promise.all([readJobs(), readCustomers()]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));

  const invoices = jobs
    .filter((job) => job.status === "invoice-sent" && job.invoiceSentDate)
    .map((job) => {
      const client = clientsById.get(job.customerId);
      const sentDate = job.invoiceSentDate as string;
      const dueDate = invoiceDueDate(sentDate);
      return {
        job,
        clientName: client?.businessName ?? "Unknown client",
        price: priceJob(job, client),
        sentDate,
        dueDate,
        // Negative once the due date has passed.
        daysRemaining: daysBetween(today, dueDate),
      };
    })
    // Soonest due at the top, so anything overdue is the first thing you see.
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const overdueCount = invoices.filter((row) => row.daysRemaining < 0).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Finance"
        description={
          invoices.length === 0
            ? "Invoices appear here once a job is marked as sent."
            : `${invoices.length} sent ${invoices.length === 1 ? "invoice" : "invoices"}${
                overdueCount > 0 ? `, ${overdueCount} overdue` : ""
              }`
        }
      />

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-20 text-center">
          <p className="font-medium">Nothing sent yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Move a job to &ldquo;Invoice sent&rdquo; on the{" "}
            <Link href="/calendar" className="text-accent hover:underline">
              calendar
            </Link>{" "}
            and it will show up here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-line bg-elevated text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Job date</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 text-right font-medium">
                  Days remaining
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((row) => {
                const overdue = row.daysRemaining < 0;
                return (
                  <tr
                    key={row.job.id}
                    className={`border-b border-line last:border-0 ${
                      overdue ? "bg-danger-soft" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/calendar/${row.job.id}`}
                        className="font-medium hover:text-accent"
                      >
                        {row.clientName}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted">
                        {row.job.material}
                        {row.job.skipSize ? `, ${row.job.skipSize}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateGB(row.job.date)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {row.price ? (
                        <>
                          <span className="font-medium tabular-nums">
                            {formatPence(row.price.pence)}
                          </span>
                          {row.price.direction === "pay" ? (
                            <span className="mt-0.5 block text-xs text-accent">
                              we pay
                            </span>
                          ) : null}
                        </>
                      ) : (
                        // Shown when the client has no rate for this material,
                        // or a per-tonne rate has no weight to work from.
                        <span className="text-muted" title="No matching rate line on the client record">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateGB(row.sentDate)}
                    </td>
                    <td
                      className={`px-4 py-3 whitespace-nowrap ${overdue ? "text-danger" : ""}`}
                    >
                      {formatDateGB(row.dueDate)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right whitespace-nowrap tabular-nums ${
                        overdue ? "font-semibold text-danger" : ""
                      }`}
                    >
                      {overdue
                        ? `${Math.abs(row.daysRemaining)} days overdue`
                        : row.daysRemaining === 0
                          ? "Due today"
                          : `${row.daysRemaining} days`}
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
