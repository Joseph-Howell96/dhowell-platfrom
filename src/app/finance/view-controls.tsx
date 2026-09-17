"use client";

/**
 * The controls above the Finance list: layout, grouping, status and dates.
 *
 * The choices live in the address bar, which is what the page reads to decide
 * what to show. This also keeps a copy in the browser so that coming back to
 * Finance later lands on the same view rather than the default - the address
 * stays shareable, and the memory is per-browser, which is what "the last view
 * I was on" actually means.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  BILLING_STATES,
  BILLING_STATE_LABELS,
  DEFAULT_VIEW,
  GROUPINGS,
  PARAM_KEYS,
  paramsFromView,
  VIEWS,
  viewFromParams,
  type BillingState,
  type FinanceView,
  type Grouping,
  type View,
} from "@/lib/finance-view";

const STORE_KEY = "dennis.finance.view";

const VIEW_LABELS: Record<View, string> = {
  list: "List",
  cards: "Cards",
};

const GROUPING_LABELS: Record<Grouping, string> = {
  none: "No grouping",
  client: "By client",
  month: "By month",
};

const pill =
  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
const chosen = "bg-accent-soft text-accent";
const notChosen = "text-muted hover:text-ink";
const groupClass = "flex items-center gap-1 rounded-lg border border-line p-1";
const dateInput =
  "rounded-md border border-line bg-elevated px-2.5 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent";

/** Read the remembered view, or null where there is nothing usable saved. */
function readStored(): FinanceView | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    // Parsed back through the same reader the address bar uses, so anything
    // saved by an older version is checked rather than trusted.
    return viewFromParams(JSON.parse(raw) as Record<string, string>);
  } catch {
    // Private windows and blocked site data both throw. Nothing to remember
    // is not a problem worth showing anyone.
    return null;
  }
}

export default function ViewControls({ view }: { view: FinanceView }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Whether this visit has already had its chance to restore. Without it, a
  // deliberate return to the default view would be undone on the next render.
  const restored = useRef(false);

  const urlHasChoices = PARAM_KEYS.some((key) => searchParams.has(key));

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    // Only when the address says nothing. An address carrying choices - a
    // shared link, a bookmark, the back button - is what someone asked for.
    if (urlHasChoices) return;
    const stored = readStored();
    if (!stored) return;
    const query = paramsFromView(stored);
    if (query) router.replace(`/finance?${query}`, { scroll: false });
  }, [router, urlHasChoices]);

  // Save whatever is on screen, once it is the thing on screen.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          view: view.view,
          group: view.grouping,
          state: view.states.join(","),
          from: view.from,
          to: view.to,
        }),
      );
    } catch {
      // Nothing to do about a browser that will not store anything.
    }
  }, [view]);

  /** Move to a changed view, keeping the year the page is showing. */
  function go(next: FinanceView) {
    const query = new URLSearchParams(paramsFromView(next));
    const year = searchParams.get("year");
    if (year) query.set("year", year);
    const text = query.toString();
    router.replace(text ? `/finance?${text}` : "/finance", { scroll: false });
  }

  function toggleState(state: BillingState) {
    go({
      ...view,
      states: view.states.includes(state)
        ? view.states.filter((entry) => entry !== state)
        : [...view.states, state],
    });
  }

  const filtered =
    view.states.length > 0 || view.from !== "" || view.to !== "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className={groupClass}>
        {VIEWS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view.view === option}
            onClick={() => go({ ...view, view: option })}
            className={`${pill} ${view.view === option ? chosen : notChosen}`}
          >
            {VIEW_LABELS[option]}
          </button>
        ))}
      </div>

      <div className={groupClass}>
        {GROUPINGS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view.grouping === option}
            onClick={() => go({ ...view, grouping: option })}
            className={`${pill} ${view.grouping === option ? chosen : notChosen}`}
          >
            {GROUPING_LABELS[option]}
          </button>
        ))}
      </div>

      {/* Nothing ticked shows everything, which is why these read as filters
          rather than as a choice that has to be made. */}
      <div className={groupClass}>
        {BILLING_STATES.map((state) => (
          <button
            key={state}
            type="button"
            aria-pressed={view.states.includes(state)}
            onClick={() => toggleState(state)}
            className={`${pill} ${view.states.includes(state) ? chosen : notChosen}`}
          >
            {BILLING_STATE_LABELS[state]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-line p-1">
        <label className="pl-2 text-xs uppercase tracking-wide text-muted">
          From
          <input
            type="date"
            value={view.from}
            onChange={(event) => go({ ...view, from: event.target.value })}
            className={`${dateInput} ml-2`}
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-muted">
          To
          <input
            type="date"
            value={view.to}
            onChange={(event) => go({ ...view, to: event.target.value })}
            className={`${dateInput} ml-2`}
          />
        </label>
      </div>

      {filtered ? (
        <button
          type="button"
          onClick={() => go({ ...DEFAULT_VIEW, view: view.view, grouping: view.grouping })}
          className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
