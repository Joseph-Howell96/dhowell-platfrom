import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { addCalendarDays, daysBetween, formatDateGB } from "@/lib/dates";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { priceJob, type JobPrice } from "@/lib/pricing";
import type { Job } from "@/lib/types";
import { readSettings } from "@/lib/settings";
import { invoiceDueDate } from "@/lib/terms";

export const metadata: Metadata = {
  title: "Finance",
};

type Row = {
  job: Job;
  clientName: string;
  price: JobPrice | null;
  /** When the clock started: the invoice going out, or the PO being raised. */
  startDate: string;
  dueDate: string;
  daysRemaining: number;
  settled: boolean;
};

const headerCell =
  "px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted";

/** The money figure, or a dash when no rate on the client record matches. */
function Amount({ price }: { price: JobPrice | null }) {
  if (!price) {
    return (
      <span
        className="text-muted"
        title="No rate line on the client record matches this material"
      >
        —
      </span>
    );
  }
  return (
    <span className="font-medium tabular-nums" title={price.workedOut}>
      {formatPence(price.pence)}
    </span>
  );
}

function Table({
  rows,
  startLabel,
  emptyTitle,
  emptyBody,
  showPO,
}: {
  rows: Row[];
  startLabel: string;
  emptyTitle: string;
  emptyBody: string;
  showPO?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
        <p className="font-medium">{emptyTitle}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b border-line bg-elevated text-left">
            <th className={headerCell}>Client</th>
            <th className={headerCell}>Job date</th>
            <th className={`${headerCell} text-right`}>Amount</th>
            {showPO ? <th className={headerCell}>PO number</th> : null}
            <th className={headerCell}>{startLabel}</th>
            <th className={headerCell}>Due</th>
            <th className={`${headerCell} text-right`}>Days remaining</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const overdue = !row.settled && row.daysRemaining < 0;
            return (
              <tr
                key={row.job.id}
                className={`border-b border-line last:border-0 ${
                  overdue ? "bg-danger-soft" : ""
                } ${row.settled ? "text-muted" : ""}`}
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
                  <Amount price={row.price} />
                </td>
                {showPO ? (
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.job.supplierPO ?? "—"}
                    {row.job.supplierInvoiceRef ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        their ref {row.job.supplierInvoiceRef}
                      </span>
                    ) : null}
                  </td>
                ) : null}
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatDateGB(row.startDate)}
                </td>
                <td
                  className={`px-4 py-3 whitespace-nowrap ${
                    overdue ? "text-danger" : ""
                  }`}
                >
                  {formatDateGB(row.dueDate)}
                </td>
                <td
                  className={`px-4 py-3 text-right whitespace-nowrap tabular-nums ${
                    overdue ? "font-semibold text-danger" : ""
                  }`}
                >
                  {row.settled
                    ? `Paid ${formatDateGB(row.job.paidDate ?? "")}`
                    : overdue
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
  );
}

function total(rows: Row[]): number {
  return rows.reduce((sum, row) => sum + (row.price?.pence ?? 0), 0);
}

export default async function FinancePage() {
  // Read the files on every visit, and work out "today" then too, so the days
  // remaining are right rather than frozen at whenever the site was built.
  await connection();

  const today = todayISO();
  const [jobs, customers, settings] = await Promise.all([
    readJobs(),
    readCustomers(),
    readSettings(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));

  const soonestFirst = (a: Row, b: Row) => a.dueDate.localeCompare(b.dueDate);

  // Money in: invoices we have sent, due a fixed number of days later.
  const owedToUs: Row[] = jobs
    .filter(
      (job) =>
        job.direction === "sale" &&
        job.status === "invoice-sent" &&
        job.invoiceSentDate,
    )
    .map((job) => {
      const sent = job.invoiceSentDate as string;
      const dueDate = invoiceDueDate(sent, settings.paymentTermsDays);
      return {
        job,
        clientName: clientsById.get(job.customerId)?.businessName ?? "Unknown client",
        price: priceJob(job, clientsById.get(job.customerId)),
        startDate: sent,
        dueDate,
        daysRemaining: daysBetween(today, dueDate),
        settled: false,
      };
    })
    .sort(soonestFirst);

  // Money out: material bought off a client. Due on their agreed terms, taken
  // from their client record, counted in ordinary days rather than working
  // ones, because that is what "30 days" on a supplier account means.
  const weOwe: Row[] = jobs
    .filter(
      (job) =>
        job.direction === "purchase" &&
        (job.status === "po-raised" || job.status === "paid") &&
        job.poRaisedDate,
    )
    .map((job) => {
      const client = clientsById.get(job.customerId);
      const raised = job.poRaisedDate as string;
      const dueDate = addCalendarDays(raised, client?.paymentTermsDays ?? 0);
      return {
        job,
        clientName: client?.businessName ?? "Unknown client",
        price: priceJob(job, client),
        startDate: raised,
        dueDate,
        daysRemaining: daysBetween(today, dueDate),
        settled: job.status === "paid",
      };
    })
    .sort(soonestFirst);

  const outstandingOut = weOwe.filter((row) => !row.settled);
  const overdueIn = owedToUs.filter((row) => row.daysRemaining < 0).length;
  const overdueOut = outstandingOut.filter((row) => row.daysRemaining < 0).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Finance"
        description="What clients owe us, and what we owe clients for material bought off them."
      />

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Money in</h2>
          <p className="text-sm text-muted">
            {owedToUs.length === 0
              ? "Nothing outstanding"
              : `${formatPence(total(owedToUs))} across ${owedToUs.length} ${
                  owedToUs.length === 1 ? "invoice" : "invoices"
                }${overdueIn > 0 ? `, ${overdueIn} overdue` : ""}`}
          </p>
        </div>
        <Table
          rows={owedToUs}
          startLabel="Sent"
          emptyTitle="Nothing sent yet"
          emptyBody="Move a sale to “Invoice sent” on the calendar and it will show up here."
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Money out</h2>
          <p className="text-sm text-muted">
            {outstandingOut.length === 0
              ? "Nothing outstanding"
              : `${formatPence(total(outstandingOut))} across ${
                  outstandingOut.length
                } ${outstandingOut.length === 1 ? "order" : "orders"}${
                  overdueOut > 0 ? `, ${overdueOut} overdue` : ""
                }`}
          </p>
        </div>
        <Table
          rows={weOwe}
          startLabel="PO raised"
          showPO
          emptyTitle="No purchase orders yet"
          emptyBody="Move a purchase to “PO raised” on the calendar and it will show up here."
        />
      </section>

      <p className="mt-8 text-xs text-muted">
        Amounts are worked out from each client&rsquo;s rate for the material,
        not stored, so correcting a rate corrects every job priced off it. Our
        invoices fall due {settings.paymentTermsDays} days after the invoice
        date, as set under Settings; what we owe runs on the payment terms
        recorded against the client.{" "}
        <Link href="/clients" className="text-accent hover:underline">
          Clients
        </Link>
      </p>
    </main>
  );
}
