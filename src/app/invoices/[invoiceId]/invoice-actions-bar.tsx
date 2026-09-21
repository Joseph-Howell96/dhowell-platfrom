"use client";

/**
 * The buttons above an invoice: move it along, open the PDF, or withdraw it.
 *
 * In the browser it runs on a click rather than a form submission, which is
 * why it is a client component.
 */
import { useState, useTransition } from "react";

import {
  deleteInvoice,
  restoreInvoice,
  setInvoiceStatus,
} from "@/lib/invoice-actions";
import type { InvoiceStatus } from "@/lib/types";

/**
 * What can be done next, given where the invoice is.
 *
 * Due and overdue are not in here on purpose: they follow from the date, and
 * offering them as buttons would let the two disagree.
 */
const NEXT: Record<InvoiceStatus, { to: InvoiceStatus; label: string }[]> = {
  draft: [{ to: "sent", label: "Mark as sent" }],
  sent: [
    { to: "paid", label: "Mark as paid" },
    { to: "draft", label: "Back to draft" },
  ],
  paid: [{ to: "sent", label: "Mark as unpaid" }],
};

export default function InvoiceActions({
  invoiceId,
  status,
  deleted,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  /** Whether this invoice has been withdrawn. */
  deleted: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /** Run one of the two, keeping any reason it gives for not going ahead. */
  function run(action: () => Promise<string | null>) {
    setProblem(null);
    startTransition(async () => {
      // A reason coming back means it did not happen; on success the server
      // sends the browser elsewhere and nothing returns here.
      const reason = await action();
      if (reason) {
        setProblem(reason);
        setAsking(false);
      }
    });
  }

  // A withdrawn invoice is not sent, paid or re-sent. The only question worth
  // asking about it is whether it should come back.
  if (deleted) {
    return (
      <div className="text-right">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => restoreInvoice(invoiceId))}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {pending ? "Restoring…" : "Restore invoice"}
          </button>
          <a
            href={`/invoices/${invoiceId}/document`}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            PDF
          </a>
        </div>
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

  if (asking) {
    return (
      <div className="inline-flex max-w-md flex-col items-end gap-2 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3">
        <p className="text-left text-sm text-muted">
          <span className="font-medium text-ink">Delete this invoice?</span> It
          moves to the deleted list in Finance, comes out of what is owed, and
          the jobs on it go back to waiting to be invoiced. Its number is not
          reused. You can put it back later.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteInvoice(invoiceId))}
            className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setAsking(false)}
            className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            Keep it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {NEXT[status].map((step) => (
        <button
          key={step.to}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void setInvoiceStatus(invoiceId, step.to);
            })
          }
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {step.label}
        </button>
      ))}
      {/* Goes to the document screen rather than straight at the file. That
          screen shows the PDF with a way back and a way to save it; opening
          the file itself handed the window to the browser's viewer and left
          no way back to the invoice. Either way the file is built and a copy
          filed, so an invoice cannot go out unrecorded. */}
      <a
        href={`/invoices/${invoiceId}/document`}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover"
      >
        PDF
      </a>
      {/* Set apart from the rest, so a hand going for "PDF" cannot land on it. */}
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="ml-2 rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-danger/50 hover:text-danger"
      >
        Delete
      </button>
    </div>
  );
}
