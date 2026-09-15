import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { readCustomers } from "@/lib/customers";
import { formatDateGB } from "@/lib/dates";
import { formatPence } from "@/lib/money";
import { DIRECTION_LABELS, type Customer } from "@/lib/types";

export const metadata: Metadata = {
  title: "Clients",
};

function RateLines({ customer }: { customer: Customer }) {
  if (customer.rateLines.length === 0) {
    return <p className="text-sm text-muted">No rates recorded yet.</p>;
  }

  return (
    // Narrow screens scroll this table sideways rather than squashing the
    // columns until the wording breaks up.
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-line bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2.5 font-medium">Material</th>
            <th className="px-4 py-2.5 font-medium">Basis</th>
            <th className="px-4 py-2.5 text-right font-medium">Rate</th>
            <th className="px-4 py-2.5 text-right font-medium">Direction</th>
          </tr>
        </thead>
        <tbody>
          {customer.rateLines.map((line) => (
            <tr key={line.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3">{line.material}</td>
              <td className="px-4 py-3 text-muted">{line.basis}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatPence(line.ratePence)}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={
                    line.direction === "pay"
                      ? "inline-block whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
                      : "inline-block whitespace-nowrap rounded-full bg-elevated px-2.5 py-1 text-xs font-medium text-muted"
                  }
                >
                  {DIRECTION_LABELS[line.direction]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-line">{value || "—"}</dd>
    </div>
  );
}

export default async function ClientsPage() {
  // Wait for a real visitor before reading the file. Without this, Next.js
  // would read it once while building and show that snapshot forever.
  await connection();
  const customers = await readCustomers();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Clients"
        description={
          customers.length === 1 ? "1 client" : `${customers.length} clients`
        }
        action={
          <Link
            href="/clients/new"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover"
          >
            Add client
          </Link>
        }
      />

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-20 text-center">
          <p className="font-medium">No clients yet</p>
          <p className="mt-1 text-sm text-muted">
            Add your first one to get started.
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {customers.map((customer) => (
            <li
              key={customer.id}
              className="rounded-xl border border-line bg-surface p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  {customer.businessName}
                </h2>
                <p className="text-sm text-muted">
                  Added {formatDateGB(customer.createdAt)}
                </p>
              </div>

              <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Site address" value={customer.siteAddress} />
                <Field label="Billing address" value={customer.billingAddress} />
                <Field label="Contact" value={customer.contactName} />
                <Field label="Phone" value={customer.phone} />
                <Field label="Email" value={customer.email} />
                <Field
                  label="Payment terms"
                  value={`${customer.paymentTermsDays} days`}
                />
              </dl>

              {customer.notes ? (
                <div className="mt-5 text-sm">
                  <Field label="Notes" value={customer.notes} />
                </div>
              ) : null}

              <div className="mt-6">
                <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">
                  Rates
                </h3>
                <RateLines customer={customer} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
