"use client";

/**
 * The company details form. Unlike the others it stays put after saving, so it
 * says so rather than moving you somewhere else.
 */
import { useActionState, useState } from "react";

import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { saveCompanySettings } from "@/lib/settings-actions";
import type { CompanySettings } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";
const cardClass = "space-y-4 glass-solid rounded-xl p-6";

/**
 * One labelled box.
 *
 * Deliberately outside the form component below. A component declared inside
 * another is a different component every time the page redraws, so React pulls
 * the old one out and puts a new one in - and the cursor jumps out of the box
 * after every single letter typed.
 */
function Field({
  name,
  label,
  value,
  onChange,
  error,
  placeholder,
  hint,
  wide,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label className={labelClass} htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={inputClass}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      {error ? <p className={errorClass}>{error}</p> : null}
    </div>
  );
}

export default function SettingsForm({
  settings,
}: {
  settings: CompanySettings;
}) {
  const [state, formAction, pending] = useActionState(
    saveCompanySettings,
    EMPTY_FORM_STATE,
  );

  // Every field is held here rather than by the browser, for the same reason
  // as everywhere else: React empties a form once it has been submitted.
  const [values, setValues] = useState({
    ...settings,
    paymentTermsDays: String(settings.paymentTermsDays),
    vatPercent: String(settings.vatPercent),
    invoiceNumberStart: String(settings.invoiceNumberStart),
  });

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
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
      {state.success ? (
        <p
          role="status"
          className="rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent"
        >
          {state.success}
        </p>
      ) : null}

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Company</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="companyName"
            label="Company name"
            value={values.companyName}
            onChange={(value) => update("companyName", value)}
            error={state.fieldErrors.companyName}
            placeholder="D Howell &amp; Sons Ltd"
            wide
          />
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="address">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              rows={4}
              className={inputClass}
              placeholder={"Unit 1, Example Way\nLondon\nE1 1AA"}
              value={values.address}
              onChange={(event) => update("address", event.target.value)}
            />
          </div>
          <Field
            name="phone"
            label="Phone"
            value={values.phone}
            onChange={(value) => update("phone", value)}
            error={state.fieldErrors.phone}
            placeholder="020 7946 0000"
          />
          <Field
            name="email"
            label="Email"
            value={values.email}
            onChange={(value) => update("email", value)}
            error={state.fieldErrors.email}
            placeholder="accounts@dhowell.co.uk"
          />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Registration</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="vatNumber"
            label="VAT number"
            value={values.vatNumber}
            onChange={(value) => update("vatNumber", value)}
            error={state.fieldErrors.vatNumber}
            placeholder="GB 123 4567 89"
          />
          <Field
            name="companyNumber"
            label="Company registration number"
            value={values.companyNumber}
            onChange={(value) => update("companyNumber", value)}
            error={state.fieldErrors.companyNumber}
            placeholder="12345678"
          />
        </div>
      </section>

      <section className={cardClass}>
        <div>
          <h2 className="text-base font-semibold">Bank details</h2>
          <p className="mt-1 text-sm text-muted">
            Where clients send payment. Worth checking twice.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="bankAccountName"
            label="Account name"
            value={values.bankAccountName}
            onChange={(value) => update("bankAccountName", value)}
            error={state.fieldErrors.bankAccountName}
            placeholder="D Howell &amp; Sons Ltd"
            wide
          />
          <Field
            name="bankAccountNumber"
            label="Account number"
            value={values.bankAccountNumber}
            onChange={(value) => update("bankAccountNumber", value)}
            error={state.fieldErrors.bankAccountNumber}
            placeholder="12345678"
            hint="Eight digits."
          />
          <Field
            name="bankSortCode"
            label="Sort code"
            value={values.bankSortCode}
            onChange={(value) => update("bankSortCode", value)}
            error={state.fieldErrors.bankSortCode}
            placeholder="12-34-56"
            hint="Six digits. Dashes optional."
          />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Invoicing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="vatPercent"
            label="VAT rate (%)"
            value={values.vatPercent}
            onChange={(value) => update("vatPercent", value)}
            error={state.fieldErrors.vatPercent}
            placeholder="20"
            hint="Charged on the whole invoice."
          />
          <div />
          <Field
            name="invoiceNumberPrefix"
            label="Invoice number prefix"
            value={values.invoiceNumberPrefix}
            onChange={(value) => update("invoiceNumberPrefix", value)}
            error={state.fieldErrors.invoiceNumberPrefix}
            placeholder="INV-"
          />
          <Field
            name="invoiceNumberStart"
            label="Start numbering at"
            value={values.invoiceNumberStart}
            onChange={(value) => update("invoiceNumberStart", value)}
            error={state.fieldErrors.invoiceNumberStart}
            placeholder="1001"
            hint="Set this to carry on an existing series. Ignored once invoices exist."
          />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-base font-semibold">Payment terms</h2>
        <div>
          <label className={labelClass} htmlFor="paymentTermsDays">
            Days to pay
          </label>
          <input
            id="paymentTermsDays"
            name="paymentTermsDays"
            inputMode="numeric"
            className={`${inputClass} sm:max-w-[12rem]`}
            value={values.paymentTermsDays}
            onChange={(event) => update("paymentTermsDays", event.target.value)}
          />
          <p className="mt-1.5 text-xs text-muted">
            Ordinary days from the invoice date, the same for every client.
            Changing this moves the due date on every invoice that has not been
            paid, and on every one already sent.
          </p>
          {state.fieldErrors.paymentTermsDays ? (
            <p className={errorClass}>{state.fieldErrors.paymentTermsDays}</p>
          ) : null}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
