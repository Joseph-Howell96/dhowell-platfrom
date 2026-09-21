"use client";

/**
 * Taking a receipt.
 *
 * The one thing worth knowing: `capture="environment"` on a file input is what
 * makes a phone open the back camera rather than the photo library. On a
 * laptop the same input is an ordinary "choose a file" button, which is the
 * right thing there - nobody photographs a receipt with a laptop.
 *
 * The picture is shown back before saving. A receipt photographed at arm's
 * length in a lorry cab is often unreadable, and finding that out now is
 * better than finding out in six months when the accountant asks.
 */
import { useActionState, useEffect, useState } from "react";

import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { createReceipt } from "@/lib/receipt-actions";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";

/**
 * Emptying the form after a save is done by the page, not by this: it keys
 * this component on how many receipts there are, so keeping one replaces the
 * form with a fresh one. The receipt appearing in the list below is the
 * confirmation, which is better than a line of text saying it worked.
 */
export default function ReceiptForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(
    createReceipt,
    EMPTY_FORM_STATE,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string>("");

  // A preview made from the file itself. Revoked when it is replaced, or the
  // browser holds on to every photograph taken this session.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <form action={formAction} noValidate className="glass rounded-xl p-6">
      <h2 className="text-lg font-semibold">Keep a receipt</h2>
      <p className="mt-1 mb-4 text-base text-muted">
        On a phone this opens the camera. On a computer it asks for a file.
      </p>

      {state.formError ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {state.formError}
        </p>
      ) : null}
      <div>
        {/* A plain heading, not a second label: the button below is the
            label for this input, and two of them means a screen reader
            announces the control twice. */}
        <p className={labelClass}>The receipt</p>
        {/* The label is the button. A bare file input cannot be styled and
            reads "No file chosen", which tells nobody anything. */}
        <label
          htmlFor="picture"
          className="inline-block cursor-pointer rounded-lg bg-accent px-5 py-3 text-base font-semibold text-canvas transition-colors hover:bg-accent-hover"
        >
          Take a photo
        </label>
        <input
          id="picture"
          name="picture"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setChosen(file ? file.name : "");
            setPreview(
              file && file.type.startsWith("image/")
                ? URL.createObjectURL(file)
                : null,
            );
          }}
        />
        {chosen ? (
          <span className="ml-3 text-base text-muted">{chosen}</span>
        ) : null}
        {state.fieldErrors.picture ? (
          <p className={errorClass}>{state.fieldErrors.picture}</p>
        ) : null}

        {preview ? (
          // A blob URL from the camera. next/image cannot optimise one of
          // those, and there is nothing to optimise: it never leaves the page.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="The receipt you just photographed"
            className="mt-4 max-h-72 rounded-lg border border-line"
          />
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_10rem]">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="description">
            What was it for?
          </label>
          <input
            id="description"
            name="description"
            className={inputClass}
            placeholder="Diesel, Shell Orpington"
          />
          {state.fieldErrors.description ? (
            <p className={errorClass}>{state.fieldErrors.description}</p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="amount">
            Amount (£){" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            className={inputClass}
            placeholder="84.20"
          />
          {state.fieldErrors.amount ? (
            <p className={errorClass}>{state.fieldErrors.amount}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[12rem_1fr]">
        <div>
          <label className={labelClass} htmlFor="date">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={today}
            className={inputClass}
          />
          {state.fieldErrors.date ? (
            <p className={errorClass}>{state.fieldErrors.date}</p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="notes">
            Notes <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="notes"
            name="notes"
            className={inputClass}
            placeholder="Anything worth remembering about it"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-lg bg-accent px-5 py-3 text-base font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save receipt"}
      </button>
    </form>
  );
}
