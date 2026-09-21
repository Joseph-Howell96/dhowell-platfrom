"use client";

/**
 * Throwing a receipt away. Asks first, because the photograph is the only
 * copy: the paper one is long gone by the time anybody presses this.
 */
import { useState, useTransition } from "react";

import { removeReceipt } from "@/lib/receipt-actions";

export default function DeleteReceiptButton({
  receiptId,
  description,
}: {
  receiptId: string;
  /** Said back in the question, so nobody deletes the wrong card. */
  description: string;
}) {
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (asking) {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2.5">
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">
            Delete “{description}”?
          </span>{" "}
          The photograph goes with it and cannot be got back.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const reason = await removeReceipt(receiptId);
                if (reason) {
                  setProblem(reason);
                  setAsking(false);
                }
              })
            }
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
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="rounded-lg border border-line px-3 py-2.5 text-sm text-muted transition-colors hover:border-danger/50 hover:text-danger"
      >
        Delete
      </button>
      {problem ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </>
  );
}
