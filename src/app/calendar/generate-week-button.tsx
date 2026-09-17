"use client";

/**
 * The button on the end of a week, which raises that week's invoices.
 *
 * It says how many jobs are waiting so nobody has to press it to find out. A
 * week does not have to be over: anything already done and priced can be
 * invoiced today, which is what happens when a client wants billing early.
 */
import { useTransition } from "react";

import { generateWeekInvoices } from "@/lib/invoice-actions";

export default function GenerateWeekButton({
  weekStart,
  waiting,
  clients,
}: {
  weekStart: string;
  /**
   * How many jobs that week are ready to bill and not yet on an invoice.
   * Counted from the jobs themselves, so a week part way through offers
   * whatever is already done rather than waiting for the week to end.
   */
  waiting: number;
  /** How many clients those jobs belong to, which is how many invoices follow. */
  clients: number;
}) {
  const [pending, startTransition] = useTransition();

  // Nothing waiting is not the same as not allowed. Saying so plainly stops
  // the column reading as though a week has to finish before it unlocks.
  if (waiting === 0) {
    return (
      <span className="block px-2 py-3 text-center text-xs leading-tight text-muted/60">
        No jobs ready
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
      title={`Raise a draft invoice for each of the ${clients} client${clients === 1 ? "" : "s"} with work this week. The week does not have to be over.`}
      className="block w-full rounded px-2 py-3 text-center text-xs font-medium leading-tight text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
    >
      {pending ? "Working…" : "Generate invoices"}
      <span className="mt-1 block font-normal text-muted">
        {waiting} job{waiting === 1 ? "" : "s"} ready
      </span>
    </button>
  );
}
