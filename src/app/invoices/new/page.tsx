import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { invoicedJobIds, readInvoices } from "@/lib/invoices";
import { readJobs } from "@/lib/jobs";
import { isBillable } from "@/lib/invoicing";
import { haulageChargeFor, priceJob } from "@/lib/pricing";
import RaiseInvoiceForm, { type BillableJob } from "./raise-invoice-form";

export const metadata: Metadata = {
  title: "Raise invoice",
};

export default async function NewInvoicePage() {
  await connection();

  const [customers, jobs, invoices] = await Promise.all([
    readCustomers(),
    readJobs(),
    readInvoices(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  // Archived clients are not offered, but their jobs still price correctly
  // from the record above.
  const choosable = customers.filter((c) => c.archivedAt === null);
  const billed = invoicedJobIds(invoices);

  // A job can be billed once it has been weighed, if we are charging for it
  // and it is not already on an invoice.
  const billable: BillableJob[] = jobs
    .filter(
      (job) =>
        job.status !== "booked" &&
        !billed.has(job.id) &&
        // A charge job bills its material; a rebate job only bills the haulage
        // on it, so it belongs here too once haulage is being charged.
        isBillable(job, clientsById.get(job.customerId)),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((job) => ({
      id: job.id,
      customerId: job.customerId,
      date: job.date,
      material: job.material,
      skipSize: job.skipSize,
      amountPence: (() => {
        const client = clientsById.get(job.customerId);
        const haulage = haulageChargeFor(job, client)?.pence ?? 0;
        // Only a charge job puts its material on a sales invoice.
        if (job.direction !== "sale") return haulage;
        const material = priceJob(job, client)?.pence ?? null;
        return material === null ? null : material + haulage;
      })(),
    }));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <Link
        href="/invoices"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Back to invoices
      </Link>
      <div className="mt-4">
        <PageHeader title="Raise invoice" />
      </div>
      <RaiseInvoiceForm
        customers={choosable}
        billable={billable}
        today={todayISO()}
      />
    </main>
  );
}
