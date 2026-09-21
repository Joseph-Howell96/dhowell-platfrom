"use client";

/**
 * Deleting a job.
 *
 * Asks twice rather than once: the first press turns into a plain yes or no,
 * so a stray click on a busy screen cannot lose a record. Kept away from the
 * save button for the same reason.
 *
 * A job that has been invoiced can still be deleted, but the question is a
 * fuller one: the invoice it is on comes down by the value of this job, and
 * if it has already gone to the client they need the corrected one.
 */
import { useState, useTransition } from "react";

import { removeJob } from "@/lib/job-actions";

export default function DeleteJobButton({
  jobId,
  invoice,
}: {
  jobId: string;
  /** The invoice this job is on, where it is on one. */
  invoice?: { reference: string; sent: boolean } | null;
}) {
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setProblem(null);
    startTransition(async () => {
      // A reason coming back means it did not go ahead; on success the server
      // sends the browser to the calendar and nothing returns here.
      const reason = await removeJob(jobId);
      if (reason) {
        setProblem(reason);
        setAsking(false);
      }
    });
  }

  return (
    <div className="text-right">
      {asking ? (
        <div className="inline-flex max-w-md flex-col items-end gap-2 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3">
          <p className="text-left text-sm">
            {invoice ? (
              <>
                <span className="font-medium">
                  This job is on invoice {invoice.reference}.
                </span>{" "}
                <span className="text-muted">
                  Deleting it takes the job off that invoice and brings the
                  total down to match.
                  {invoice.sent
                    ? " That invoice has already gone out, so the client will need the corrected one."
                    : ""}
                </span>
              </>
            ) : (
              <span className="text-muted">
                Delete this job? It cannot be undone.
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={confirmDelete}
              className="rounded-lg bg-danger px-3 py-3 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAsking(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:text-ink"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="rounded-lg border border-line px-3 py-2.5 text-sm text-muted transition-colors hover:border-danger/50 hover:text-danger"
        >
          Delete job
        </button>
      )}

      {problem ? (
        <p
          role="alert"
          className="mt-2 max-w-md rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-left text-sm text-danger"
        >
          {problem}
        </p>
      ) : null}
    </div>
  );
}
