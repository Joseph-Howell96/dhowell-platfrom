import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import JobForm from "@/components/job-form";
import PageHeader from "@/components/page-header";
import { monthKeyOf } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { formatDateGB } from "@/lib/dates";
import { saveJob } from "@/lib/job-actions";
import { readJob } from "@/lib/jobs";

export const metadata: Metadata = {
  title: "Job",
};

export default async function JobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await connection();

  const { jobId } = await params;
  const job = await readJob(jobId);
  // An address for a job that is not there shows the standard not-found page.
  if (!job) notFound();

  const customers = await readCustomers();
  const client = customers.find((customer) => customer.id === job.customerId);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <Link
        href={`/calendar?month=${monthKeyOf(job.date)}`}
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Back to calendar
      </Link>
      <div className="mt-4">
        <PageHeader
          title={client?.businessName ?? "Unknown client"}
          description={formatDateGB(job.date)}
        />
      </div>

      <JobForm
        customers={customers}
        action={saveJob}
        submitLabel="Save changes"
        cancelHref={`/calendar?month=${monthKeyOf(job.date)}`}
        job={job}
      />
    </main>
  );
}
