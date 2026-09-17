import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import DeleteJobButton from "./delete-job-button";
import JobForm from "@/components/job-form";
import PageHeader from "@/components/page-header";
import { monthKeyOf, todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { readOutlets } from "@/lib/outlets";
import { readSettings } from "@/lib/settings";
import { formatDateGB } from "@/lib/dates";
import { saveJob } from "@/lib/job-actions";
import { readJob } from "@/lib/jobs";
import { readInvoices } from "@/lib/invoices";
import { formatInvoiceNumber } from "@/lib/invoicing";
import { invoiceDueDate } from "@/lib/terms";
import { invoiceStanding } from "@/lib/types";
import type { JobInvoice } from "@/components/job-form";

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

  const [customers, outlets, settings, invoices] = await Promise.all([
    readCustomers(),
    readOutlets(),
    readSettings(),
    readInvoices(),
  ]);

  // Whether this job has been billed is not written on the job. It is billed
  // because an invoice lists it, so that is what we go and look for.
  const today = todayISO();
  const billedOn = invoices.find((invoice) => invoice.jobIds.includes(job.id));
  const invoice: JobInvoice | null = billedOn
    ? (() => {
        const dueDate = invoiceDueDate(
          billedOn.issueDate,
          settings.paymentTermsDays,
        );
        return {
          id: billedOn.id,
          reference: formatInvoiceNumber(
            settings.invoiceNumberPrefix,
            billedOn.number,
          ),
          standing: invoiceStanding(billedOn.status, dueDate, today),
          dueDate,
        };
      })()
    : null;
  const client = customers.find((customer) => customer.id === job.customerId);
  // Archived clients are not offered for new work, but a job already booked
  // against one has to keep showing it, or saving would lose the client.
  const choosable = customers.filter(
    (customer) => customer.archivedAt === null || customer.id === job.customerId,
  );

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
          // Kept up here, well away from Save, so the two cannot be confused.
          action={
            <DeleteJobButton
              jobId={job.id}
              invoice={
                invoice
                  ? {
                      reference: invoice.reference,
                      sent: billedOn?.status !== "draft",
                    }
                  : null
              }
            />
          }
        />
      </div>

      <JobForm
        customers={choosable}
        outlets={outlets}
        action={saveJob}
        submitLabel="Save changes"
        cancelHref={`/calendar?month=${monthKeyOf(job.date)}`}
        job={job}
        today={today}
        invoice={invoice}
      />
    </main>
  );
}
