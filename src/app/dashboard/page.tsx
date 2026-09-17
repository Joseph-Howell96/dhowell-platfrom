import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import BillingsChart from "@/components/billings-chart";
import PageHeader from "@/components/page-header";
import {
  byMaterial,
  byMonth,
  isCompleted,
  marginPercent,
  totalsFor,
  yearsWithJobs,
  type Totals,
} from "@/lib/analytics";
import { todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { readJobs } from "@/lib/jobs";
import { readOutlets } from "@/lib/outlets";
import { formatPence } from "@/lib/money";

export const metadata: Metadata = {
  title: "Dashboard",
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await connection();

  const today = todayISO();
  const [jobs, customers, outlets] = await Promise.all([
    readJobs(),
    readCustomers(),
    readOutlets(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const outletsById = new Map(outlets.map((o) => [o.id, o]));

  const years = yearsWithJobs(jobs, today.slice(0, 4));
  const requested = (await searchParams).year;
  const year = requested && years.includes(requested) ? requested : years[0];

  const inYear = jobs.filter((job) => job.date.startsWith(year));
  const completed = inYear.filter(isCompleted);
  const scheduled = inYear.filter((job) => !isCompleted(job));

  const done = totalsFor(completed, clientsById, outletsById);
  const ahead = totalsFor(scheduled, clientsById, outletsById);
  const months = byMonth(completed, clientsById, outletsById);
  const materials = byMaterial(completed, clientsById, outletsById);

  // The widest margin sets the length of the bars, so they compare against each
  // other rather than against an arbitrary 100%.
  const widestMargin = Math.max(
    1,
    ...materials.map((row) => Math.abs(marginPercent(row.totals) ?? 0)),
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Dashboard"
        description="Completed work for the year, and what is still in the diary."
        action={
          <div className="flex items-center gap-1 rounded-lg border border-line p-1">
            {years.map((option) => (
              <Link
                key={option}
                href={`/dashboard?year=${option}`}
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
          label="Jobs completed"
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
            Completed jobs in {year}, by the month the job was done.
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
              No completed jobs yet.
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

      <p className="mt-8 text-xs text-muted">
        Profit is what comes in less what goes out. On a charge job that is
        what the client is invoiced less the disposal cost. On a rebate job it
        is the material income from the outlet, less the rebate paid to the
        client, less haulage. Jobs missing one of those figures count towards
        revenue but are left out of profit and margin, rather than being treated
        as costing nothing.
      </p>
    </main>
  );
}
