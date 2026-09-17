"use client";

/**
 * The "Mark as paid" button on a row in Finance.
 *
 * A button rather than a link because it changes a record. It is here as its
 * own small client component so that the Finance page itself can stay a plain
 * server-rendered list.
 *
 * Paid can be taken back. Somebody will press this on the wrong line, and a
 * button that cannot be undone would mean an invoice quietly dropping out of
 * what is owed with no way back.
 */
import { useTransition } from "react";

import { setInvoiceStatus } from "@/lib/invoice-actions";

export default function MarkPaidButton({
  invoiceId,
  paid,
}: {
  invoiceId: string;
  /** Whether this invoice is already settled. */
  paid: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void setInvoiceStatus(invoiceId, paid ? "sent" : "paid");
        })
      }
      className={
        paid
          ? "rounded-lg border-2 border-line px-5 py-3 text-base font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
          : "rounded-lg bg-accent px-5 py-3 text-base font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50"
      }
    >
      {pending
        ? "Saving…"
        : paid
          ? "Mark as not paid"
          : "Mark as paid"}
    </button>
  );
}
