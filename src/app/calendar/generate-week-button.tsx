/**
 * The link on the end of a week, which opens that week's invoices for review.
 *
 * It used to raise them on the spot. It does not any more: pressing it opens a
 * page showing which days are being billed and what each client will be
 * charged, and nothing is written until the button down there is pressed. The
 * counts stay here so nobody has to open it to find out whether there is
 * anything waiting.
 *
 * A week does not have to be over. Anything already marked complete and priced
 * can be invoiced today, which is what happens when a client wants billing
 * early.
 */
import Link from "next/link";

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
   * Complete jobs this week that cannot be billed because the client record
   * has no rate for the material. Said out loud rather than left out, or a job
   * sits unbilled with nothing on screen to explain why.
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
  const href = `/calendar/generate?week=${weekStart}`;

  const needsRate =
    unpriced > 0
      ? `${unpriced} ${unpriced === 1 ? "job needs" : "jobs need"} a rate`
      : null;
  const needsChecking = toCheck > 0 ? `${toCheck} to check off` : null;

  // Nothing waiting is not the same as nothing to look at: the review page
  // says why a job is being left out, which is the thing worth reading when
  // the week looks emptier than it should.
  if (waiting === 0) {
    return (
      <Link
        href={href}
        className="block rounded px-2 py-3 text-center text-xs leading-tight text-muted transition-colors hover:bg-accent-soft"
      >
        {needsChecking ? (
          <span className="block text-weighed">{needsChecking}</span>
        ) : null}
        {needsRate ? (
          <span className="block text-attention">{needsRate}</span>
        ) : null}
        {!needsChecking && !needsRate ? "No jobs ready" : null}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      title={`Look over the ${clients} invoice${clients === 1 ? "" : "s"} this week would raise before any of them is written.`}
      className="block w-full rounded px-2 py-3 text-center text-xs font-medium leading-tight text-accent transition-colors hover:bg-accent-soft"
    >
      Generate invoices
      <span className="mt-1 block font-normal text-muted">
        {waiting} job{waiting === 1 ? "" : "s"} ready
      </span>
      {needsChecking ? (
        <span className="mt-0.5 block font-normal text-weighed">
          {needsChecking}
        </span>
      ) : null}
      {needsRate ? (
        <span className="mt-0.5 block font-normal text-attention">
          {needsRate}
        </span>
      ) : null}
    </Link>
  );
}
