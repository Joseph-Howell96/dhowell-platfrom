"use client";

/**
 * The form for adding an outlet. Every field is held by React rather than the
 * browser, for the same reason as the client form: React empties a form once
 * it has been submitted, and anything it does not hold would be lost whenever
 * a submission came back with something to correct.
 */
import Link from "next/link";
import { useActionState, useId, useRef, useState } from "react";

import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { createOutlet } from "@/lib/outlet-actions";
import { MATERIALS } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";
const cardClass = "space-y-4 rounded-xl border border-line bg-surface p-6";

type MaterialRow = { key: string; material: string; income: string };

function blankRow(sequence: number): MaterialRow {
  return { key: `row-${sequence}`, material: "", income: "" };
}

export default function OutletForm() {
  const [state, formAction, pending] = useActionState(
    createOutlet,
    EMPTY_FORM_STATE,
  );
  const [details, setDetails] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [rows, setRows] = useState<MaterialRow[]>([blankRow(0)]);
  const nextRowSequence = useRef(1);
  const materialListId = useId();

  function updateDetail(field: keyof typeof details, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  function updateRow(key: string, changes: Partial<MaterialRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );
  }

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
        <h2 className="text-base font-semibold">Outlet</h2>
        <div>
          <label className={labelClass} htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            className={inputClass}
            placeholder="e.g. Edwards"
            value={details.name}
            onChange={(event) => updateDetail("name", event.target.value)}
          />
          {state.fieldErrors.name ? (
            <p className={errorClass}>{state.fieldErrors.name}</p>
          ) : null}
        </div>
        <div>
          <label className={labelClass} htmlFor="address">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            rows={3}
            className={inputClass}
            placeholder="Where we deliver to"
            value={details.address}
            onChange={(event) => updateDetail("address", event.target.value)}
          />
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
              value={details.email}
              onChange={(event) => updateDetail("email", event.target.value)}
            />
            {state.fieldErrors.email ? (
              <p className={errorClass}>{state.fieldErrors.email}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className="text-base font-semibold">Material income</h2>
          <p className="mt-1 text-sm text-muted">
            What this outlet pays us per tonne. A job sent here earns its
            material&rsquo;s rate.
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
              className="grid gap-3 rounded-lg border border-line bg-elevated/40 p-4 sm:grid-cols-[1.6fr_1fr_auto] sm:items-start"
            >
              <div>
                <label
                  className={labelClass}
                  htmlFor={`materialName-${row.key}`}
                >
                  Material
                </label>
                <input
                  id={`materialName-${row.key}`}
                  name="materialName"
                  list={materialListId}
                  className={inputClass}
                  placeholder="e.g. Mixed paper"
                  value={row.material}
                  onChange={(event) =>
                    updateRow(row.key, { material: event.target.value })
                  }
                />
                {state.fieldErrors[`materialName-${index}`] ? (
                  <p className={errorClass}>
                    {state.fieldErrors[`materialName-${index}`]}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  className={labelClass}
                  htmlFor={`materialIncome-${row.key}`}
                >
                  Income (£ per tonne)
                </label>
                <input
                  id={`materialIncome-${row.key}`}
                  name="materialIncome"
                  inputMode="decimal"
                  className={inputClass}
                  placeholder="240.00"
                  value={row.income}
                  onChange={(event) =>
                    updateRow(row.key, { income: event.target.value })
                  }
                />
                {state.fieldErrors[`materialIncome-${index}`] ? (
                  <p className={errorClass}>
                    {state.fieldErrors[`materialIncome-${index}`]}
                  </p>
                ) : null}
              </div>
              <div className="sm:pt-7">
                <button
                  type="button"
                  onClick={() =>
                    setRows((current) =>
                      current.filter((entry) => entry.key !== row.key),
                    )
                  }
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
          Add another material
        </button>
      </section>

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Notes</h2>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className={inputClass}
          placeholder="Opening hours, tipping arrangements, anything worth knowing"
          value={details.notes}
          onChange={(event) => updateDetail("notes", event.target.value)}
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save outlet"}
        </button>
        <Link
          href="/outlets"
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
