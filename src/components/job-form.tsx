"use client";

/**
 * The form for booking a job and for changing one afterwards. Both screens use
 * it; the only differences are which action it calls, what it starts filled in
 * with, and the wording on the button.
 *
 * It runs in the browser because two things have to react as you type: picking
 * a client fills in their site address, and choosing "Other" for the material
 * reveals a box to type it in.
 */
import Link from "next/link";
import { useActionState, useState } from "react";

import Select from "@/components/select";
import { addCalendarDays, formatDateGB } from "@/lib/dates";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";
import {
  directionForRate,
  DIRECTION_JOB_LABELS,
  isWeighedOrLater,
  JOB_DIRECTIONS,
  JOB_MATERIALS,
  isCompleteOrLater,
  JOB_STANDING_CLASSES,
  JOB_STANDING_LABELS,
  JOB_STATUSES,
  STATUS_CLASSES,
  STATUS_HINTS,
  STATUS_LABELS,
  STANDING_CLASSES,
  STANDING_LABELS,
  type Customer,
  type InvoiceStanding,
  type Job,
  type JobDirection,
  type JobStatus,
} from "@/lib/types";
import { formatPence, penceToInputValue } from "@/lib/money";
import { findMaterialRate } from "@/lib/pricing";
import { kgToInputValue, parseTonnesToKg } from "@/lib/weight";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";
const cardClass = "space-y-4 glass-solid rounded-xl p-6";

/**
 * The invoice a job has been billed on, where it has been.
 *
 * "Invoiced" is not something anyone sets on a job - it is true because the
 * job appears on an invoice. Where the invoice itself has got to belongs to
 * the invoice, so it is read from there and only shown here.
 */
export type JobInvoice = {
  id: string;
  /** The number as it reads on the document, e.g. "INV-1042". */
  reference: string;
  standing: InvoiceStanding;
  dueDate: string;
};

type Props = {
  /** The clients a job can be booked against. */
  customers: Customer[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  cancelHref: string;
  /** The job being changed, or nothing when booking a new one. */
  job?: Job;
  /** Which day was clicked on the calendar, for a new job. */
  defaultDate?: string;
  /** The invoice this job is on, or nothing while it has not been billed. */
  invoice?: JobInvoice | null;
};

export default function JobForm({
  customers,
  action,
  submitLabel,
  cancelHref,
  job,
  defaultDate,
  invoice,
}: Props) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  // A material that is not one of the listed ones must have been typed into
  // the "Other" box, so the form reopens in that state when you come back.
  const savedMaterialIsListed =
    job !== undefined &&
    (JOB_MATERIALS as readonly string[]).includes(job.material);

  const [customerId, setCustomerId] = useState(job?.customerId ?? "");
  const [siteAddress, setSiteAddress] = useState(job?.siteAddress ?? "");
  const [date, setDate] = useState(job?.date ?? defaultDate ?? "");
  const [material, setMaterial] = useState(
    job ? (savedMaterialIsListed ? job.material : "Other") : "",
  );
  const [otherMaterial, setOtherMaterial] = useState(
    job && !savedMaterialIsListed ? job.material : "",
  );
  const [notes, setNotes] = useState(job?.notes ?? "");
  const [status, setStatus] = useState<JobStatus>(job?.status ?? "booked");
  const [weightTonnes, setWeightTonnes] = useState(
    job?.weightKg !== null && job?.weightKg !== undefined
      ? kgToInputValue(job.weightKg)
      : "",
  );
  const [direction, setDirection] = useState<JobDirection>(
    job?.direction ?? "sale",
  );
  const [supplierPO, setSupplierPO] = useState(job?.supplierPO ?? "");
  const [poRaisedDate, setPoRaisedDate] = useState(job?.poRaisedDate ?? "");
  const [supplierInvoiceRef, setSupplierInvoiceRef] = useState(
    job?.supplierInvoiceRef ?? "",
  );
  const [paidDate, setPaidDate] = useState(job?.paidDate ?? "");
  const [disposalCost, setDisposalCost] = useState(
    job?.disposalCostPence != null ? penceToInputValue(job.disposalCostPence) : "",
  );
  const [onwardSale, setOnwardSale] = useState(
    job?.onwardSalePence != null ? penceToInputValue(job.onwardSalePence) : "",
  );
  const [haulageCost, setHaulageCost] = useState(
    job?.haulageCostPence != null ? penceToInputValue(job.haulageCostPence) : "",
  );

  /**
   * Switching between a sale and a purchase. Both run through the same three
   * statuses now, so where the job has got to carries across untouched.
   */
  function chooseDirection(next: JobDirection) {
    setDirection(next);
  }

  /**
   * Picking a material sets the direction from the client's rate for it, since
   * that is what says whether we charge for this material or pay for it. It
   * can still be changed by hand afterwards.
   */
  function applyRateDirection(customerIdNow: string, materialNow: string) {
    const client = customers.find((c) => c.id === customerIdNow);
    const rate = client?.rateLines.find(
      (line) => line.material.toLowerCase() === materialNow.toLowerCase(),
    );
    if (rate) chooseDirection(directionForRate(rate.direction));
  }

  /**
   * Is there a weight on this job yet?
   *
   * Read from the box rather than from what was saved, so ticking a job off
   * works the moment the weighbridge figure is typed in, without saving first.
   */
  const hasWeight = parseTonnesToKg(weightTonnes) !== null;

  /**
   * What we owe this client runs on their own agreed terms, taken from their
   * client record, rather than the working-day count we give our customers.
   */
  const supplierTermsDays =
    customers.find((customer) => customer.id === customerId)
      ?.paymentTermsDays ?? null;

  /**
   * The client's haulage fee, in pence, or null before one is chosen.
   *
   * Nothing on this form decides it. Every collection carries it, so it is
   * shown here and nowhere asked about - it is a fact about the client, not a
   * choice about the job.
   */
  const haulageNowPence =
    customers.find((customer) => customer.id === customerId)?.haulageFeePence ??
    null;

  /**
   * What the material comes to, worked out from the weight in the box rather
   * than the saved one, so the figures move as the ticket is typed in.
   */
  const materialRate = findMaterialRate(
    customers.find((customer) => customer.id === customerId),
    { material: material === "Other" ? otherMaterial : material },
  );
  const weightKgNow = parseTonnesToKg(weightTonnes);
  const materialPence =
    materialRate?.ratePerTonnePence != null && weightKgNow !== null
      ? Math.round((materialRate.ratePerTonnePence * weightKgNow) / 1000)
      : null;

  /**
   * The two charges on this job, kept apart on purpose.
   *
   * Haulage is a separate line here for the same reason it is a separate line
   * on the invoice: it is a charge for the lorry, not for what was in it, and
   * folding the two together loses the only figure worth arguing about when a
   * client rings up.
   */
  const charges = [
    materialPence !== null
      ? {
          key: "material",
          label: material === "Other" ? otherMaterial || "Material" : material,
          detail: `${(weightKgNow! / 1000).toFixed(2)} t at ${formatPence(materialRate!.ratePerTonnePence!)} per tonne`,
          pence: materialPence,
          /** A rebate is money out, so it is shown as such rather than added. */
          outward: direction === "purchase",
        }
      : null,
    haulageNowPence !== null
      ? {
          key: "haulage",
          label: "Haulage",
          detail: "one collection, the client's fee",
          pence: haulageNowPence,
          outward: false,
        }
      : null,
  ].filter((line) => line !== null);

  /** Picking a client fills in their site address, saving retyping it. */
  function chooseCustomer(id: string) {
    setCustomerId(id);
    const chosen = customers.find((customer) => customer.id === id);
    // Only fill a blank box, so an address already typed is never overwritten.
    if (chosen && siteAddress.trim() === "") {
      setSiteAddress(chosen.siteAddress);
    }
    applyRateDirection(id, material === "Other" ? otherMaterial : material);
  }

  function chooseMaterial(value: string) {
    setMaterial(value);
    if (value !== "Other") applyRateDirection(customerId, value);
  }

  return (
    <form action={formAction} noValidate className="space-y-6">
      {job ? <input type="hidden" name="jobId" value={job.id} /> : null}
      <input type="hidden" name="direction" value={direction} />

      {state.formError ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {state.formError}
        </p>
      ) : null}

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Job details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
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
            <label className={labelClass} htmlFor="date">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              className={inputClass}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            {state.fieldErrors.date ? (
              <p className={errorClass}>{state.fieldErrors.date}</p>
            ) : null}
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="siteAddress">
            Site address
          </label>
          <textarea
            id="siteAddress"
            name="siteAddress"
            rows={3}
            className={inputClass}
            placeholder="Where the skip goes"
            value={siteAddress}
            onChange={(event) => setSiteAddress(event.target.value)}
          />
          {state.fieldErrors.siteAddress ? (
            <p className={errorClass}>{state.fieldErrors.siteAddress}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="material">
              Material
            </label>
            <Select
              id="material"
              name="material"
              className={inputClass}
              value={material}
              onChange={(event) => chooseMaterial(event.target.value)}
            >
              <option value="">Choose a material…</option>
              {JOB_MATERIALS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            {state.fieldErrors.material ? (
              <p className={errorClass}>{state.fieldErrors.material}</p>
            ) : null}

            {material === "Other" ? (
              <div className="mt-3">
                <label className={labelClass} htmlFor="otherMaterial">
                  Which material?
                </label>
                <input
                  id="otherMaterial"
                  name="otherMaterial"
                  className={inputClass}
                  placeholder="e.g. Plasterboard"
                  value={otherMaterial}
                  onChange={(event) => {
                    setOtherMaterial(event.target.value);
                    applyRateDirection(customerId, event.target.value);
                  }}
                />
                {state.fieldErrors.otherMaterial ? (
                  <p className={errorClass}>
                    {state.fieldErrors.otherMaterial}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className="text-base font-semibold">Which way does the money go?</h2>
          <p className="mt-1 text-sm text-muted">
            Set from the client&rsquo;s rate for this material when you pick
            one. Change it here if this job is the other way round.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {JOB_DIRECTIONS.map((option) => {
            const chosen = direction === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => chooseDirection(option)}
                aria-pressed={chosen}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  chosen
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-muted hover:border-muted hover:text-ink"
                }`}
              >
                {DIRECTION_JOB_LABELS[option]}
              </button>
            );
          })}
        </div>
        {state.fieldErrors.direction ? (
          <p className={errorClass}>{state.fieldErrors.direction}</p>
        ) : null}
      </section>

      <section className={cardClass}>
        <div>
          <h2 className="text-base font-semibold">Status</h2>
          <p className="mt-1 text-sm text-muted">
            {direction === "sale"
              ? "Where the job has got to on its way to being invoiced."
              : "Where the job has got to on its way to being paid for."}{" "}
            This sets its colour on the calendar.
          </p>
        </div>

        {/* Invoiced is not one of the buttons because it is not a choice. The
            job is invoiced because it is on an invoice, and how that invoice
            is getting on is the invoice's own business, shown here for the
            sake of not having to go looking for it. */}
        {invoice ? (
          <Link
            href={`/invoices/${invoice.id}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-elevated/40 px-4 py-3 transition-colors hover:border-accent"
          >
            <span
              className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${JOB_STANDING_CLASSES.invoiced}`}
            >
              {JOB_STANDING_LABELS.invoiced}
            </span>
            <span className="text-sm font-medium tabular-nums">
              {invoice.reference}
            </span>
            <span
              className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STANDING_CLASSES[invoice.standing]}`}
            >
              {STANDING_LABELS[invoice.standing]}
            </span>
            <span className="text-xs text-muted">
              {invoice.standing === "draft"
                ? "Not sent yet"
                : invoice.standing === "paid"
                  ? "Settled"
                  : `Due ${formatDateGB(invoice.dueDate)}`}
            </span>
            <span className="ml-auto text-sm text-accent">Open invoice →</span>
          </Link>
        ) : null}

        {/* A hidden field carries the choice, so the buttons below are just a
            nicer way of picking one of the few values this job can be at. */}
        <input type="hidden" name="status" value={status} />
        <div className="grid gap-2 sm:grid-cols-3">
          {JOB_STATUSES.map((option) => {
            const chosen = status === option;
            // Everything from "complete" on is a statement about a figure, so
            // it cannot be picked until there is a figure. The server refuses
            // it too; this just stops the button being a dead end.
            const blocked = isCompleteOrLater(option) && !hasWeight;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                aria-pressed={chosen}
                disabled={blocked}
                title={
                  blocked
                    ? "Enter the weight in tonnes first. A job cannot be checked off without one."
                    : undefined
                }
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  chosen
                    ? `border-transparent ${STATUS_CLASSES[option]}`
                    : blocked
                      ? "cursor-not-allowed border-line text-muted/40"
                      : "border-line text-muted hover:border-muted hover:text-ink"
                }`}
              >
                <span className="block text-sm font-semibold">
                  {STATUS_LABELS[option]}
                </span>
                <span className="mt-0.5 block text-xs opacity-80">
                  {blocked ? "Needs a weight first" : STATUS_HINTS[option]}
                </span>
              </button>
            );
          })}
        </div>
        {state.fieldErrors.status ? (
          <p className={errorClass}>{state.fieldErrors.status}</p>
        ) : null}

        {isWeighedOrLater(status) ? (
          <div className="border-t border-line pt-4">
            <label className={labelClass} htmlFor="weightTonnes">
              Weight (tonnes)
            </label>
            <input
              id="weightTonnes"
              name="weightTonnes"
              inputMode="decimal"
              className={`${inputClass} sm:max-w-[14rem]`}
              placeholder="2.45"
              value={weightTonnes}
              onChange={(event) => setWeightTonnes(event.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted">
              Off the weighbridge ticket. Per-tonne rates are worked out from
              this.
            </p>
            {state.fieldErrors.weightTonnes ? (
              <p className={errorClass}>{state.fieldErrors.weightTonnes}</p>
            ) : null}

            {/* The other half of the sum. What the client is charged or paid
                comes from their rate; this is the other side of it, and
                without it the job has a revenue but no profit. */}
            <div className="mt-4">
              <label
                className={labelClass}
                htmlFor={direction === "sale" ? "disposalCost" : "onwardSale"}
              >
                {direction === "sale" ? "Disposal cost (£)" : "Sold on for (£)"}{" "}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              {direction === "sale" ? (
                <input
                  id="disposalCost"
                  name="disposalCost"
                  inputMode="decimal"
                  className={`${inputClass} sm:max-w-[14rem]`}
                  placeholder="120.00"
                  value={disposalCost}
                  onChange={(event) => setDisposalCost(event.target.value)}
                />
              ) : (
                <input
                  id="onwardSale"
                  name="onwardSale"
                  inputMode="decimal"
                  className={`${inputClass} sm:max-w-[14rem]`}
                  placeholder="260.00"
                  value={onwardSale}
                  onChange={(event) => setOnwardSale(event.target.value)}
                />
              )}
              <p className="mt-1.5 text-xs text-muted">
                {direction === "sale"
                  ? "What the tip charged us to take this load. Profit on the dashboard is what we charged less this."
                  : "What this load sold on for. Until it is filled in the job has a cost and no income, so it is left out of profit."}
              </p>
              {state.fieldErrors.disposalCost ? (
                <p className={errorClass}>{state.fieldErrors.disposalCost}</p>
              ) : null}
              {state.fieldErrors.onwardSale ? (
                <p className={errorClass}>{state.fieldErrors.onwardSale}</p>
              ) : null}
            </div>

            {direction === "purchase" ? (
              <div className="mt-4">
                <label className={labelClass} htmlFor="haulageCost">
                  Haulage (£){" "}
                  <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="haulageCost"
                  name="haulageCost"
                  inputMode="decimal"
                  className={`${inputClass} sm:max-w-[14rem]`}
                  placeholder="85.00"
                  value={haulageCost}
                  onChange={(event) => setHaulageCost(event.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted">
                  What it cost to get the load away. Margin is what it sold
                  on for, less the rebate, less this.
                </p>
                {state.fieldErrors.haulageCost ? (
                  <p className={errorClass}>{state.fieldErrors.haulageCost}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Paying the client for their material. Not part of the run of work
            above - the job is done when it is checked off, whether or not the
            order has gone out yet - so all of this is optional and filled in
            as it happens. */}
        {direction === "purchase" && status === "complete" ? (
          <div className="space-y-4 border-t border-line pt-4">
            <p className="text-sm font-medium">
              Paying the client{" "}
              <span className="font-normal text-muted">
                (fill in as it happens)
              </span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="supplierPO">
                  Our PO number{" "}
                  <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="supplierPO"
                  name="supplierPO"
                  className={inputClass}
                  placeholder="e.g. PO-2026-0148"
                  value={supplierPO}
                  onChange={(event) => setSupplierPO(event.target.value)}
                />
                {state.fieldErrors.supplierPO ? (
                  <p className={errorClass}>{state.fieldErrors.supplierPO}</p>
                ) : null}
              </div>
              <div>
                <label className={labelClass} htmlFor="poRaisedDate">
                  Date PO raised{" "}
                  <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="poRaisedDate"
                  name="poRaisedDate"
                  type="date"
                  className={inputClass}
                  value={poRaisedDate}
                  onChange={(event) => setPoRaisedDate(event.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted">
                  {poRaisedDate && supplierTermsDays !== null
                    ? `Due ${formatDateGB(addCalendarDays(poRaisedDate, supplierTermsDays))} — ${supplierTermsDays} days, this client's terms.`
                    : "Their payment terms run from this date."}
                </p>
                {state.fieldErrors.poRaisedDate ? (
                  <p className={errorClass}>{state.fieldErrors.poRaisedDate}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="supplierInvoiceRef">
                Their invoice number{" "}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="supplierInvoiceRef"
                name="supplierInvoiceRef"
                className={`${inputClass} sm:max-w-[20rem]`}
                placeholder="Leave blank if we self-bill"
                value={supplierInvoiceRef}
                onChange={(event) => setSupplierInvoiceRef(event.target.value)}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="paidDate">
                Date paid{" "}
                <span className="font-normal text-muted">
                  (leave blank until it is)
                </span>
              </label>
              <input
                id="paidDate"
                name="paidDate"
                type="date"
                className={`${inputClass} sm:max-w-[14rem]`}
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
              />
              {state.fieldErrors.paidDate ? (
                <p className={errorClass}>{state.fieldErrors.paidDate}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {charges.length > 0 ? (
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-sm font-medium">What this job bills</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {charges.map((line) => (
                <li
                  key={line.key}
                  className="flex flex-wrap items-baseline gap-x-3 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{line.label}</span>
                  <span className="text-xs text-muted">{line.detail}</span>
                  <span className="ml-auto tabular-nums">
                    {line.outward ? "−" : ""}
                    {formatPence(line.pence)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-muted">
              Worked out from the client&rsquo;s record as you type, not stored.
              Haulage is charged on every collection, at the fee on their client
              record. A rebate shows as money out. Each of these is its own line
              on the invoice.
            </p>
          </div>
        ) : null}
      </section>

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Notes</h2>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className={inputClass}
          placeholder="Access, gate codes, anything the driver needs"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || customers.length === 0}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
