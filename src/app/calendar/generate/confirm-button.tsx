"use client";

/**
 * The button that actually raises the invoices, at the foot of the preview.
 *
 * It is the only thing on that page which changes anything: everything above
 * it is there to be read first.
 */
import { useTransition } from "react";

import { generateWeekInvoices } from "@/lib/invoice-actions";

export default function ConfirmGenerate({
  weekStart,
  count,
  disabled,
}: {
  weekStart: string;
  /** How many invoices follow, said on the button so it is no surprise. */
  count: number;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(() => {
          void generateWeekInvoices(weekStart);
        })
      }
      className="rounded-lg bg-accent px-5 py-3 text-base font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-40"
    >
      {pending
        ? "Generating…"
        : count === 0
          ? "Nothing to generate"
          : `Generate ${count} ${count === 1 ? "invoice" : "invoices"}`}
    </button>
  );
}
