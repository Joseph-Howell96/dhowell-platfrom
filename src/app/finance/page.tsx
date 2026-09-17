import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import MarkPaidButton from "./mark-paid-button";
import MoneyChart, { type MonthMoney } from "./money-chart";
import InvoiceSearch from "@/components/invoice-search";
import PageHeader from "@/components/page-header";
import { requireSession } from "@/lib/guard";
import { isWeighed, totalsFor } from "@/lib/analytics";
import { monthKeyOf, monthLabel, todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { daysBetween, formatDateGB } from "@/lib/dates";
import { readDeletedInvoices, readInvoices } from "@/lib/invoices";
import { formatInvoiceNumber, invoiceGrossPence } from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";
import { invoiceDueDate } from "@/lib/terms";

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
  /** When it falls due, which is what the list is ordered on. */
  dueDate: string;
  grossPence: number;
  paid: boolean;
  /** Not paid, and past its due date. */
  overdue: boolean;
  /** The plain-English line under the number: what is owed, or when it came. */
  note: string;
};

/**
 * Does this invoice answer what was typed into the search box?
 *
 * The client's name or the invoice number, either of them part-typed. The
 * number matches on its digits alone, so "1006", "INV-1006" and "inv 1006"
 * all find the same invoice - nobody should have to remember the prefix.
 */
function matches(row: Row, term: string): boolean {
  if (term === "") return true;
  const needle = term.toLowerCase();
  const digits = needle.replace(/\D/g, "");
  return (
    row.clientName.toLowerCase().includes(needle) ||
    row.reference.toLowerCase().includes(needle) ||
    (digits !== "" && String(row.number).includes(digits))
  );
}

/** Overdue, then not paid, then paid - and within each, soonest due first. */
const ORDER = { overdue: 0, unpaid: 1, paid: 2 } as const;

function rank(row: Row): number {
  return ORDER[row.paid ? "paid" : row.overdue ? "overdue" : "unpaid"];
}

/** How many months of the chart to show, newest last. */
const MONTHS_SHOWN = 12;

/**
 * Every month from the first one with work in it up to this one, so a quiet
 * month reads as a quiet month rather than being skipped over and making the
 * one beside it look like its neighbour.
 */
function monthsUpTo(earliest: string, latest: string): string[] {
  const keys: string[] = [];
  let year = Number(earliest.slice(0, 4));
  let month = Number(earliest.slice(5, 7));
  for (let guard = 0; guard < 600; guard += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    keys.push(key);
    if (key >= latest) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys.slice(-MONTHS_SHOWN);
}

/** One big figure, said in words a reader does not have to translate. */
function Figure({
  label,
  value,
  note,
  above,
}: {
  label: string;
  value: string;
  note: string;
  /** A small line sitting over the figure. */
  above?: string;
}) {
  return (
    <div className="glass rounded-xl p-6">
      {above ? <p className="mb-2 text-xs text-muted">{above}</p> : null}
      <p className="text-base text-muted">{label}</p>
      <p className="mt-1 text-4xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-sm text-muted">{note}</p>
    </div>
  );
}

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

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const asked = (await searchParams).find;
  const term = (Array.isArray(asked) ? asked[0] : asked)?.trim() ?? "";

  const named = (customerId: string) =>
    clientsById.get(customerId)?.businessName ?? "Unknown client";

  /* --- What came in, and what was left of it ---------------------------- */

  // Only jobs that have been weighed. A job still in the diary has no figure
  // against it, and counting it would be counting money nobody has earned.
  const today = todayISO();
  const done = jobs.filter(isWeighed);
  const thisMonth = monthKeyOf(today);
  const earliest = done.reduce(
    (oldest, job) => (job.date < oldest ? job.date : oldest),
    done[0]?.date ?? today,
  );
  const monthKeys = done.length === 0 ? [] : monthsUpTo(monthKeyOf(earliest), thisMonth);

  const shown = done.filter((job) => monthKeys.includes(monthKeyOf(job.date)));
  const overall = totalsFor(shown, clientsById);
  const uncosted = overall.jobs - overall.jobsWithProfit;

  const months: MonthMoney[] = monthKeys.map((key) => {
    const totals = totalsFor(
      shown.filter((job) => monthKeyOf(job.date) === key),
      clientsById,
    );
    const long = monthLabel(key);
    return {
      key,
      short: long.slice(0, 3),
      long,
      revenuePence: totals.revenuePence,
      // No job that month had both halves recorded, so there is no profit to
      // draw. A zero would be a claim nobody has made.
      profitPence: totals.jobsWithProfit === 0 ? null : totals.profitPence,
    };
  });

  const period =
    monthKeys.length === 0
      ? ""
      : monthKeys.length === 1
        ? monthLabel(monthKeys[0])
        : `${monthLabel(monthKeys[0])} to ${monthLabel(monthKeys[monthKeys.length - 1])}`;

  const rows: Row[] = invoices
    .map((invoice) => {
      const dueDate = invoiceDueDate(
        invoice.issueDate,
        settings.paymentTermsDays,
      );
      const paid = invoice.status === "paid";
      const overdue = !paid && today > dueDate;
      return {
        id: invoice.id,
        number: invoice.number,
        reference: formatInvoiceNumber(
          settings.invoiceNumberPrefix,
          invoice.number,
        ),
        clientName: named(invoice.customerId),
        date: invoice.issueDate,
        dueDate,
        grossPence: invoiceGrossPence(
          invoice,
          jobsById,
          clientsById.get(invoice.customerId),
          settings.vatPercent,
        ),
        paid,
        overdue,
        note: paid
          ? invoice.paidDate
            ? `paid ${formatDateGB(invoice.paidDate)}`
            : "settled"
          : overdue
            ? `due ${formatDateGB(dueDate)} · ${Math.abs(daysBetween(today, dueDate))} days late`
            : `due ${formatDateGB(dueDate)}`,
      };
    })
    // The money to chase comes first: what is late, then what is closest to
    // falling due, then what is already in. Inside each of those the soonest
    // due date leads, so the invoice that has been waiting longest sits at the
    // very top of the page.
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.dueDate.localeCompare(b.dueDate) ||
        a.number - b.number,
    );

  const found = rows.filter((row) => matches(row, term));
  const unpaid = found.filter((row) => !row.paid);
  const owed = unpaid.reduce((sum, row) => sum + row.grossPence, 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Finance"
        description="What the work has brought in, and every invoice."
      />

      {/* Joseph put this here for his dad. */}
      <p className="neon mb-8 text-2xl font-bold tracking-wide text-accent">
        DAD YOU&rsquo;RE FUCKING RICH!
      </p>

      {months.length > 0 ? (
        <section className="mb-12">
          <div className="grid gap-4 sm:grid-cols-2">
            <Figure
              label="Revenue"
              value={formatPence(overall.revenuePence)}
              note={`Across ${overall.jobs} ${overall.jobs === 1 ? "job" : "jobs"}, ${period}`}
            />
            <Figure
              above="always listen to Jojo"
              label="Profit"
              value={
                overall.jobsWithProfit === 0
                  ? "Not known yet"
                  : formatPence(overall.profitPence)
              }
              note={
                overall.jobsWithProfit === 0
                  ? "No job has a tip charge recorded against it"
                  : uncosted === 0
                    ? "Revenue, less what the tip charged"
                    : `Leaves out ${uncosted} ${uncosted === 1 ? "job" : "jobs"} with no tip charge recorded`
              }
            />
          </div>

          <div className="glass mt-4 rounded-xl p-6">
            <h2 className="text-lg font-semibold">Month by month</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-base text-muted">
              {/* The colour sits in the square, never in the words, so the
                  writing stays as readable as everything else on the page. */}
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3.5 w-3.5 rounded-sm bg-series-revenue"
                />
                Revenue
              </span>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3.5 w-3.5 rounded-sm bg-series-profit"
                />
                Profit
              </span>
            </div>

            <div className="mt-5 overflow-x-auto">
              <MoneyChart months={months} />
            </div>

            {/* Every figure in the chart, written out. Nobody should have to
                read a number off a bar. */}
            <table className="mt-6 w-full text-base">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 text-right font-medium">Revenue</th>
                  <th className="pb-2 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((month) => (
                  <tr key={month.key} className="border-b border-line last:border-0">
                    <td className="py-2.5">{month.long}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatPence(month.revenuePence)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {month.profitPence === null
                        ? "Not known"
                        : formatPence(month.profitPence)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 text-sm text-muted">
              Revenue is what the client is charged: the material at their rate
              for it, plus the haulage fee on every collection. Profit is that
              less what the tip charged to take the load. A job with no tip
              charge typed against it is left out of profit rather than counted
              as costing nothing.
            </p>
          </div>
        </section>
      ) : null}

      <h2 className="text-lg font-semibold">Invoices</h2>
      <p className="mb-4 text-base text-muted">
        Late first, most overdue at the top, then whatever falls due soonest,
        then the ones already paid.
      </p>

      <div className="mb-5">
        <InvoiceSearch value={term} />
      </div>

      {rows.length === 0 ? (
        <div className="glass-dashed rounded-xl px-6 py-16 text-center">
          <p className="text-lg font-medium">No invoices yet</p>
          <p className="mx-auto mt-2 max-w-md text-base text-muted">
            Mark a job complete on the calendar, then press &ldquo;Generate
            invoices&rdquo; at the end of that week. The invoice appears here.
          </p>
        </div>
      ) : found.length === 0 ? (
        <div className="glass-dashed rounded-xl px-6 py-16 text-center">
          <p className="text-lg font-medium">
            Nothing found for &ldquo;{term}&rdquo;
          </p>
          <p className="mx-auto mt-2 max-w-md text-base text-muted">
            Try part of the client&rsquo;s name, or the invoice number on its
            own. Press &ldquo;Show all&rdquo; to get the whole list back.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-base text-muted">
            {term === ""
              ? `${found.length} ${found.length === 1 ? "invoice" : "invoices"}. `
              : `${found.length} of ${rows.length} ${rows.length === 1 ? "invoice" : "invoices"} match “${term}”. `}
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
            {found.map((row) => (
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
                      · {formatDateGB(row.date)} · {row.note}
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
                          : row.overdue
                            ? "bg-danger-soft text-danger"
                            : "bg-attention-soft text-attention"
                      }`}
                    >
                      {row.paid ? "Paid" : row.overdue ? "Overdue" : "Not paid"}
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
