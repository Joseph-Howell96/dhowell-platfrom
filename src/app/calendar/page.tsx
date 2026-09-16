import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

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
import { readJobs } from "@/lib/jobs";
import {
  JOB_STATUSES,
  STATUS_CLASSES,
  STATUS_LABELS,
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

  const [jobs, customers] = await Promise.all([readJobs(), readCustomers()]);

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

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Calendar"
        description="Click a day to book a job. Click a job to open it."
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
          {JOB_STATUSES.map((status) => (
            <li
              key={status}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}
            >
              {STATUS_LABELS[status]}
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
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-7 gap-px rounded-t-xl border border-line bg-line">
            {WEEKDAY_NAMES.map((name) => (
              <div
                key={name}
                className="bg-elevated px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted"
              >
                {name}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px rounded-b-xl border border-t-0 border-line bg-line">
            {cells.map((cell) => {
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
                    {dayJobs.map((job) => (
                      <li key={job.id}>
                        <Link
                          href={`/calendar/${job.id}`}
                          className={`block truncate rounded px-1.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${STATUS_CLASSES[job.status]}`}
                          title={`${clientNames.get(job.customerId) ?? "Unknown client"} — ${job.material}${job.skipSize ? `, ${job.skipSize}` : ""} (${STATUS_LABELS[job.status]})`}
                        >
                          {clientNames.get(job.customerId) ?? "Unknown client"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
