import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import GenerateWeekButton from "./generate-week-button";
import PageHeader from "@/components/page-header";
import {
  addMonths,
  buildMonthGrid,
  isValidMonthKey,
  monthLabel,
  todayISO,
  WEEKDAY_NAMES,
} from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { invoicedJobIds, readInvoices } from "@/lib/invoices";
import { isAwaitingInvoice, isBillable } from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import {
  jobStanding,
  JOB_STANDINGS,
  JOB_STANDING_CLASSES,
  JOB_STANDING_LABELS,
  type Job,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Calendar",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // Read the file on every visit rather than once when the site was built.
  await connection();

  const today = todayISO();
  const requested = (await searchParams).month;
  // An unrecognised ?month= in the address falls back to this month instead of
  // showing a broken grid.
  const month =
    requested && isValidMonthKey(requested) ? requested : today.slice(0, 7);

  const [jobs, customers, invoices] = await Promise.all([
    readJobs(),
    readCustomers(),
    readInvoices(),
  ]);

  const clientNames = new Map(
    customers.map((customer) => [customer.id, customer.businessName]),
  );

  // Group the jobs by date once, so each cell is a quick lookup rather than a
  // fresh search through every job.
  const jobsByDate = new Map<string, Job[]>();
  for (const job of jobs) {
    const existing = jobsByDate.get(job.date);
    if (existing) existing.push(job);
    else jobsByDate.set(job.date, [job]);
  }

  const cells = buildMonthGrid(month);

  // The grid is whole weeks, so it splits cleanly into rows of seven.
  const weeks: typeof cells[] = [];
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7));
  }

  // What each week has waiting to be billed: weighed and not already on an
  // invoice. Counted here so the button can say so before it is pressed.
  //
  // A weighed job whose material has no matching rate on the client record is
  // counted separately rather than quietly left out. It cannot go on an
  // invoice - there would be nothing to charge - but it should not vanish
  // either, or a job sits there unbilled with nothing to say why.
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const alreadyBilled = invoicedJobIds(invoices);
  const waitingByWeek = weeks.map((week) => {
    const first = week[0].iso;
    const last = week[week.length - 1].iso;
    const waiting = jobs.filter(
      (job) =>
        job.date >= first &&
        job.date <= last &&
        isAwaitingInvoice(job, alreadyBilled),
    );
    const ready = waiting.filter((job) =>
      isBillable(job, clientsById.get(job.customerId)),
    );
    return {
      weekStart: first,
      waiting: ready.length,
      unpriced: waiting.length - ready.length,
      clients: new Set(ready.map((job) => job.customerId)).size,
    };
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Calendar"
        description="Click a day to book a job, or a job to open it. The button at the end of a week raises a draft invoice for each client with work that week, whether or not the week has finished."
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?month=${addMonths(month, -1)}`}
              aria-label="Previous month"
              className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              ←
            </Link>
            <Link
              href="/calendar"
              className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              Today
            </Link>
            <Link
              href={`/calendar?month=${addMonths(month, 1)}`}
              aria-label="Next month"
              className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              →
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
        {/* What each colour on the grid means. */}
        <ul className="flex flex-wrap items-center gap-2">
          {JOB_STANDINGS.map((standing) => (
            <li
              key={standing}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${JOB_STANDING_CLASSES[standing]}`}
            >
              {JOB_STANDING_LABELS[standing]}
            </li>
          ))}
        </ul>
      </div>

      {customers.length === 0 ? (
        <p className="mb-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
          Jobs are booked against a client, and there are none yet.{" "}
          <Link href="/clients/new" className="text-accent hover:underline">
            Add a client first
          </Link>
          .
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <div className="min-w-[56rem]">
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_9rem] gap-px rounded-t-xl border border-line bg-line">
            {WEEKDAY_NAMES.map((name) => (
              <div
                key={name}
                className="bg-elevated px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted"
              >
                {name}
              </div>
            ))}
            <div className="bg-elevated px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted">
              Generate invoices
            </div>
          </div>

          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_9rem] gap-px rounded-b-xl border border-t-0 border-line bg-line">
            {weeks.flatMap((week, weekIndex) => [
              ...week.map((cell) => {
              const dayJobs = jobsByDate.get(cell.iso) ?? [];
              const isToday = cell.iso === today;

              return (
                <div
                  key={cell.iso}
                  className={`min-h-28 p-1.5 ${
                    cell.inMonth ? "bg-surface" : "bg-canvas"
                  }`}
                >
                  <Link
                    href={`/calendar/new?date=${cell.iso}`}
                    // The whole empty area of the day is the target, so there
                    // is no small number to aim at.
                    className="group flex items-center justify-between rounded px-1 py-0.5 text-xs transition-colors hover:bg-elevated"
                    title={`Book a job on ${cell.iso.split("-").reverse().join("/")}`}
                  >
                    <span
                      className={
                        isToday
                          ? "grid h-5 w-5 place-items-center rounded-full bg-accent font-semibold text-canvas"
                          : cell.inMonth
                            ? "text-muted"
                            : "text-muted/40"
                      }
                    >
                      {cell.dayOfMonth}
                    </span>
                    {/* A quiet "+" that only shows while the day is hovered,
                        hinting that clicking it books a job. */}
                    <span className="text-transparent transition-colors group-hover:text-muted">
                      +
                    </span>
                  </Link>

                  <ul className="mt-1 space-y-1">
                    {dayJobs.map((job) => {
                      // A job reads as invoiced because it is on an invoice.
                      // Nothing on the job itself says so.
                      const standing = jobStanding(
                        job.status,
                        alreadyBilled.has(job.id),
                      );
                      return (
                      <li key={job.id}>
                        <Link
                          href={`/calendar/${job.id}`}
                          className={`block truncate rounded px-1.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${JOB_STANDING_CLASSES[standing]}`}
                          title={`${clientNames.get(job.customerId) ?? "Unknown client"} — ${job.material}${job.skipSize ? `, ${job.skipSize}` : ""} (${JOB_STANDING_LABELS[standing]})`}
                        >
                          {clientNames.get(job.customerId) ?? "Unknown client"}
                        </Link>
                      </li>
                      );
                    })}
                  </ul>
                </div>
                );
              }),
              // The end of the week: everything on these seven days that is
              // ready to bill, turned into one invoice per client.
              <div key={`bill-${week[0].iso}`} className="bg-surface">
                <GenerateWeekButton
                  weekStart={waitingByWeek[weekIndex].weekStart}
                  waiting={waitingByWeek[weekIndex].waiting}
                  unpriced={waitingByWeek[weekIndex].unpriced}
                  clients={waitingByWeek[weekIndex].clients}
                />
              </div>,
            ])}
          </div>
        </div>
      </div>
    </main>
  );
}
