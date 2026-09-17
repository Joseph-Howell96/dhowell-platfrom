import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { formatDateGB } from "@/lib/dates";
import { formatPence } from "@/lib/money";
import { readOutlets } from "@/lib/outlets";
import type { Outlet } from "@/lib/types";

export const metadata: Metadata = {
  title: "Outlets",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-line">{value || "—"}</dd>
    </div>
  );
}

function Materials({ outlet }: { outlet: Outlet }) {
  if (outlet.materials.length === 0) {
    return <p className="text-sm text-muted">No material income recorded yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[24rem] text-sm">
        <thead>
          <tr className="border-b border-line bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2.5 font-medium">Material</th>
            <th className="px-4 py-2.5 text-right font-medium">
              Income per tonne
            </th>
          </tr>
        </thead>
        <tbody>
          {outlet.materials.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3">{row.material}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatPence(row.incomePence)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function OutletsPage() {
  await connection();
  const outlets = await readOutlets();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Outlets"
        description={
          outlets.length === 0
            ? "Reprocessors we sell material on to."
            : `${outlets.length} ${outlets.length === 1 ? "outlet" : "outlets"}`
        }
        action={
          <Link
            href="/outlets/new"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover"
          >
            Add outlet
          </Link>
        }
      />

      {outlets.length === 0 ? (
        <div className="glass-dashed rounded-xl px-6 py-20 text-center">
          <p className="font-medium">No outlets yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            An outlet is a reprocessor we sell material to, such as Edwards.
            What they pay per tonne is what a rebate load earns.
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {outlets.map((outlet) => (
            <li
              key={outlet.id}
              className="glass rounded-xl p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{outlet.name}</h2>
                <p className="text-sm text-muted">
                  Added {formatDateGB(outlet.createdAt)}
                </p>
              </div>

              <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Address" value={outlet.address} />
                <Field label="Contact" value={outlet.contactName} />
                <Field label="Phone" value={outlet.phone} />
                <Field label="Email" value={outlet.email} />
              </dl>

              {outlet.notes ? (
                <div className="mt-5 text-sm">
                  <Field label="Notes" value={outlet.notes} />
                </div>
              ) : null}

              <div className="mt-6">
                <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">
                  Material income
                </h3>
                <Materials outlet={outlet} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
