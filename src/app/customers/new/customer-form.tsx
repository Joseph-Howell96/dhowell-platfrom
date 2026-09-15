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

import { createCustomer } from "@/lib/actions";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { BASES, DIRECTION_LABELS, DIRECTIONS, MATERIALS } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-300";
const labelClass = "block text-sm font-medium mb-1.5";
const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

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
      {state.formError ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {state.formError}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Business details</h2>

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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Contact</h2>
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

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Rates</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            One line per material. The last column is the important one: it
            records whether the money comes to us or goes to the customer.
          </p>
        </div>

        <datalist id={materialListId}>
          {MATERIALS.map((material) => (
            <option key={material} value={material} />
          ))}
        </datalist>

        <div className="space-y-4">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-3 rounded-md border border-gray-200 p-4 sm:grid-cols-[1.4fr_1fr_0.8fr_1.4fr_auto] sm:items-start dark:border-gray-800"
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
                <label className={labelClass} htmlFor={`rateBasis-${row.key}`}>
                  Basis
                </label>
                <select
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
                </select>
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
                <select
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
                </select>
              </div>

              <div className="sm:pt-7">
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setRows((current) => [
              ...current,
              blankRow(nextRowSequence.current++),
            ])
          }
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Add another rate line
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Terms and notes</h2>
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

      <div className="flex items-center gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          {pending ? "Saving…" : "Save customer"}
        </button>
        <Link
          href="/customers"
          className="rounded-md px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
