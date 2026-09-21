"use client";

/**
 * Taking a receipt. Mostly on an iPad, which decides how this is built.
 *
 * Two inputs rather than one, and that is the whole point. `capture` tells a
 * device to open its camera instead of its file browser, but iOS only honours
 * it when everything in `accept` is something a camera could actually produce.
 * One input accepting both pictures and PDFs therefore gets the full "Photo
 * Library / Take Photo / Browse" sheet on an iPad, every time, and the camera
 * is two taps away rather than none.
 *
 * So: one input that takes pictures only and asks for the camera, and a
 * quieter second one for a PDF or something already in the photo roll. Both
 * are called "picture", and the server takes whichever has anything in it.
 *
 * The camera needs a secure address on iOS. Over the tunnel that is https and
 * fine; straight to a laptop's http address on the office wi-fi it is not, and
 * the button falls back to the file browser with no explanation.
 *
 * The picture is shown back before saving. A receipt photographed at arm's
 * length in a lorry cab is often unreadable, and finding that out now is
 * better than finding out in six months when the accountant asks.
 */
import { useActionState, useEffect, useState, useTransition } from "react";

import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { parsePoundsToPence, penceToInputValue, vatWithin } from "@/lib/money";
import { createReceipt } from "@/lib/receipt-actions";
import { scanReceipt } from "@/lib/receipt-scan";

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
export default function ReceiptForm({
  today,
  vatPercent,
}: {
  today: string;
  /** The company's rate, from Settings, used to suggest the VAT. */
  vatPercent: number;
}) {
  const [state, formAction, pending] = useActionState(
    createReceipt,
    EMPTY_FORM_STATE,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string>("");
  // Both kept here so that typing a total can offer a VAT figure, while
  // leaving whoever is typing free to correct it. Most receipts carry the
  // standard rate; the ones that do not are exactly the ones where guessing
  // would be wrong.
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("");
  const [vatTouched, setVatTouched] = useState(false);
  // Controlled from here on, because reading the photograph fills them in.
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");

  // What reading the picture is doing, and what it found. "read" is kept so
  // the form can say which boxes it filled - a figure somebody knows came off
  // a photograph is a figure they check, and one that simply appeared is not.
  const [reading, startReading] = useTransition();
  const [readNote, setReadNote] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());

  // A preview made from the file itself. Revoked when it is replaced, or the
  // browser holds on to every photograph taken this session.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  /** The same handler for both inputs: whichever was used, show it back. */
  function took(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setChosen(file ? file.name : "");
    setPreview(
      file && file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    );
    setReadNote(null);
    setRead(new Set());
    if (file) look(file);
  }

  /**
   * Have a look at the picture and fill in what can be made out.
   *
   * Everything it finds lands in an ordinary editable box. Nothing is saved,
   * nothing is locked, and a box it could not fill is simply left alone - a
   * blank waiting to be typed is honest, and a confident wrong figure is not.
   * A field already typed by hand is never overwritten.
   */
  function look(file: File) {
    startReading(async () => {
      const carrying = new FormData();
      carrying.append("picture", file);
      const result = await scanReceipt(carrying);

      if (!result.ok) {
        setReadNote(result.reason);
        return;
      }

      const filled = new Set<string>();
      const { fields } = result;

      if (fields.date) {
        setDate(fields.date);
        filled.add("date");
      }
      if (fields.description && description.trim() === "") {
        setDescription(fields.description);
        filled.add("description");
      }
      if (fields.amount && amount.trim() === "") {
        setAmount(fields.amount);
        filled.add("amount");
        // The receipt's own VAT where it prints one; otherwise the standard
        // share of the total, as before, which is a suggestion and says so.
        if (!vatTouched) {
          if (fields.vat) {
            setVat(fields.vat);
            filled.add("vat");
          } else {
            const pence = parsePoundsToPence(fields.amount);
            setVat(pence === null ? "" : penceToInputValue(vatWithin(pence, vatPercent)));
          }
        }
      } else if (fields.vat && !vatTouched && vat.trim() === "") {
        setVat(fields.vat);
        filled.add("vat");
      }

      setRead(filled);
      setReadNote(
        filled.size === 0
          ? "Nothing could be made out. Type the details in."
          : null,
      );
    });
  }

  /**
   * A box is no longer "read from the photo" once a person has typed in it.
   * Small, but the note under a field is a claim about where the figure came
   * from, and a wrong one is worse than none - it tells somebody a number has
   * been checked against the paper when it has not.
   */
  function typedIn(...fields: string[]) {
    setRead((current) => {
      if (!fields.some((field) => current.has(field))) return current;
      const left = new Set(current);
      for (const field of fields) left.delete(field);
      return left;
    });
  }

  /** Shown under a box the photograph filled, so it gets a second look. */
  function fromPhoto(field: string) {
    return read.has(field) ? (
      <p className="mt-1 text-xs text-muted">Read from the photo — check it</p>
    ) : null;
  }

  return (
    <form action={formAction} noValidate className="glass rounded-xl p-6">
      <h2 className="text-lg font-semibold">Keep a receipt</h2>
      <p className="mt-1 mb-4 text-base text-muted">
        On an iPad or a phone the first button opens the camera. On a computer
        both ask for a file.
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
        {/* A plain heading, not a label: the buttons below are the labels for
            their inputs, and a third one means a screen reader announces the
            control twice. */}
        <p className={labelClass}>The receipt</p>

        <div className="flex flex-wrap items-center gap-3">
          {/* The label is the button. A bare file input cannot be styled and
              reads "No file chosen", which tells nobody anything. Sized for a
              thumb rather than a mouse: this is used standing up. */}
          <label
            htmlFor="picture"
            className="inline-block cursor-pointer rounded-lg bg-accent px-6 py-4 text-lg font-semibold text-canvas transition-colors hover:bg-accent-hover"
          >
            Take a photo
          </label>
          {/* Pictures only, and nothing else in the list: an iPad opens its
              camera for this and would not for a list that also mentioned
              PDFs. */}
          <input
            id="picture"
            name="picture"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={took}
          />

          <label
            htmlFor="pictureFile"
            className="inline-block cursor-pointer rounded-lg border-2 border-line px-6 py-4 text-lg font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Choose a file
          </label>
          {/* No capture here, and PDFs allowed: this is the one for something
              already in the photo roll, or a supplier's e-mailed invoice. */}
          <input
            id="pictureFile"
            name="picture"
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={took}
          />
        </div>

        {chosen ? (
          <p className="mt-2 text-base text-muted">{chosen}</p>
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

        {/* Said out loud, because otherwise boxes fill themselves in a second
            or two after the photograph and it is not obvious why. */}
        {reading ? (
          <p role="status" className="mt-3 text-sm text-muted">
            Reading the receipt…
          </p>
        ) : null}
        {readNote && !reading ? (
          <p role="status" className="mt-3 text-sm text-muted">
            {readNote}
          </p>
        ) : null}
        {read.size > 0 && !reading ? (
          <p role="status" className="mt-3 text-sm text-muted">
            Filled in from the photo. Check the figures before saving — a
            crumpled receipt can be misread.
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_9rem_9rem]">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className={labelClass} htmlFor="description">
            What was it for?
          </label>
          <input
            id="description"
            name="description"
            className={inputClass}
            placeholder="Diesel, Shell Orpington"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              typedIn("description");
            }}
          />
          {fromPhoto("description")}
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
            value={amount}
            onChange={(event) => {
              const typed = event.target.value;
              setAmount(typed);
              // The VAT as well: a new total makes the figure beneath it a
              // calculation again, whatever the photograph originally said.
              typedIn("amount", ...(vatTouched ? [] : ["vat"]));
              // Only until somebody says otherwise. After that the figure is
              // theirs and typing the total again does not overwrite it.
              if (vatTouched) return;
              const pence = parsePoundsToPence(typed);
              setVat(
                pence === null
                  ? ""
                  : penceToInputValue(vatWithin(pence, vatPercent)),
              );
            }}
          />
          {fromPhoto("amount")}
          {state.fieldErrors.amount ? (
            <p className={errorClass}>{state.fieldErrors.amount}</p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="vat">
            VAT (£) <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="vat"
            name="vat"
            inputMode="decimal"
            className={inputClass}
            placeholder="14.03"
            value={vat}
            onChange={(event) => {
              setVatTouched(true);
              setVat(event.target.value);
              typedIn("vat");
            }}
          />
          {fromPhoto("vat")}
          {state.fieldErrors.vat ? (
            <p className={errorClass}>{state.fieldErrors.vat}</p>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-sm text-muted">
        The VAT is filled in at {vatPercent}% of the total, the way it reads on
        the receipt. Change it if the receipt says otherwise, or clear it for
        anything zero-rated or from a supplier who is not registered.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[12rem_1fr]">
        <div>
          <label className={labelClass} htmlFor="date">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              typedIn("date");
            }}
            className={inputClass}
          />
          {fromPhoto("date")}
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
