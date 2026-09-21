/**
 * The search box, wherever one appears.
 *
 * A plain form that asks the server for a page of results, rather than
 * anything that filters as you type: the result is a page you can come back
 * to, and it works the same whether or not the browser is having a good day.
 * Nothing here runs in the browser at all.
 *
 * Two of them exist. Finance has one that narrows its own invoice list; the
 * Dashboard and the Search screen have one that looks at everything.
 */
import Link from "next/link";

export default function SearchForm({
  /** Where the answer is shown. */
  action,
  /** What the box is called in the address bar. */
  name,
  label,
  placeholder,
  value = "",
  /** A shorter one, for the corner of the Dashboard. */
  compact = false,
}: {
  action: string;
  name: string;
  label: string;
  placeholder: string;
  value?: string;
  compact?: boolean;
}) {
  const id = `${name}-${compact ? "compact" : "full"}`;
  return (
    <form method="get" action={action} className={compact ? "w-full sm:w-auto" : ""}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          name={name}
          type="search"
          defaultValue={value}
          placeholder={placeholder}
          className={`min-w-0 rounded-lg border border-line bg-elevated px-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-accent ${
            compact
              ? "flex-1 py-2.5 text-base sm:w-72"
              : "flex-1 py-3 text-base sm:w-80 sm:flex-none"
          }`}
        />
        <button
          type="submit"
          className={`rounded-lg bg-accent font-semibold text-canvas transition-colors hover:bg-accent-hover ${
            compact ? "px-4 py-2.5 text-base" : "px-5 py-3 text-base"
          }`}
        >
          Search
        </button>
        {value ? (
          <Link
            href={action}
            className={`rounded-lg border-2 border-line font-semibold text-ink transition-colors hover:border-accent hover:text-accent ${
              compact ? "px-4 py-2.5 text-base" : "px-5 py-3 text-base"
            }`}
          >
            Show all
          </Link>
        ) : null}
      </div>
    </form>
  );
}
