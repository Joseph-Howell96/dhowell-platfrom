"use client";

/**
 * The button on the end of a week, which raises that week's invoices.
 *
 * It says how many jobs are waiting so nobody has to press it to find out. A
 * week does not have to be over: anything already marked complete and priced
 * can be invoiced today, which is what happens when a client wants billing
 * early.
 */
import { useTransition } from "react";

import { generateWeekInvoices } from "@/lib/invoice-actions";

export default function GenerateWeekButton({
  weekStart,
  waiting,
  unpriced,
  toCheck,
  clients,
}: {
  weekStart: string;
  /**
   * How many jobs that week are marked complete, priced, and not yet on an
   * invoice. Counted from the jobs themselves, so a week part way through
   * offers whatever is signed off rather than waiting for the week to end.
   */
  waiting: number;
  /**
   * Weighed jobs this week that cannot be billed because the client record has
   * no rate for the material at that skip size. Said out loud rather than left
   * out, or a job sits unbilled with nothing on screen to explain why.
   */
  unpriced: number;
  /**
   * Weighed jobs this week that nobody has marked complete yet. They are not
   * billable until someone has checked the ticket, and saying how many are
   * outstanding is more use than a bare "no jobs ready".
   */
  toCheck: number;
  /** How many clients those jobs belong to, which is how many invoices follow. */
  clients: number;
}) {
  const [pending, startTransition] = useTransition();

  const needsRate =
    unpriced > 0
      ? `${unpriced} ${unpriced === 1 ? "job needs" : "jobs need"} a rate`
      : null;
  const needsChecking =
    toCheck > 0 ? `${toCheck} to check off` : null;

  // Nothing waiting is not the same as not allowed. Saying what is outstanding
  // stops the column reading as though a week has to finish before it unlocks.
  if (waiting === 0) {
    return (
      <span className="block px-2 py-3 text-center text-xs leading-tight text-muted/60">
        {needsChecking ? (
          <span
            className="block text-weighed"
            title="These jobs have been weighed but not yet marked complete. Open the job and mark it complete once the ticket has been checked."
          >
            {needsChecking}
          </span>
        ) : null}
        {needsRate ? (
          <span
            className="block text-attention"
            title="These jobs are complete, but the client has no rate for the material at that skip size, so there is nothing to charge. Add the rate on their client record."
          >
            {needsRate}
          </span>
        ) : null}
        {!needsChecking && !needsRate ? "No jobs ready" : null}
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
      title={`Raise a draft invoice for each of the ${clients} client${clients === 1 ? "" : "s"} with completed work this week. The week does not have to be over.`}
      className="block w-full rounded px-2 py-3 text-center text-xs font-medium leading-tight text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
    >
      {pending ? "Working…" : "Generate invoices"}
      <span className="mt-1 block font-normal text-muted">
        {waiting} job{waiting === 1 ? "" : "s"} ready
      </span>
      {needsChecking ? (
        <span
          className="mt-0.5 block font-normal text-weighed"
          title="These jobs have been weighed but not yet marked complete. Open the job and mark it complete once the ticket has been checked."
        >
          {needsChecking}
        </span>
      ) : null}
      {needsRate ? (
        <span
          className="mt-0.5 block font-normal text-attention"
          title="These jobs are complete, but the client has no rate for the material at that skip size, so there is nothing to charge. Add the rate on their client record."
        >
          {needsRate}
        </span>
      ) : null}
    </button>
  );
}
