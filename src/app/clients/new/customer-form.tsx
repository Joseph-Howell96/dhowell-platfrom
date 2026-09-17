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
import { useActionState, useId, useRef, useState } from "react";

import Select from "@/components/select";
import { createCustomer } from "@/lib/actions";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import {
  BASES,
  DIRECTION_HINTS,
  DIRECTION_LABELS,
  DIRECTIONS,
  MATERIALS,
  SKIP_SIZES,
} from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";
/** Each group of fields sits on its own card, as on the clients list. */
const cardClass = "space-y-4 rounded-xl border border-line bg-surface p-6";

/** Everything about the customer apart from their rates. */
type Details = {
  businessName: string;
  siteAddress: string;
  billingAddress: string;
  contactName: string;
  phone: string;
  email: string;
  paymentTermsDays: string;
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
  notes: "",
};

/** One row of the rates table, as it exists in the browser before saving. */
type RateRow = {
  key: string;
  material: string;
  skipSize: string;
  basis: string;
  rate: string;
  direction: string;
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
    skipSize: "",
    basis: BASES[0],
    rate: "",
    direction: "charge",
  };
}

export default function CustomerForm() {
  const [state, formAction, pending] = useActionState(
    createCustomer,
    EMPTY_FORM_STATE,
  );
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [rows, setRows] = useState<RateRow[]>([blankRow(0)]);
  const nextRowSequence = useRef(1);
  const materialListId = useId();
  const skipListId = useId();

  function updateDetail(field: keyof Details, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  function updateRow(key: string, changes: Partial<RateRow>) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...changes };
        // Haulage is what we charge to send the lorry. It is never paid to a
        // client, so choosing it settles the direction too.
        if (next.basis === "Haulage fee") next.direction = "charge";
        return next;
      }),
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
            One line per material and skip size. A material can have two: what
            the material itself is worth, and a haulage fee for coming to
            collect it. Leave the size blank and the rate applies whatever
            turns up. &ldquo;{DIRECTION_LABELS.charge}
            &rdquo; means {DIRECTION_HINTS.charge.toLowerCase()};
            &ldquo;{DIRECTION_LABELS.pay}&rdquo; means{" "}
            {DIRECTION_HINTS.pay.toLowerCase()}.
          </p>
        </div>

        <datalist id={materialListId}>
          {MATERIALS.map((material) => (
            <option key={material} value={material} />
          ))}
        </datalist>
        <datalist id={skipListId}>
          {SKIP_SIZES.map((size) => (
            <option key={size} value={size} />
          ))}
        </datalist>

        <div className="space-y-4">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-3 rounded-lg border border-line bg-elevated/40 p-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.8fr_0.9fr_0.6fr_1.4fr_auto] lg:items-start"
            >
              <div>
                <label
                  className={labelClass}
                  htmlFor={`rateMaterial-${row.key}`}
                >
                  Material
                </label>
                <input
                  id={`rateMaterial-${row.key}`}
                  name="rateMaterial"
                  list={materialListId}
                  className={inputClass}
                  placeholder="e.g. Wood"
                  value={row.material}
                  onChange={(event) =>
                    updateRow(row.key, { material: event.target.value })
                  }
                />
                {state.fieldErrors[`rateMaterial-${index}`] ? (
                  <p className={errorClass}>
                    {state.fieldErrors[`rateMaterial-${index}`]}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  className={labelClass}
                  htmlFor={`rateSkipSize-${row.key}`}
                >
                  Skip size
                </label>
                <input
                  id={`rateSkipSize-${row.key}`}
                  name="rateSkipSize"
                  list={skipListId}
                  className={inputClass}
                  placeholder="Any size"
                  value={row.skipSize}
                  onChange={(event) =>
                    updateRow(row.key, { skipSize: event.target.value })
                  }
                />
              </div>

              <div>
                <label className={labelClass} htmlFor={`rateBasis-${row.key}`}>
                  Basis
                </label>
                <Select
                  id={`rateBasis-${row.key}`}
                  name="rateBasis"
                  className={inputClass}
                  value={row.basis}
                  onChange={(event) =>
                    updateRow(row.key, { basis: event.target.value })
                  }
                >
                  {BASES.map((basis) => (
                    <option key={basis} value={basis}>
                      {basis}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className={labelClass} htmlFor={`rateAmount-${row.key}`}>
                  Rate (£)
                </label>
                <input
                  id={`rateAmount-${row.key}`}
                  name="rateAmount"
                  inputMode="decimal"
                  className={inputClass}
                  placeholder="85.50"
                  value={row.rate}
                  onChange={(event) =>
                    updateRow(row.key, { rate: event.target.value })
                  }
                />
                {state.fieldErrors[`rateAmount-${index}`] ? (
                  <p className={errorClass}>
                    {state.fieldErrors[`rateAmount-${index}`]}
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
                {/* A disabled field is not sent with the form, and these rows
                    are read back by position, so one missing value would shift
                    every later row onto the wrong direction. The fixed case
                    sends a hidden field instead. */}
                {row.basis === "Haulage fee" ? (
                  <>
                    <input type="hidden" name="rateDirection" value="charge" />
                    <p
                      className={`${inputClass} text-muted`}
                      title="Haulage is what we charge to send the lorry, so it is never rebated."
                    >
                      {DIRECTION_LABELS.charge}
                    </p>
                  </>
                ) : (
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
                )}
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
          {pending ? "Saving…" : "Save client"}
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
