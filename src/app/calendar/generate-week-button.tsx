"use client";

/**
 * The button on the end of a week, which raises that week's invoices.
 *
 * It says how many jobs are waiting so nobody has to press it to find out, and
 * goes quiet when there are none.
 */
import { useTransition } from "react";

import { generateWeekInvoices } from "@/lib/invoice-actions";

export default function GenerateWeekButton({
  weekStart,
  waiting,
  clients,
}: {
  weekStart: string;
  /** How many jobs that week are ready to bill and not yet on an invoice. */
  waiting: number;
  /** How many clients those jobs belong to, which is how many invoices follow. */
  clients: number;
}) {
  const [pending, startTransition] = useTransition();

  if (waiting === 0) {
    return (
      <span className="block px-2 py-3 text-center text-xs text-muted/50">
        —
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void generateWeekInvoices(weekStart);
        })
      }
      title={`${waiting} job${waiting === 1 ? "" : "s"} waiting, across ${clients} client${clients === 1 ? "" : "s"}`}
      className="block w-full rounded px-2 py-3 text-center text-xs font-medium text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
    >
      {pending ? "…" : "Invoice"}
      <span className="mt-0.5 block font-normal text-muted">
        {waiting} job{waiting === 1 ? "" : "s"}
      </span>
    </button>
  );
}
