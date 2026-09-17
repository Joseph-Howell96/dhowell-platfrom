import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import BillingsChart from "@/components/billings-chart";
import PageHeader from "@/components/page-header";
import {
  byMaterial,
  byMonth,
  isWeighed,
  marginPercent,
  totalsFor,
  yearsWithJobs,
  type Totals,
} from "@/lib/analytics";
import { todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { daysBetween, formatDateGB } from "@/lib/dates";
import { readDeletedInvoices, readInvoices } from "@/lib/invoices";
import { formatInvoiceNumber, invoiceGrossPence } from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { readOutlets } from "@/lib/outlets";
import { readSettings } from "@/lib/settings";
import { invoiceDueDate } from "@/lib/terms";
import {
  invoiceStanding,
  STANDING_CLASSES,
  STANDING_LABELS,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Finance",
};

function Card({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

/** "62%" or a dash where nothing has both halves of the sum recorded. */
function formatMargin(totals: Totals): string {
  const margin = marginPercent(totals);
  return margin === null ? "—" : `${margin.toFixed(1)}%`;
}

/** How many jobs are missing the figure that would give them a profit. */
function missingNote(totals: Totals): string | undefined {
  const missing = totals.jobs - totals.jobsWithProfit;
  if (totals.jobs === 0 || missing === 0) return undefined;
  return `${missing} of ${totals.jobs} ${
    totals.jobs === 1 ? "job has" : "jobs have"
  } no cost recorded`;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  // Read the files on every visit, and work out "today" then too, so where an
  // invoice stands is right rather than frozen at whenever the site was built.
  await connection();

  const today = todayISO();
  const [jobs, customers, outlets, settings, invoices, deleted] =
    await Promise.all([
      readJobs(),
      readCustomers(),
      readOutlets(),
      readSettings(),
      readInvoices(),
      readDeletedInvoices(),
    ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const outletsById = new Map(outlets.map((o) => [o.id, o]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  /* --- The year's trading ------------------------------------------------ */

  const years = yearsWithJobs(jobs, today.slice(0, 4));
  const requested = (await searchParams).year;
  const year = requested && years.includes(requested) ? requested : years[0];

  const inYear = jobs.filter((job) => job.date.startsWith(year));
  const weighed = inYear.filter(isWeighed);
  const scheduled = inYear.filter((job) => !isWeighed(job));

  const done = totalsFor(weighed, clientsById, outletsById);
  const ahead = totalsFor(scheduled, clientsById, outletsById);
  const months = byMonth(weighed, clientsById, outletsById);
  const materials = byMaterial(weighed, clientsById, outletsById);

  // The widest margin sets the length of the bars, so they compare against each
  // other rather than against an arbitrary 100%.
  const widestMargin = Math.max(
    1,
    ...materials.map((row) => Math.abs(marginPercent(row.totals) ?? 0)),
  );

  /* --- The invoices ------------------------------------------------------ */

  /**
   * Every invoice gathered under the client it is for, so a client's paperwork
   * is in one place rather than scattered down a list by date. Drafts
   * included: an invoice raised from the calendar belongs here straight away,
   * not only once someone has opened its PDF.
   */
  const filed = new Map<
    string,
    {
      reference: string;
      invoice: (typeof invoices)[number];
      grossPence: number;
      dueDate: string;
      standing: ReturnType<typeof invoiceStanding>;
      daysLate: number;
    }[]
  >();
  for (const invoice of invoices) {
    const client = clientsById.get(invoice.customerId);
    const name = client?.businessName ?? "Unknown client";
    const rows = filed.get(name) ?? [];
    const dueDate = invoiceDueDate(invoice.issueDate, settings.paymentTermsDays);
    rows.push({
      reference: formatInvoiceNumber(settings.invoiceNumberPrefix, invoice.number),
      invoice,
      grossPence: invoiceGrossPence(
        invoice,
        jobsById,
        client,
        settings.vatPercent,
      ),
      dueDate,
      standing: invoiceStanding(invoice.status, dueDate, today),
      daysLate: Math.abs(daysBetween(today, dueDate)),
    });
    filed.set(name, rows);
  }
  // Newest invoice first within a client, clients in alphabetical order.
  for (const rows of filed.values()) {
    rows.sort((a, b) => b.invoice.issueDate.localeCompare(a.invoice.issueDate));
  }
  const filedByClient = [...filed.entries()].sort(([a], [b]) => a.localeCompare(b));
  const filedCount = filedByClient.reduce((n, [, rows]) => n + rows.length, 0);

  // Outstanding money, for the line above the list: what is unpaid, and how
  // much of it is late.
  const unpaid = [...filed.values()]
    .flat()
    .filter((row) => row.standing !== "paid");
  const unpaidTotal = unpaid.reduce((sum, row) => sum + row.grossPence, 0);
  const overdueCount = unpaid.filter((row) => row.standing === "overdue").length;

  /**
   * Invoices that were withdrawn. Kept out of everything above - they are not
   * owed, not overdue and not part of the year's takings - but kept, because a
   * number that went out and was taken back is something to be able to explain.
   */
  const deletedRows = deleted.map((invoice) => {
    const client = clientsById.get(invoice.customerId);
    return {
      invoice,
      reference: formatInvoiceNumber(settings.invoiceNumberPrefix, invoice.number),
      clientName: client?.businessName ?? "Unknown client",
      grossPence: invoiceGrossPence(
        invoice,
        jobsById,
        client,
        settings.vatPercent,
      ),
      deletedOn: (invoice.deletedAt as string).slice(0, 10),
    };
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Finance"
        description="What the year has earned, and every invoice raised."
        action={
          <div className="flex items-center gap-1 rounded-lg border border-line p-1">
            {years.map((option) => (
              <Link
                key={option}
                href={`/finance?year=${option}`}
                aria-current={option === year ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  option === year
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:text-ink"
                }`}
              >
                {option}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          label="Jobs weighed"
          value={String(done.jobs)}
          note={`in ${year}`}
        />
        <Card label="Revenue" value={formatPence(done.revenuePence)} />
        <Card
          label="Profit"
          value={formatPence(done.profitPence)}
          note={missingNote(done)}
        />
        <Card
          label="Average margin"
          value={formatMargin(done)}
          note={
            done.jobsWithProfit > 0
              ? `across ${done.jobsWithProfit} ${done.jobsWithProfit === 1 ? "job" : "jobs"}`
              : undefined
          }
        />
        <Card
          label="Revenue scheduled"
          value={formatPence(ahead.revenuePence)}
          note={`${ahead.jobs} ${ahead.jobs === 1 ? "job" : "jobs"} still booked`}
        />
        <Card
          label="Profit scheduled"
          value={formatPence(ahead.profitPence)}
          note={missingNote(ahead)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-line bg-surface p-6 lg:col-span-3">
          <h2 className="mb-1 text-base font-semibold">Monthly billings</h2>
          <p className="mb-4 text-sm text-muted">
            Weighed jobs in {year}, by the month the job was done.
          </p>
          <BillingsChart months={months} />
        </section>

        <section className="rounded-xl border border-line bg-surface p-6 lg:col-span-2">
          <h2 className="mb-1 text-base font-semibold">By material</h2>
          <p className="mb-4 text-sm text-muted">
            Where the money came from in {year}.
          </p>

          {materials.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              No weighed jobs yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 font-medium">Material</th>
                    <th className="pb-2 text-right font-medium">Jobs</th>
                    <th className="pb-2 text-right font-medium">Revenue</th>
                    <th className="pb-2 text-right font-medium">Profit</th>
                    <th className="pb-2 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((row) => {
                    const margin = marginPercent(row.totals);
                    return (
                      <tr
                        key={row.material}
                        className="border-b border-line last:border-0"
                      >
                        <td className="py-2.5 pr-2">{row.material}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted">
                          {row.totals.jobs}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatPence(row.totals.revenuePence)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {row.totals.jobsWithProfit === 0
                            ? "—"
                            : formatPence(row.totals.profitPence)}
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          {margin === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <>
                              <span className="tabular-nums">
                                {margin.toFixed(0)}%
                              </span>
                              {/* A short bar next to the number, so the
                                  materials compare at a glance. */}
                              <span
                                aria-hidden
                                className="mt-1 block h-1 rounded-sm bg-series-profit"
                                style={{
                                  width: `${Math.max(2, (Math.abs(margin) / widestMargin) * 100)}%`,
                                  marginLeft: "auto",
                                }}
                              />
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Invoices by client</h2>
          <p className="text-sm text-muted">
            {filedCount === 0
              ? "None raised yet"
              : unpaid.length === 0
                ? `${filedCount} raised, all paid`
                : `${formatPence(unpaidTotal)} outstanding across ${
                    unpaid.length
                  } ${unpaid.length === 1 ? "invoice" : "invoices"}${
                    overdueCount > 0 ? `, ${overdueCount} overdue` : ""
                  }`}
          </p>
        </div>

        {filedByClient.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
            <p className="font-medium">No invoices yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Raise one from the calendar and it appears here under the client
              it is for. The number opens its PDF, which files a copy.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filedByClient.map(([name, rows]) => (
              <div
                key={name}
                className="overflow-hidden rounded-xl border border-line bg-surface"
              >
                <h3 className="border-b border-line bg-elevated px-4 py-2.5 text-sm font-semibold">
                  {name}
                  <span className="ml-2 font-normal text-muted">
                    {rows.length} {rows.length === 1 ? "invoice" : "invoices"}
                  </span>
                </h3>
                <ul className="divide-y divide-line">
                  {rows.map((row) => (
                    <li
                      key={row.invoice.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                    >
                      <a
                        href={`/invoices/${row.invoice.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-28 shrink-0 font-medium tabular-nums text-accent hover:underline"
                      >
                        {row.reference}
                      </a>
                      <span className="w-24 shrink-0 text-muted">
                        {formatDateGB(row.invoice.issueDate)}
                      </span>
                      <span className="w-24 shrink-0 tabular-nums">
                        {formatPence(row.grossPence)}
                      </span>
                      <span className="w-28 shrink-0 text-xs text-muted">
                        {row.standing === "paid"
                          ? "Settled"
                          : `due ${formatDateGB(row.dueDate)}`}
                      </span>
                      <span className="flex-1">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STANDING_CLASSES[row.standing]}`}
                        >
                          {STANDING_LABELS[row.standing]}
                          {row.standing === "overdue"
                            ? ` · ${row.daysLate} days overdue`
                            : ""}
                        </span>
                      </span>
                      {row.invoice.pdfSavedAt ? (
                        <span
                          className="shrink-0 text-xs text-muted"
                          title="A copy of this PDF is on file"
                        >
                          filed
                        </span>
                      ) : null}
                      <Link
                        href={`/invoices/${row.invoice.id}`}
                        className="shrink-0 text-muted transition-colors hover:text-ink"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {deletedRows.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Deleted invoices</h2>
            <p className="text-sm text-muted">
              {deletedRows.length}{" "}
              {deletedRows.length === 1 ? "invoice" : "invoices"} withdrawn, not
              counted anywhere above
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-dashed border-line bg-surface">
            <ul className="divide-y divide-line">
              {deletedRows.map((row) => (
                <li
                  key={row.invoice.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm text-muted"
                >
                  <span className="w-28 shrink-0 font-medium tabular-nums line-through">
                    {row.reference}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.clientName}</span>
                  <span className="w-24 shrink-0 tabular-nums">
                    {formatPence(row.grossPence)}
                  </span>
                  <span className="w-40 shrink-0 text-xs">
                    deleted {formatDateGB(row.deletedOn)}
                  </span>
                  <Link
                    href={`/invoices/${row.invoice.id}`}
                    className="shrink-0 transition-colors hover:text-ink"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-2 text-xs text-muted">
            A deleted invoice keeps its number, which is never given to another
            one. The jobs it covered have gone back to waiting to be invoiced.
            Open one to put it back.
          </p>
        </section>
      ) : null}

      <p className="mt-8 text-xs text-muted">
        Nothing on this page is stored. Amounts are worked out from each
        client&rsquo;s rate for the material, so correcting a rate corrects
        every figure priced off it. Profit is what comes in less what goes out:
        on a charge job, what the client is invoiced less the disposal cost; on
        a rebate job, the material income from the outlet less the rebate paid
        to the client less haulage. Jobs missing one of those figures count
        towards revenue but are left out of profit and margin, rather than being
        treated as costing nothing. Invoices fall due{" "}
        {settings.paymentTermsDays} days after the invoice date, as set under{" "}
        <Link href="/settings" className="text-accent hover:underline">
          Settings
        </Link>
        .
      </p>
    </main>
  );
}
