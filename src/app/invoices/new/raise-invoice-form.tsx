"use client";

/**
 * Raising an invoice: pick a client, tick the jobs, set the date.
 *
 * It runs in the browser because the list of jobs changes as soon as you pick
 * a different client.
 */
import Link from "next/link";
import { useActionState, useState } from "react";

import Select from "@/components/select";
import { formatDateGB } from "@/lib/dates";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { createInvoice } from "@/lib/invoice-actions";
import { formatPence } from "@/lib/money";
import type { Customer } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";
const cardClass = "space-y-4 glass-solid rounded-xl p-6";

/** One job that could go on an invoice, already priced. */
export type BillableJob = {
  id: string;
  customerId: string;
  date: string;
  material: string;
  amountPence: number | null;
};

export default function RaiseInvoiceForm({
  customers,
  billable,
  today,
}: {
  customers: Customer[];
  billable: BillableJob[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    createInvoice,
    EMPTY_FORM_STATE,
  );
  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [customerPO, setCustomerPO] = useState("");
  // Which jobs are ticked. A job not in here is not being billed.
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const forClient = billable.filter((job) => job.customerId === customerId);

  function chooseCustomer(id: string) {
    setCustomerId(id);
    // Everything outstanding for that client, ticked ready, since a weekly
    // invoice normally covers the lot.
    setTicked(new Set(billable.filter((j) => j.customerId === id).map((j) => j.id)));
  }

  function toggle(id: string) {
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = forClient
    .filter((job) => ticked.has(job.id))
    .reduce((sum, job) => sum + (job.amountPence ?? 0), 0);

  return (
    <form action={formAction} noValidate className="space-y-6">
      {state.formError ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {state.formError}
        </p>
      ) : null}

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Invoice</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="customerId">
              Client
            </label>
            <Select
              id="customerId"
              name="customerId"
              className={inputClass}
              value={customerId}
              onChange={(event) => chooseCustomer(event.target.value)}
            >
              <option value="">Choose a client…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.businessName}
                </option>
              ))}
            </Select>
            {state.fieldErrors.customerId ? (
              <p className={errorClass}>{state.fieldErrors.customerId}</p>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="issueDate">
              Invoice date
            </label>
            <input
              id="issueDate"
              name="issueDate"
              type="date"
              className={inputClass}
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
            />
            {state.fieldErrors.issueDate ? (
              <p className={errorClass}>{state.fieldErrors.issueDate}</p>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="customerPO">
              Their PO / ref{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="customerPO"
              name="customerPO"
              className={inputClass}
              placeholder="e.g. PO-88421"
              value={customerPO}
              onChange={(event) => setCustomerPO(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className="text-base font-semibold">Jobs to bill</h2>
          <p className="mt-1 text-sm text-muted">
            Everything ready to invoice for this client, ticked ready. Untick
            anything that should wait for next week.
          </p>
        </div>

        {customerId === "" ? (
          <p className="py-8 text-center text-sm text-muted">
            Choose a client to see their outstanding jobs.
          </p>
        ) : forClient.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Nothing outstanding for this client. A job has to be weighed, and
            not already on an invoice, before it can be billed.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {forClient.map((job) => (
                <li key={job.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-elevated">
                    <input
                      type="checkbox"
                      name="jobId"
                      value={job.id}
                      checked={ticked.has(job.id)}
                      onChange={() => toggle(job.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className="w-24 shrink-0 text-muted">
                      {formatDateGB(job.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {job.material}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {job.amountPence === null
                        ? "—"
                        : formatPence(job.amountPence)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm text-muted">
              {ticked.size} of {forClient.length} ticked, net{" "}
              <span className="font-medium text-ink">{formatPence(total)}</span>
            </p>
          </>
        )}
        {state.fieldErrors.jobId ? (
          <p className={errorClass}>{state.fieldErrors.jobId}</p>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || ticked.size === 0}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Raising…" : "Raise invoice"}
        </button>
        <Link
          href="/invoices"
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
