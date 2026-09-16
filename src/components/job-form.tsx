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
import { useActionState, useId, useState } from "react";

import Select from "@/components/select";
import { formatDateGB } from "@/lib/dates";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";
import {
  isWeighedOrLater,
  JOB_MATERIALS,
  JOB_STATUSES,
  SKIP_SIZES,
  STATUS_CLASSES,
  STATUS_HINTS,
  STATUS_LABELS,
  type Customer,
  type Job,
  type JobStatus,
} from "@/lib/types";
import { kgToInputValue } from "@/lib/weight";
import { invoiceDueDate, PAYMENT_WORKING_DAYS } from "@/lib/working-days";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";
const cardClass = "space-y-4 rounded-xl border border-line bg-surface p-6";

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
  /** Today's date, worked out on the server so both sides agree on it. */
  today: string;
};

export default function JobForm({
  customers,
  action,
  submitLabel,
  cancelHref,
  job,
  defaultDate,
  today,
}: Props) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const skipListId = useId();

  // A material that is not one of the listed ones must have been typed into
  // the "Other" box, so the form reopens in that state when you come back.
  const savedMaterialIsListed =
    job !== undefined &&
    (JOB_MATERIALS as readonly string[]).includes(job.material);

  const [customerId, setCustomerId] = useState(job?.customerId ?? "");
  const [siteAddress, setSiteAddress] = useState(job?.siteAddress ?? "");
  const [date, setDate] = useState(job?.date ?? defaultDate ?? "");
  const [skipSize, setSkipSize] = useState(job?.skipSize ?? "");
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
  const [invoiceSentDate, setInvoiceSentDate] = useState(
    job?.invoiceSentDate ?? "",
  );

  /**
   * Moving a job to "invoice sent" fills today's date in, since that is nearly
   * always the answer. It can still be changed for an invoice sent earlier.
   */
  function chooseStatus(next: JobStatus) {
    setStatus(next);
    if (next === "invoice-sent" && invoiceSentDate === "") {
      setInvoiceSentDate(today);
    }
  }

  /** Picking a client fills in their site address, saving retyping it. */
  function chooseCustomer(id: string) {
    setCustomerId(id);
    const chosen = customers.find((customer) => customer.id === id);
    // Only fill a blank box, so an address already typed is never overwritten.
    if (chosen && siteAddress.trim() === "") {
      setSiteAddress(chosen.siteAddress);
    }
  }

  return (
    <form action={formAction} noValidate className="space-y-6">
      {job ? <input type="hidden" name="jobId" value={job.id} /> : null}

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
            <label className={labelClass} htmlFor="skipSize">
              Skip size
            </label>
            <input
              id="skipSize"
              name="skipSize"
              list={skipListId}
              className={inputClass}
              placeholder="e.g. 8 yard"
              value={skipSize}
              onChange={(event) => setSkipSize(event.target.value)}
            />
            <datalist id={skipListId}>
              {SKIP_SIZES.map((size) => (
                <option key={size} value={size} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={labelClass} htmlFor="material">
              Material
            </label>
            <Select
              id="material"
              name="material"
              className={inputClass}
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
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
                  onChange={(event) => setOtherMaterial(event.target.value)}
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
          <h2 className="text-base font-semibold">Status</h2>
          <p className="mt-1 text-sm text-muted">
            Where the job has got to. This sets its colour on the calendar.
          </p>
        </div>

        {/* A hidden field carries the choice, so the buttons below are just a
            nicer way of picking one of four values. */}
        <input type="hidden" name="status" value={status} />
        <div className="grid gap-2 sm:grid-cols-4">
          {JOB_STATUSES.map((option) => {
            const chosen = status === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => chooseStatus(option)}
                aria-pressed={chosen}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  chosen
                    ? `border-transparent ${STATUS_CLASSES[option]}`
                    : "border-line text-muted hover:border-muted hover:text-ink"
                }`}
              >
                <span className="block text-sm font-semibold">
                  {STATUS_LABELS[option]}
                </span>
                <span className="mt-0.5 block text-xs opacity-80">
                  {STATUS_HINTS[option]}
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
          </div>
        ) : null}

        {status === "invoice-sent" ? (
          <div className="border-t border-line pt-4">
            <label className={labelClass} htmlFor="invoiceSentDate">
              Date invoice sent
            </label>
            <input
              id="invoiceSentDate"
              name="invoiceSentDate"
              type="date"
              className={`${inputClass} sm:max-w-[14rem]`}
              value={invoiceSentDate}
              onChange={(event) => setInvoiceSentDate(event.target.value)}
            />
            {/* Worked out as you change the date, so there is no waiting to
                find out when payment is due. */}
            <p className="mt-1.5 text-xs text-muted">
              {invoiceSentDate
                ? `Due ${formatDateGB(invoiceDueDate(invoiceSentDate))} — ${PAYMENT_WORKING_DAYS} working days later, skipping weekends and bank holidays.`
                : `Payment falls due ${PAYMENT_WORKING_DAYS} working days after this date.`}
            </p>
            {state.fieldErrors.invoiceSentDate ? (
              <p className={errorClass}>{state.fieldErrors.invoiceSentDate}</p>
            ) : null}
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
