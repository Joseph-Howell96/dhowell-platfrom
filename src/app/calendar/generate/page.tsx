import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import ConfirmGenerate from "./confirm-button";
import PageHeader from "@/components/page-header";
import {
  describeRange,
  isValidISODate,
  monthKeyOf,
  todayISO,
  WEEKDAY_NAMES,
  weekStartOf,
} from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { addCalendarDays, formatDateGB } from "@/lib/dates";
import { requireSession } from "@/lib/guard";
import { invoicedJobIds, readInvoices } from "@/lib/invoices";
import {
  isAwaitingInvoice,
  isBillable,
  lineForJob,
  haulageLineForJob,
} from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { readSettings } from "@/lib/settings";
import type { Job } from "@/lib/types";

export const metadata: Metadata = {
  title: "Generate invoices",
};

/** What one day of the week is holding, for the strip across the top. */
type Day = {
  iso: string;
  /** "Mon", for the label above the number. */
  name: string;
  /** The date on its own: 14. */
  number: number;
  /** Jobs on this day that will go on an invoice. */
  billing: number;
  /** Jobs on this day that will not, for whatever reason. */
  other: number;
  today: boolean;
};

export default async function GenerateInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Read the files on every visit: what is ready to bill can change between
  // looking at the calendar and pressing the button on this page.
  await connection();
  await requireSession("/calendar");

  const asked = (await searchParams).week;
  const requested = (Array.isArray(asked) ? asked[0] : asked) ?? "";
  const today = todayISO();
  // Whatever day was asked for, the week it belongs to. An address typed by
  // hand with a Wednesday in it still means that Wednesday's week.
  const weekStart = weekStartOf(
    isValidISODate(requested) ? requested : today,
  );
  const weekEnd = addCalendarDays(weekStart, 6);
  const backToMonth = `/calendar?month=${monthKeyOf(weekStart)}`;

  const [jobs, customers, invoices, settings] = await Promise.all([
    readJobs(),
    readCustomers(),
    readInvoices(),
    readSettings(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const billed = invoicedJobIds(invoices);

  const thisWeek = jobs.filter(
    (job) => job.date >= weekStart && job.date <= weekEnd,
  );

  // The three things a job can be: going on an invoice, checked off but with
  // no rate to charge it at, or weighed and not yet checked off. Anything
  // still in the diary is not in any of them - it is simply not done yet.
  const billing: Job[] = [];
  const unpriced: Job[] = [];
  const toCheck: Job[] = [];
  for (const job of thisWeek) {
    const client = clientsById.get(job.customerId);
    if (isAwaitingInvoice(job, billed)) {
      (isBillable(job, client) ? billing : unpriced).push(job);
    } else if (job.status === "weighed") {
      toCheck.push(job);
    }
  }

  const billingByDay = new Map<string, number>();
  for (const job of billing) {
    billingByDay.set(job.date, (billingByDay.get(job.date) ?? 0) + 1);
  }
  const otherByDay = new Map<string, number>();
  for (const job of thisWeek) {
    if (billingByDay.has(job.date) && billing.includes(job)) continue;
    if (!billing.includes(job)) {
      otherByDay.set(job.date, (otherByDay.get(job.date) ?? 0) + 1);
    }
  }

  const days: Day[] = WEEKDAY_NAMES.map((name, index) => {
    const iso = addCalendarDays(weekStart, index);
    return {
      iso,
      name,
      number: Number(iso.slice(8)),
      billing: billingByDay.get(iso) ?? 0,
      other: otherByDay.get(iso) ?? 0,
      today: iso === today,
    };
  });

  /** One invoice per client, so group the work the way the invoices will be. */
  const byClient = [...
    billing
      .reduce((groups, job) => {
        groups.set(job.customerId, [...(groups.get(job.customerId) ?? []), job]);
        return groups;
      }, new Map<string, Job[]>())
      .entries()
  ]
    .map(([customerId, clientJobs]) => {
      const client = clientsById.get(customerId);
      // What the invoice will come to, before VAT: the material at their rate,
      // plus the haulage fee on every collection.
      const netPence = clientJobs.reduce(
        (sum, job) =>
          sum +
          (lineForJob(job, client)?.amountPence ?? 0) +
          (haulageLineForJob(job, client)?.amountPence ?? 0),
        0,
      );
      return {
        customerId,
        name: client?.businessName ?? "Unknown client",
        jobs: [...clientJobs].sort((a, b) => a.date.localeCompare(b.date)),
        netPence,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const vatPence = Math.round((byClient.reduce((s, c) => s + c.netPence, 0) * settings.vatPercent) / 100);
  const netTotal = byClient.reduce((sum, client) => sum + client.netPence, 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <Link
        href={backToMonth}
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Back to the calendar
      </Link>
      <div className="mt-4">
        <PageHeader
          title="Generate invoices"
          description="Nothing is raised until you press the button at the bottom."
        />
      </div>

      {/* The week, said in words first. */}
      <p className="text-2xl font-semibold">
        {describeRange(weekStart, weekEnd)}
      </p>
      <p className="mt-1 text-base text-muted">
        {formatDateGB(weekStart)} to {formatDateGB(weekEnd)}
      </p>

      {/* And the same week drawn, so which days are being billed is a thing
          you can see rather than a thing you work out. */}
      <ol className="mt-5 grid grid-cols-7 gap-2">
        {days.map((day) => (
          <li
            key={day.iso}
            className={`rounded-lg border-2 px-1 py-3 text-center ${
              day.billing > 0
                ? "border-accent bg-accent-soft"
                : "border-line bg-elevated"
            }`}
          >
            <span className="block text-xs uppercase tracking-wide text-muted">
              {day.name}
            </span>
            <span
              className={`mt-1 block text-2xl font-semibold tabular-nums ${
                day.billing > 0 ? "text-accent" : "text-muted"
              }`}
            >
              {day.number}
            </span>
            <span className="mt-1 block text-xs leading-tight text-muted">
              {day.billing > 0
                ? `${day.billing} ${day.billing === 1 ? "job" : "jobs"}`
                : day.other > 0
                  ? "not ready"
                  : "—"}
            </span>
            {day.today ? (
              <span className="mt-1 block text-xs font-medium text-ink">
                today
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted">
        The days in green are the ones being invoiced. A week does not have to
        be over.
      </p>

      {billing.length === 0 ? (
        <div className="glass-dashed mt-8 rounded-xl px-6 py-14 text-center">
          <p className="text-lg font-medium">Nothing to invoice this week</p>
          <p className="mx-auto mt-2 max-w-md text-base text-muted">
            {toCheck.length > 0 || unpriced.length > 0
              ? "The jobs listed below are not ready yet."
              : "No job this week has been marked complete."}
          </p>
        </div>
      ) : (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">
            {byClient.length} {byClient.length === 1 ? "invoice" : "invoices"},
            covering {billing.length} {billing.length === 1 ? "job" : "jobs"}
          </h2>
          <p className="mt-1 mb-4 text-base text-muted">
            One per client, raised as a draft. {formatPence(netTotal)} before
            VAT, {formatPence(netTotal + vatPence)} with it.
          </p>

          <ul className="space-y-3">
            {byClient.map((client) => (
              <li key={client.customerId} className="glass rounded-xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="text-lg font-semibold">{client.name}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatPence(client.netPence)}
                    <span className="ml-2 text-sm font-normal text-muted">
                      before VAT
                    </span>
                  </p>
                </div>
                <ul className="mt-3 space-y-1">
                  {client.jobs.map((job) => (
                    <li key={job.id} className="text-base text-muted">
                      <Link
                        href={`/calendar/${job.id}`}
                        className="text-accent underline underline-offset-2"
                      >
                        {formatDateGB(job.date)}
                      </Link>{" "}
                      · {job.material}
                      {job.weightKg === null
                        ? ""
                        : ` · ${(job.weightKg / 1000).toFixed(2)} t`}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {toCheck.length > 0 || unpriced.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Left out</h2>
          <p className="mt-1 mb-3 text-base text-muted">
            These are on the calendar this week but will not be on an invoice.
          </p>
          <ul className="glass-dashed divide-y divide-line overflow-hidden rounded-xl">
            {[
              ...toCheck.map((job) => ({ job, why: "not marked complete yet" })),
              ...unpriced.map((job) => ({
                job,
                why: "the client has no rate for this material",
              })),
            ]
              .sort((a, b) => a.job.date.localeCompare(b.job.date))
              .map(({ job, why }) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-baseline gap-x-3 px-5 py-3 text-base text-muted"
                >
                  <Link
                    href={`/calendar/${job.id}`}
                    className="font-semibold text-accent underline underline-offset-2"
                  >
                    {formatDateGB(job.date)}
                  </Link>
                  <span className="text-ink">
                    {clientsById.get(job.customerId)?.businessName ??
                      "Unknown client"}
                  </span>
                  <span>{job.material}</span>
                  <span className="ml-auto">{why}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ConfirmGenerate
          weekStart={weekStart}
          count={byClient.length}
          disabled={billing.length === 0}
        />
        <Link
          href={backToMonth}
          className="rounded-lg border-2 border-line px-5 py-3 text-base font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}
