"use client";

/**
 * "use client" means this runs in the browser as well as on the server, which
 * it has to: rows of rates appear and disappear as you click, and that needs
 * to happen instantly without asking the server.
 *
 * Every field below is "controlled", meaning React holds what you typed rather
 * than the browser. That matters because React clears a form once it has been
 * submitted, so anything not held here would vanish the moment a submission
 * came back with a correction to make.
 */
import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import Select from "@/components/select";
import type { FormState } from "@/lib/form-state";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { penceToInputValue } from "@/lib/money";
import {
  DIRECTION_HINTS,
  DIRECTION_LABELS,
  DIRECTIONS,
  MATERIALS,
  OTHER_MATERIAL,
  type Customer,
} from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";
/** Each group of fields sits on its own card, as on the clients list. */
const cardClass = "space-y-4 glass-solid rounded-xl p-6";

/** Everything about the customer apart from their rates. */
type Details = {
  businessName: string;
  siteAddress: string;
  billingAddress: string;
  contactName: string;
  phone: string;
  email: string;
  paymentTermsDays: string;
  haulageFee: string;
  notes: string;
};

const EMPTY_DETAILS: Details = {
  businessName: "",
  siteAddress: "",
  billingAddress: "",
  contactName: "",
  phone: "",
  email: "",
  paymentTermsDays: "30",
  haulageFee: "",
  notes: "",
};

/** Is this one of the materials on the list, or something typed by hand? */
function isListed(material: string): boolean {
  return (MATERIALS as readonly string[]).includes(material);
}

/**
 * The material a row stands for: the one chosen, or the one typed under
 * "Other". This is what is sent, so the server never has to know that the
 * box on screen had an extra option in it.
 */
function materialOf(row: RateRow): string {
  return row.material === OTHER_MATERIAL ? row.otherMaterial.trim() : row.material;
}

/** One row of the rates table, as it exists in the browser before saving. */
type RateRow = {
  key: string;
  /** The choice made in the box: a listed material, or "Other". */
  material: string;
  /** What was typed when the choice was "Other". Ignored otherwise. */
  otherMaterial: string;
  /** What a tonne of it is worth. */
  perTonne: string;
  /** Applies to the tonnage rate only. */
  direction: string;
  onwardPerTonne: string;
};

/**
 * Each row needs a key React can tell it apart by. It is counted rather than
 * random on purpose: the page is built once on the server and again in the
 * browser, and random keys would not match between the two.
 */
function blankRow(sequence: number): RateRow {
  return {
    key: `row-${sequence}`,
    material: "",
    otherMaterial: "",
    perTonne: "",
    direction: "charge",
    onwardPerTonne: "",
  };
}

export default function CustomerForm({
  action,
  submitLabel,
  customer,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  /** The client being changed, or nothing when adding a new one. */
  customer?: Customer;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [details, setDetails] = useState<Details>(
    customer
      ? {
          businessName: customer.businessName,
          siteAddress: customer.siteAddress,
          billingAddress: customer.billingAddress,
          contactName: customer.contactName,
          phone: customer.phone,
          email: customer.email,
          paymentTermsDays: String(customer.paymentTermsDays),
          haulageFee: penceToInputValue(customer.haulageFeePence),
          notes: customer.notes,
        }
      : EMPTY_DETAILS,
  );
  const [rows, setRows] = useState<RateRow[]>(
    customer && customer.rateLines.length > 0
      ? customer.rateLines.map((line, index) => ({
          key: `row-${index}`,
          material: isListed(line.material) ? line.material : OTHER_MATERIAL,
          otherMaterial: isListed(line.material) ? "" : line.material,
          perTonne:
            line.ratePerTonnePence === null
              ? ""
              : penceToInputValue(line.ratePerTonnePence),
          direction: line.direction,
          onwardPerTonne:
            line.onwardRatePerTonnePence === null
              ? ""
              : penceToInputValue(line.onwardRatePerTonnePence),
        }))
      : [blankRow(0)],
  );
  const nextRowSequence = useRef(
    customer && customer.rateLines.length > 0 ? customer.rateLines.length : 1,
  );

  function updateDetail(field: keyof Details, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  function updateRow(key: string, changes: Partial<RateRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  // noValidate turns off the browser's own pop-up warnings so that every
  // problem is reported the same way: in red, under the field it belongs to.
  // The server checks everything regardless, which is what actually counts.
  return (
    <form action={formAction} noValidate className="space-y-8">
      {customer ? <input type="hidden" name="clientId" value={customer.id} /> : null}

      {state.formError ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {state.formError}
        </p>
      ) : null}

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Business details</h2>

        <div>
          <label className={labelClass} htmlFor="businessName">
            Business name
          </label>
          <input
            id="businessName"
            name="businessName"
            className={inputClass}
            autoComplete="organization"
            value={details.businessName}
            onChange={(event) =>
              updateDetail("businessName", event.target.value)
            }
            aria-describedby={
              state.fieldErrors.businessName ? "businessName-error" : undefined
            }
          />
          {state.fieldErrors.businessName ? (
            <p id="businessName-error" className={errorClass}>
              {state.fieldErrors.businessName}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="siteAddress">
              Site address
            </label>
            <textarea
              id="siteAddress"
              name="siteAddress"
              rows={3}
              className={inputClass}
              placeholder="Where we collect from"
              value={details.siteAddress}
              onChange={(event) =>
                updateDetail("siteAddress", event.target.value)
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="billingAddress">
              Billing address
            </label>
            <textarea
              id="billingAddress"
              name="billingAddress"
              rows={3}
              className={inputClass}
              placeholder="Where the invoice goes"
              value={details.billingAddress}
              onChange={(event) =>
                updateDetail("billingAddress", event.target.value)
              }
            />
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="contactName">
              Contact name
            </label>
            <input
              id="contactName"
              name="contactName"
              className={inputClass}
              autoComplete="name"
              value={details.contactName}
              onChange={(event) =>
                updateDetail("contactName", event.target.value)
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className={inputClass}
              autoComplete="tel"
              value={details.phone}
              onChange={(event) => updateDetail("phone", event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={inputClass}
              autoComplete="email"
              value={details.email}
              onChange={(event) => updateDetail("email", event.target.value)}
              aria-describedby={
                state.fieldErrors.email ? "email-error" : undefined
              }
            />
            {state.fieldErrors.email ? (
              <p id="email-error" className={errorClass}>
                {state.fieldErrors.email}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className="text-base font-semibold">Rates</h2>
          <p className="mt-1 text-sm text-muted">
            One line per material, holding both figures: what a tonne of it is
            worth to the client, and what the other side of the trade costs us.
            Either can be left empty. &ldquo;{DIRECTION_LABELS.charge}
            &rdquo; means {DIRECTION_HINTS.charge.toLowerCase()};
            &ldquo;{DIRECTION_LABELS.pay}&rdquo; means{" "}
            {DIRECTION_HINTS.pay.toLowerCase()}.
          </p>
        </div>

        <div className="space-y-4">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-3 rounded-lg border border-line bg-elevated/40 p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.2fr_1fr_auto] lg:items-start"
            >
              <div>
                <label
                  className={labelClass}
                  htmlFor={`rateMaterial-${row.key}`}
                >
                  Material
                </label>
                {/* What is actually sent. The boxes below are for choosing;
                    this is the answer they add up to, and it is always here,
                    on every row, whether or not the "Other" box is showing.
                    That matters: the server pairs these lists up by position,
                    so a row that sometimes sends a field and sometimes does
                    not would put every rate after it against the wrong
                    material. */}
                <input
                  type="hidden"
                  name="rateMaterial"
                  value={materialOf(row)}
                />
                <Select
                  id={`rateMaterial-${row.key}`}
                  className={inputClass}
                  value={row.material}
                  onChange={(event) =>
                    updateRow(row.key, { material: event.target.value })
                  }
                >
                  <option value="">Choose a material…</option>
                  {MATERIALS.map((material) => (
                    <option key={material} value={material}>
                      {material}
                    </option>
                  ))}
                  <option value={OTHER_MATERIAL}>
                    {OTHER_MATERIAL} — type it
                  </option>
                </Select>
                {state.fieldErrors[`rateMaterial-${index}`] ? (
                  <p className={errorClass}>
                    {state.fieldErrors[`rateMaterial-${index}`]}
                  </p>
                ) : null}

                {row.material === OTHER_MATERIAL ? (
                  <div className="mt-3">
                    <label
                      className={labelClass}
                      htmlFor={`rateOtherMaterial-${row.key}`}
                    >
                      Which material?
                    </label>
                    <input
                      id={`rateOtherMaterial-${row.key}`}
                      className={inputClass}
                      placeholder="e.g. Plasterboard"
                      value={row.otherMaterial}
                      onChange={(event) =>
                        updateRow(row.key, { otherMaterial: event.target.value })
                      }
                    />
                  </div>
                ) : null}
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor={`ratePerTonne-${row.key}`}
                >
                  Rate per tonne (£)
                </label>
                <input
                  id={`ratePerTonne-${row.key}`}
                  name="ratePerTonne"
                  inputMode="decimal"
                  className={inputClass}
                  placeholder="42.00"
                  value={row.perTonne}
                  onChange={(event) =>
                    updateRow(row.key, { perTonne: event.target.value })
                  }
                />
                {state.fieldErrors[`ratePerTonne-${index}`] ? (
                  <p className={errorClass}>
                    {state.fieldErrors[`ratePerTonne-${index}`]}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor={`rateDirection-${row.key}`}
                >
                  Direction
                </label>
                <Select
                  id={`rateDirection-${row.key}`}
                  name="rateDirection"
                  className={inputClass}
                  value={row.direction}
                  onChange={(event) =>
                    updateRow(row.key, { direction: event.target.value })
                  }
                >
                  {DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {DIRECTION_LABELS[direction]}
                    </option>
                  ))}
                </Select>
                {state.fieldErrors[`rateDirection-${index}`] ? (
                  <p className={errorClass}>
                    {state.fieldErrors[`rateDirection-${index}`]}
                  </p>
                ) : null}
              </div>

              <div>
                {/* The same field either way round, named for what it is in
                    each: the tip's price on a charge, the mill's on a rebate.
                    Optional - left blank, the figure is typed on the job as
                    it always was. */}
                <label
                  className={labelClass}
                  htmlFor={`onwardRatePerTonne-${row.key}`}
                >
                  {row.direction === "pay"
                    ? "We sell it on for (£/t)"
                    : "Tip charges us (£/t)"}
                </label>
                <input
                  id={`onwardRatePerTonne-${row.key}`}
                  name="onwardRatePerTonne"
                  inputMode="decimal"
                  className={inputClass}
                  placeholder="optional"
                  value={row.onwardPerTonne}
                  onChange={(event) =>
                    updateRow(row.key, { onwardPerTonne: event.target.value })
                  }
                />
                {state.fieldErrors[`onwardRatePerTonne-${index}`] ? (
                  <p className={errorClass}>
                    {state.fieldErrors[`onwardRatePerTonne-${index}`]}
                  </p>
                ) : null}
              </div>

              <div className="lg:pt-7">
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-danger/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            // Counted out here, not inside the update below. React may run a
            // state update more than once to check it is repeatable, and a
            // counter ticking over inside one would skip numbers.
            const sequence = nextRowSequence.current;
            nextRowSequence.current += 1;
            setRows((current) => [...current, blankRow(sequence)]);
          }}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          Add another rate line
        </button>
      </section>

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Terms and notes</h2>

        {/* Required. Every collection for this client carries it, so there is
            nowhere else it could be filled in later. */}
        <div>
          <label className={labelClass} htmlFor="haulageFee">
            Haulage fee (£)
          </label>
          <input
            id="haulageFee"
            name="haulageFee"
            inputMode="decimal"
            className={`${inputClass} sm:max-w-[12rem]`}
            placeholder="85.00"
            value={details.haulageFee}
            onChange={(event) => updateDetail("haulageFee", event.target.value)}
            aria-describedby={
              state.fieldErrors.haulageFee ? "haulageFee-error" : undefined
            }
          />
          <p className="mt-1.5 text-xs text-muted">
            Charged once for every collection, on top of the material. Ten
            collections in a day is ten haulage fees. Type 0 if this client is
            not charged for it.
          </p>
          {state.fieldErrors.haulageFee ? (
            <p id="haulageFee-error" className={errorClass}>
              {state.fieldErrors.haulageFee}
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="paymentTermsDays">
            Payment terms (days)
          </label>
          <input
            id="paymentTermsDays"
            name="paymentTermsDays"
            inputMode="numeric"
            className={`${inputClass} sm:max-w-[12rem]`}
            value={details.paymentTermsDays}
            onChange={(event) =>
              updateDetail("paymentTermsDays", event.target.value)
            }
            aria-describedby={
              state.fieldErrors.paymentTermsDays
                ? "paymentTermsDays-error"
                : undefined
            }
          />
          {state.fieldErrors.paymentTermsDays ? (
            <p id="paymentTermsDays-error" className={errorClass}>
              {state.fieldErrors.paymentTermsDays}
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            className={inputClass}
            placeholder="Access restrictions, site contact, anything worth knowing"
            value={details.notes}
            onChange={(event) => updateDetail("notes", event.target.value)}
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/clients"
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
