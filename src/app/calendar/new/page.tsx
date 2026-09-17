import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import JobForm from "@/components/job-form";
import PageHeader from "@/components/page-header";
import { isValidISODate, monthKeyOf, todayISO } from "@/lib/calendar";
import { readActiveCustomers } from "@/lib/customers";
import { createJob } from "@/lib/job-actions";
import { formatDateGB } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Book a job",
};

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await connection();

  const requested = (await searchParams).date;
  // A missing or nonsense ?date= falls back to today rather than an empty box.
  const date =
    requested && isValidISODate(requested) ? requested : todayISO();

  const [customers] = await Promise.all([
    readActiveCustomers(),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <Link
        href={`/calendar?month=${monthKeyOf(date)}`}
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Back to calendar
      </Link>
      <div className="mt-4">
        <PageHeader
          title="Book a job"
          description={formatDateGB(date)}
        />
      </div>

      {customers.length === 0 ? (
        <div className="glass-dashed rounded-xl px-6 py-16 text-center">
          <p className="font-medium">No clients yet</p>
          <p className="mt-1 text-sm text-muted">
            A job is booked against a client, so add one first.
          </p>
          <Link
            href="/clients/new"
            className="mt-5 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover"
          >
            Add client
          </Link>
        </div>
      ) : (
        <JobForm
          customers={customers}
          action={createJob}
          submitLabel="Book job"
          cancelHref={`/calendar?month=${monthKeyOf(date)}`}
          defaultDate={date}
        />
      )}
    </main>
  );
}
