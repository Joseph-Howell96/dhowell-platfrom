"use client";

/**
 * Puts a client away, or brings one back. A click rather than a form, so it
 * runs in the browser.
 */
import { useTransition } from "react";

import { setCustomerArchived } from "@/lib/actions";

export default function ArchiveButton({
  clientId,
  archived,
}: {
  clientId: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void setCustomerArchived(clientId, !archived);
        })
      }
      className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {archived ? "Restore" : "Archive"}
    </button>
  );
}
