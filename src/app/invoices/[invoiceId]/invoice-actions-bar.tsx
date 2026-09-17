"use client";

/**
 * The buttons above an invoice: move it along, or print it.
 *
 * In the browser it runs on a click rather than a form submission, which is
 * why it is a client component.
 */
import { useTransition } from "react";

import { setInvoiceStatus } from "@/lib/invoice-actions";
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
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const [pending, startTransition] = useTransition();

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
      {/* A plain link to the PDF: asking for it builds the file, files a copy
          and opens it, so an invoice cannot go out unrecorded. */}
      <a
        href={`/invoices/${invoiceId}/pdf`}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover"
      >
        PDF
      </a>
    </div>
  );
}
