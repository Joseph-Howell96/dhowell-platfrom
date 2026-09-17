import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { monthKeyOf, todayISO, weekStartOf } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { addCalendarDays, daysBetween, formatDateGB } from "@/lib/dates";
import { invoicedJobIds, readInvoices } from "@/lib/invoices";
import { invoiceGrossPence, isBillable } from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";
import { invoiceDueDate } from "@/lib/terms";
import { invoiceStanding, isWeighedOrLater } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * One figure worth acting on, and where to go and act on it.
 *
 * The whole tile is the link rather than a separate "view" button: the number
 * is what you are reading, so the number is what you should be able to click.
 */
function Tile({
  label,
  value,
  note,
  href,
  linkLabel,
  tone = "plain",
}: {
  label: string;
  value: string;
  note: string;
  href: string;
  linkLabel: string;
  /** "alert" marks the one that means someone owes us money and is late. */
  tone?: "plain" | "alert";
}) {
  const alert = tone === "alert" && value !== "0";
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-xl border bg-surface p-5 transition-colors ${
        alert
          ? "border-danger/40 hover:border-danger"
          : "border-line hover:border-accent"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          alert ? "text-danger" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{note}</p>
      <p
        className={`mt-4 text-sm font-medium transition-colors ${
          alert
            ? "text-danger"
            : "text-muted group-hover:text-accent"
        }`}
      >
        {linkLabel} →
      </p>
    </Link>
  );
}

/** "3 jobs" / "1 job", so the notes underneath read like English. */
function countOf(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function DashboardPage() {
  // Read the files on every visit, and work out "today" then too, so what the
  // page says about today is right rather than frozen at build time.
  await connection();

  const today = todayISO();
  const weekStart = weekStartOf(today);
  const weekEnd = addCalendarDays(weekStart, 6);

  const [jobs, customers, invoices, settings] = await Promise.all([
    readJobs(),
    readCustomers(),
    readInvoices(),
    readSettings(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  // --- In the diary -------------------------------------------------------
  const todaysJobs = jobs.filter((job) => job.date === today);
  const weeksJobs = jobs.filter(
    (job) => job.date >= weekStart && job.date <= weekEnd,
  );
  const stillToDoToday = todaysJobs.filter(
    (job) => !isWeighedOrLater(job.status),
  ).length;

  // --- Waiting to be billed ----------------------------------------------
  // Weighed, priced, and not on an invoice. Worked out from what the invoices
  // actually hold rather than from anything written on the job, so a job can
  // never sit here after it has been billed.
  const alreadyBilled = invoicedJobIds(invoices);
  const awaitingInvoice = jobs.filter(
    (job) =>
      isWeighedOrLater(job.status) &&
      !alreadyBilled.has(job.id) &&
      isBillable(job, clientsById.get(job.customerId)),
  );
  const oldestWaiting = awaitingInvoice.reduce<string | null>(
    (oldest, job) => (oldest === null || job.date < oldest ? job.date : oldest),
    null,
  );

  // --- Money that is late -------------------------------------------------
  const overdue = invoices
    .filter((invoice) => {
      const dueDate = invoiceDueDate(invoice.issueDate, settings.paymentTermsDays);
      return invoiceStanding(invoice.status, dueDate, today) === "overdue";
    })
    .map((invoice) => ({
      invoice,
      dueDate: invoiceDueDate(invoice.issueDate, settings.paymentTermsDays),
      grossPence: invoiceGrossPence(
        invoice,
        jobsById,
        clientsById.get(invoice.customerId),
        settings.vatPercent,
      ),
    }));
  const overdueTotal = overdue.reduce((sum, row) => sum + row.grossPence, 0);
  // The one that has been outstanding longest, which is the one to chase.
  const worstOverdueDays = overdue.reduce(
    (worst, row) => Math.max(worst, Math.abs(daysBetween(today, row.dueDate))),
    0,
  );

  const thisMonth = monthKeyOf(today);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Dashboard"
        description={`What needs doing today. ${formatDateGB(today)}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Booked today"
          value={String(todaysJobs.length)}
          note={
            todaysJobs.length === 0
              ? "Nothing in the diary"
              : stillToDoToday === 0
                ? "All weighed in"
                : `${countOf(stillToDoToday, "job", "jobs")} still to weigh`
          }
          href={`/calendar?month=${thisMonth}`}
          linkLabel="Open the calendar"
        />

        <Tile
          label="Booked this week"
          value={String(weeksJobs.length)}
          note={`${formatDateGB(weekStart)} to ${formatDateGB(weekEnd)}`}
          href={`/calendar?month=${thisMonth}`}
          linkLabel="Open the calendar"
        />

        <Tile
          label="Waiting to invoice"
          value={String(awaitingInvoice.length)}
          note={
            awaitingInvoice.length === 0
              ? "Everything weighed is billed"
              : `Oldest ${formatDateGB(oldestWaiting as string)}`
          }
          href={`/calendar?month=${
            oldestWaiting ? monthKeyOf(oldestWaiting) : thisMonth
          }`}
          linkLabel="Generate invoices"
        />

        <Tile
          label="Overdue invoices"
          value={String(overdue.length)}
          note={
            overdue.length === 0
              ? "Nothing past its due date"
              : `${formatPence(overdueTotal)} · longest ${countOf(worstOverdueDays, "day", "days")}`
          }
          href="/finance"
          linkLabel="Open Finance"
          tone="alert"
        />
      </div>

      <p className="mt-8 text-xs text-muted">
        Waiting to invoice counts jobs that have been weighed, have a rate on
        the client record, and are not already on an invoice. Raise them a week
        at a time from the button on the end of a calendar week. Revenue,
        profit and margin now live under{" "}
        <Link href="/finance" className="text-accent hover:underline">
          Finance
        </Link>
        .
      </p>
    </main>
  );
}
