import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { requireSession } from "@/lib/guard";

import PageHeader from "@/components/page-header";
import {
  byMaterial,
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
import { haulageChargeFor, priceJob } from "@/lib/pricing";
import { invoicedJobIds } from "@/lib/invoices";
import { isAwaitingInvoice, isBillable } from "@/lib/invoicing";
import { monthKeyOf, monthLabel } from "@/lib/calendar";
import { sumKnown } from "@/lib/analytics";
import ViewControls from "./view-controls";
import {
  BILLING_STATE_CLASSES,
  BILLING_STATE_LABELS,
  dateIsShown,
  stateIsShown,
  viewFromParams,
  type BillingState,
} from "@/lib/finance-view";
import { readSettings } from "@/lib/settings";
import { invoiceDueDate } from "@/lib/terms";
import { invoiceStanding } from "@/lib/types";

export const metadata: Metadata = {
  title: "Finance",
};

/**
 * One line in the billing list.
 *
 * Deliberately the same shape whether it came from an invoice or from a job
 * still waiting to be billed. The list is about money, and where a figure came
 * from is a detail the reader can see from its state rather than something the
 * layout has to fork on.
 */
type BillingRow = {
  key: string;
  kind: "invoice" | "job";
  href: string;
  /** The PDF, on an invoice. Null on a job, which has no document yet. */
  pdfHref: string | null;
  /** The invoice number, or the material on a job not yet billed. */
  reference: string;
  clientName: string;
  /** The invoice date, or the job date. What the range filter works on. */
  date: string;
  grossPence: number;
  state: BillingState;
  /** The short line under the amount: when it is due, how late, and so on. */
  note: string;
  /** Whether a copy of the PDF is on file. */
  filed: boolean;
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
    <div className="glass rounded-xl p-5">
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Read the files on every visit, and work out "today" then too, so where an
  // invoice stands is right rather than frozen at whenever the site was built.
  await connection();
  await requireSession("/finance");

  const today = todayISO();
  const [jobs, customers, settings, invoices, deleted] = await Promise.all([
    readJobs(),
    readCustomers(),
    readSettings(),
    readInvoices(),
    readDeletedInvoices(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  /* --- The year's trading ------------------------------------------------ */

  const query = await searchParams;
  const years = yearsWithJobs(jobs, today.slice(0, 4));
  const requestedYear = Array.isArray(query.year) ? query.year[0] : query.year;
  const year =
    requestedYear && years.includes(requestedYear) ? requestedYear : years[0];

  const inYear = jobs.filter((job) => job.date.startsWith(year));
  const weighed = inYear.filter(isWeighed);
  const scheduled = inYear.filter((job) => !isWeighed(job));

  const done = totalsFor(weighed, clientsById);
  const ahead = totalsFor(scheduled, clientsById);
  const materials = byMaterial(weighed, clientsById);

  // The widest margin sets the length of the bars, so they compare against each
  // other rather than against an arbitrary 100%.
  const widestMargin = Math.max(
    1,
    ...materials.map((row) => Math.abs(marginPercent(row.totals) ?? 0)),
  );

  /* --- The billing list -------------------------------------------------- */

  const chosen = viewFromParams(query);

  /**
   * One row per thing that has money attached to it.
   *
   * Mostly invoices. Also the jobs that have been checked off and not yet
   * billed, which are not invoices at all - that is the point of putting them
   * here. Work finished and never invoiced is the easiest money in the
   * business to lose, and it is invisible on a screen that only lists
   * invoices.
   */
  const rows: BillingRow[] = [];

  for (const invoice of invoices) {
    const client = clientsById.get(invoice.customerId);
    const dueDate = invoiceDueDate(invoice.issueDate, settings.paymentTermsDays);
    const standing = invoiceStanding(invoice.status, dueDate, today);
    rows.push({
      key: invoice.id,
      kind: "invoice",
      href: `/invoices/${invoice.id}`,
      pdfHref: `/invoices/${invoice.id}/pdf`,
      reference: formatInvoiceNumber(settings.invoiceNumberPrefix, invoice.number),
      clientName: client?.businessName ?? "Unknown client",
      date: invoice.issueDate,
      grossPence: invoiceGrossPence(invoice, jobsById, client, settings.vatPercent),
      // "Draft" and "due" are both an invoice raised and not yet settled, and
      // that is one thing to a person chasing money.
      state: standing === "paid" ? "paid" : standing === "overdue" ? "overdue" : "invoiced",
      note:
        standing === "paid"
          ? invoice.paidDate
            ? `paid ${formatDateGB(invoice.paidDate)}`
            : "settled"
          : standing === "overdue"
            ? `${Math.abs(daysBetween(today, dueDate))} days overdue`
            : `due ${formatDateGB(dueDate)}`,
      filed: invoice.pdfSavedAt !== null,
    });
  }

  const billed = invoicedJobIds(invoices);
  for (const job of jobs) {
    if (!isAwaitingInvoice(job, billed)) continue;
    const client = clientsById.get(job.customerId);
    const price = priceJob(job, client);
    const haulage = haulageChargeFor(job, client);
    rows.push({
      key: job.id,
      kind: "job",
      href: `/calendar/${job.id}`,
      pdfHref: null,
      reference: job.material,
      clientName: client?.businessName ?? "Unknown client",
      date: job.date,
      // Net, since nothing has been invoiced yet and so no VAT has been added.
      grossPence: sumKnown(price?.pence ?? null, haulage?.pence ?? null) ?? 0,
      state: "uninvoiced",
      note: isBillable(job, client) ? "ready to invoice" : "needs a rate",
      filed: false,
    });
  }

  const shown = rows
    .filter(
      (row) => stateIsShown(chosen, row.state) && dateIsShown(chosen, row.date),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  /** The rows gathered under whatever heading was asked for. */
  const grouped = new Map<string, BillingRow[]>();
  for (const row of shown) {
    const key =
      chosen.grouping === "client"
        ? row.clientName
        : chosen.grouping === "month"
          ? monthLabel(monthKeyOf(row.date))
          : "";
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const groups = [...grouped.entries()].sort(([a], [b]) =>
    // Clients read alphabetically; months read newest first, which is the
    // order the rows are already in, so the first row of each decides.
    chosen.grouping === "month"
      ? (grouped.get(b)?.[0].date ?? "").localeCompare(grouped.get(a)?.[0].date ?? "")
      : a.localeCompare(b),
  );

  const shownTotal = shown.reduce((sum, row) => sum + row.grossPence, 0);
  const owedRows = shown.filter((row) => row.state !== "paid");
  const owedTotal = owedRows.reduce((sum, row) => sum + row.grossPence, 0);

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
        description="What the year has earned, and every bit of billing - invoiced or not."
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

      <section className="glass rounded-xl p-6">
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

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Billing</h2>
          <p className="text-sm text-muted">
            {shown.length === 0
              ? "Nothing matches these filters"
              : `${shown.length} ${shown.length === 1 ? "item" : "items"}, ${formatPence(shownTotal)}${
                  owedRows.length > 0
                    ? ` · ${formatPence(owedTotal)} still owed`
                    : ", all settled"
                }`}
          </p>
        </div>

        <ViewControls view={chosen} />

        {shown.length === 0 ? (
          <div className="glass-dashed rounded-xl px-6 py-14 text-center">
            <p className="font-medium">Nothing to show</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              {rows.length === 0
                ? "Complete a job on the calendar and it appears here, waiting to be invoiced."
                : "No billing matches the filters above. Clear them to see everything."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([heading, groupRows]) => (
              <div key={heading || "all"}>
                {heading ? (
                  <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                    {heading}
                    <span className="font-normal text-muted">
                      {groupRows.length}{" "}
                      {groupRows.length === 1 ? "item" : "items"},{" "}
                      {formatPence(
                        groupRows.reduce((sum, row) => sum + row.grossPence, 0),
                      )}
                    </span>
                  </h3>
                ) : null}

                {chosen.view === "cards" ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {groupRows.map((row) => (
                      <Link
                        key={row.key}
                        href={row.href}
                        className="glass glass-hover flex flex-col rounded-xl p-4"
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-medium tabular-nums">
                            {row.reference}
                          </span>
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${BILLING_STATE_CLASSES[row.state]}`}
                          >
                            {BILLING_STATE_LABELS[row.state]}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-sm text-muted">
                          {row.clientName}
                        </span>
                        <span className="mt-3 block text-xl font-semibold tabular-nums">
                          {formatPence(row.grossPence)}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {formatDateGB(row.date)} · {row.note}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="glass overflow-hidden rounded-xl">
                    <ul className="divide-y divide-line">
                      {groupRows.map((row) => (
                        <li
                          key={row.key}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                        >
                          {row.pdfHref ? (
                            <a
                              href={row.pdfHref}
                              target="_blank"
                              rel="noreferrer"
                              className="w-28 shrink-0 truncate font-medium tabular-nums text-accent hover:underline"
                            >
                              {row.reference}
                            </a>
                          ) : (
                            <span className="w-28 shrink-0 truncate font-medium">
                              {row.reference}
                            </span>
                          )}
                          <span className="w-24 shrink-0 text-muted">
                            {formatDateGB(row.date)}
                          </span>
                          {chosen.grouping === "client" ? null : (
                            <span className="min-w-0 flex-1 truncate text-muted">
                              {row.clientName}
                            </span>
                          )}
                          <span className="w-24 shrink-0 tabular-nums">
                            {formatPence(row.grossPence)}
                          </span>
                          <span className="w-36 shrink-0 text-xs text-muted">
                            {row.note}
                          </span>
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${BILLING_STATE_CLASSES[row.state]}`}
                          >
                            {BILLING_STATE_LABELS[row.state]}
                          </span>
                          {row.filed ? (
                            <span
                              className="shrink-0 text-xs text-muted"
                              title="A copy of this PDF is on file"
                            >
                              filed
                            </span>
                          ) : null}
                          <Link
                            href={row.href}
                            className="ml-auto shrink-0 text-muted transition-colors hover:text-ink"
                          >
                            Open
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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

          <div className="overflow-hidden glass-dashed rounded-xl">
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
        a rebate job, what the load sold on for less the rebate paid
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
