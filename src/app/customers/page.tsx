import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { readCustomers } from "@/lib/customers";
import { formatDateGB } from "@/lib/dates";
import { formatPence } from "@/lib/money";
import { DIRECTION_LABELS, type Customer } from "@/lib/types";

export const metadata: Metadata = {
  title: "Customers",
};

function RateLines({ customer }: { customer: Customer }) {
  if (customer.rateLines.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No rates recorded yet.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <th className="pb-2 font-medium">Material</th>
          <th className="pb-2 font-medium">Basis</th>
          <th className="pb-2 text-right font-medium">Rate</th>
          <th className="pb-2 text-right font-medium">Direction</th>
        </tr>
      </thead>
      <tbody>
        {customer.rateLines.map((line) => (
          <tr
            key={line.id}
            className="border-b border-gray-100 last:border-0 dark:border-gray-900"
          >
            <td className="py-2">{line.material}</td>
            <td className="py-2 text-gray-600 dark:text-gray-400">
              {line.basis}
            </td>
            <td className="py-2 text-right font-medium tabular-nums">
              {formatPence(line.ratePence)}
            </td>
            <td className="py-2 text-right">
              <span
                className={
                  line.direction === "pay"
                    ? "inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }
              >
                {DIRECTION_LABELS[line.direction]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-line">{value || "—"}</dd>
    </div>
  );
}

export default async function CustomersPage() {
  // Wait for a real visitor before reading the file. Without this, Next.js
  // would read it once while building and show that snapshot forever.
  await connection();
  const customers = await readCustomers();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {customers.length === 1
              ? "1 customer"
              : `${customers.length} customers`}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Add customer
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700">
          <p className="font-medium">No customers yet</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Add your first one to get started.
          </p>
        </div>
      ) : (
        <ul className="space-y-6">
          {customers.map((customer) => (
            <li
              key={customer.id}
              className="rounded-lg border border-gray-200 p-6 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">
                  {customer.businessName}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Added {formatDateGB(customer.createdAt)}
                </p>
              </div>

              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="mt-4 text-sm">
                  <Field label="Notes" value={customer.notes} />
                </div>
              ) : null}

              <div className="mt-6">
                <h3 className="mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
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
