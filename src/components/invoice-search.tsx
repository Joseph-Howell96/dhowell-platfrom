/**
 * Finding an invoice by client name or number.
 *
 * A plain form that asks the server for a filtered page, rather than anything
 * that filters as you type: the result is a page you can come back to, and it
 * works the same whether or not the browser is having a good day. Nothing here
 * runs in the browser at all.
 *
 * It lives on the Finance page and again on the Dashboard, where it sends you
 * to Finance with the answer already on screen.
 */
import Link from "next/link";

export default function InvoiceSearch({
  value = "",
  /** A shorter label, for the corner of the Dashboard. */
  compact = false,
}: {
  value?: string;
  compact?: boolean;
}) {
  return (
    <form
      method="get"
      action="/finance"
      // The form posts nothing but the search box, so a search never carries
      // yesterday's search along with it.
      className={compact ? "w-full sm:w-auto" : ""}
    >
      <label
        htmlFor={compact ? "find-dashboard" : "find"}
        className="mb-1.5 block text-sm font-medium"
      >
        Find an invoice
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={compact ? "find-dashboard" : "find"}
          name="find"
          type="search"
          defaultValue={value}
          placeholder="Client name or invoice number"
          className={`min-w-0 rounded-lg border border-line bg-elevated px-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-accent ${
            compact ? "flex-1 py-2 text-sm sm:w-64" : "flex-1 py-3 text-base sm:w-80 sm:flex-none"
          }`}
        />
        <button
          type="submit"
          className={`rounded-lg bg-accent font-semibold text-canvas transition-colors hover:bg-accent-hover ${
            compact ? "px-4 py-2 text-sm" : "px-5 py-3 text-base"
          }`}
        >
          Search
        </button>
        {value ? (
          <Link
            href="/finance"
            className={`rounded-lg border-2 border-line font-semibold text-ink transition-colors hover:border-accent hover:text-accent ${
              compact ? "px-4 py-2 text-sm" : "px-5 py-3 text-base"
            }`}
          >
            Show all
          </Link>
        ) : null}
      </div>
    </form>
  );
}
