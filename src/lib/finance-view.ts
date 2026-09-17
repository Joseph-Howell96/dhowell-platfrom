/**
 * The choices behind the Finance list: how it is laid out, how it is grouped,
 * what is filtered out.
 *
 * Kept apart from the page so the page can read them from the address bar and
 * a small piece of browser code can remember them, without either having to
 * know how the other works. Everything here is plain values and pure
 * functions, so both sides agree on what a valid choice is.
 */

/** List for scanning down, cards for reading one at a time. */
export const VIEWS = ["list", "cards"] as const;
export type View = (typeof VIEWS)[number];

/** What the rows are gathered under, or nothing at all. */
export const GROUPINGS = ["none", "client", "month"] as const;
export type Grouping = (typeof GROUPINGS)[number];

/**
 * Where a piece of billing has got to.
 *
 * Four states, and a row is in exactly one of them. "Uninvoiced" is work that
 * has been checked off and not yet billed - it is not an invoice at all, which
 * is the point of having it here: money earned and not yet asked for is the
 * easiest kind to lose track of.
 */
export const BILLING_STATES = [
  "uninvoiced",
  "invoiced",
  "paid",
  "overdue",
] as const;
export type BillingState = (typeof BILLING_STATES)[number];

export const BILLING_STATE_LABELS: Record<BillingState, string> = {
  uninvoiced: "Not yet invoiced",
  invoiced: "Invoiced",
  paid: "Paid",
  overdue: "Overdue",
};

export const BILLING_STATE_CLASSES: Record<BillingState, string> = {
  uninvoiced: "bg-weighed-soft text-weighed",
  invoiced: "bg-attention-soft text-attention",
  paid: "bg-sent-soft text-sent",
  overdue: "bg-danger-soft text-danger",
};

/** Everything that decides what the Finance list shows. */
export type FinanceView = {
  view: View;
  grouping: Grouping;
  /** Which states to show. Empty means all of them, not none. */
  states: BillingState[];
  /** Only rows dated on or after this, as "YYYY-MM-DD". Blank for no limit. */
  from: string;
  /** Only rows dated on or before this. Blank for no limit. */
  to: string;
};

export const DEFAULT_VIEW: FinanceView = {
  view: "list",
  grouping: "client",
  states: [],
  from: "",
  to: "",
};

/** The names these appear under in the address bar. */
export const PARAM_KEYS = ["view", "group", "state", "from", "to"] as const;

function one<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const first = Array.isArray(value) ? value[0] : value;
  return allowed.includes(first as T) ? (first as T) : fallback;
}

/**
 * Read a view out of whatever arrived in the address bar.
 *
 * Anything unrecognised falls back to the default rather than failing: a
 * hand-typed or stale address should show the list, not an error.
 */
export function viewFromParams(
  params: Record<string, string | string[] | undefined>,
): FinanceView {
  const rawStates = params.state;
  const states = (Array.isArray(rawStates)
    ? rawStates
    : typeof rawStates === "string"
      ? rawStates.split(",")
      : []
  ).filter((state): state is BillingState =>
    BILLING_STATES.includes(state as BillingState),
  );

  const date = (value: string | string[] | undefined) => {
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === "string" && /^\d{4}-\d{2}-\d{2}$/.test(first)
      ? first
      : "";
  };

  return {
    view: one(params.view, VIEWS, DEFAULT_VIEW.view),
    grouping: one(params.group, GROUPINGS, DEFAULT_VIEW.grouping),
    // Deduplicated, so "?state=paid&state=paid" is not two filters.
    states: [...new Set(states)],
    from: date(params.from),
    to: date(params.to),
  };
}

/** The same view written back out as a query string, defaults left off. */
export function paramsFromView(view: FinanceView): string {
  const params = new URLSearchParams();
  if (view.view !== DEFAULT_VIEW.view) params.set("view", view.view);
  if (view.grouping !== DEFAULT_VIEW.grouping) params.set("group", view.grouping);
  if (view.states.length > 0) params.set("state", view.states.join(","));
  if (view.from) params.set("from", view.from);
  if (view.to) params.set("to", view.to);
  return params.toString();
}

/** Is this row one of the states being shown? Empty filter means all. */
export function stateIsShown(view: FinanceView, state: BillingState): boolean {
  return view.states.length === 0 || view.states.includes(state);
}

/** Is this date inside the range? Blank ends mean no limit that way. */
export function dateIsShown(view: FinanceView, date: string): boolean {
  if (view.from && date < view.from) return false;
  if (view.to && date > view.to) return false;
  return true;
}
