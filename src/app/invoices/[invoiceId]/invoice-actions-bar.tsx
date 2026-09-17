"use client";

/**
 * The buttons above an invoice: move it along, or print it.
 *
 * In the browser it runs on a click rather than a form submission, which is
 * why it is a client component.
 */
import { useTransition } from "react";

import { setInvoiceStatus } from "@/lib/invoice-actions";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/lib/types";

const LABELS: Record<InvoiceStatus, string> = {
  draft: "Back to draft",
  sent: "Mark as sent",
  paid: "Mark as paid",
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
      {INVOICE_STATUSES.filter((option) => option !== status).map((option) => (
        <button
          key={option}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void setInvoiceStatus(invoiceId, option);
            })
          }
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {LABELS[option]}
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
