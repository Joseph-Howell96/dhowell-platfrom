import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { invoicedJobIds, readInvoices } from "@/lib/invoices";
import { readJobs } from "@/lib/jobs";
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
  const billed = invoicedJobIds(invoices);

  // A job can be billed once it has been weighed, if we are charging for it
  // and it is not already on an invoice.
  const billable: BillableJob[] = jobs
    .filter(
      (job) =>
        job.direction === "sale" &&
        job.status !== "booked" &&
        !billed.has(job.id),
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
        const material = priceJob(job, client)?.pence ?? null;
        if (material === null) return null;
        return material + (haulageChargeFor(job, client)?.pence ?? 0);
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
        customers={customers}
        billable={billable}
        today={todayISO()}
      />
    </main>
  );
}
