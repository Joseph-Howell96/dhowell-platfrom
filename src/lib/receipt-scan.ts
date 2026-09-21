"use server";

/**
 * Reading a receipt off its photograph.
 *
 * The picture goes to Claude, which reads it and hands back the date, what it
 * was for, the total and the VAT. Those fill the form in. Nothing is saved
 * from here - what comes back is a suggestion sitting in editable boxes, and
 * the person holding the receipt is the one who decides it is right.
 *
 * That distinction is the whole design. A machine reading a crumpled receipt
 * photographed in a lorry cab will sometimes read 3 as 8, and a figure that
 * arrives already saved is a figure nobody checks. A figure sitting in a box
 * waiting to be confirmed is a figure somebody looks at.
 *
 * Two things are deliberately not done here. The VAT is never worked out - it
 * is reported only where the receipt actually prints it, because food is
 * zero-rated, insurance is exempt and a small supplier may not be registered
 * at all; the form already offers the standard share from the total, which is
 * an honest guess rather than a misread fact. And nothing here can fail the
 * save: if the key is missing, the picture is a kind we cannot read, or the
 * whole thing falls over, the form works exactly as it did before and the
 * fields are typed by hand.
 */
import Anthropic from "@anthropic-ai/sdk";

import { isValidISODate } from "./calendar";
import { readSession } from "./session";

/** What a scan can tell the form, all of it optional. */
export type ScannedReceipt = {
  /** "YYYY-MM-DD", or "" where the date could not be read. */
  date: string;
  /** What it was for, in a few words. "" where nothing could be made out. */
  description: string;
  /** The total as printed, e.g. "84.20". "" where it could not be read. */
  amount: string;
  /** The VAT as printed. "" where the receipt does not show one. */
  vat: string;
};

export type ScanResult =
  | { ok: true; fields: ScannedReceipt }
  | { ok: false; reason: string };

/**
 * The kinds of picture Claude can look at.
 *
 * Not the same list the app will store. An iPad can hand over a HEIC, which
 * is a perfectly good photograph and simply not something the model reads - so
 * that one is kept and typed by hand rather than refused.
 */
const READABLE: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

const INSTRUCTIONS = `You are reading a photograph of a purchase receipt for a UK waste-management company, so that a person can check the figures rather than type them.

Report only what is actually printed on the receipt. Where something is not there, or cannot be made out, return an empty string for it. An empty field is a correct answer; a plausible guess is not.

date: the date printed on the receipt, as YYYY-MM-DD. Not today's date. If only a day and month are shown, use the year the receipt otherwise implies, and if that is unclear leave it empty.

description: a few words saying what was bought and where, in the order a person would say it - for example "Diesel, Shell Orpington" or "Tyre repair, ATS Euromaster". Keep it under sixty characters. No full stop.

amount: the grand total actually paid, including VAT, as digits with a decimal point and no currency symbol - for example "84.20". This is the figure at the bottom, not a subtotal and not one line of several.

vat: the VAT amount printed on the receipt, in the same form. Do not calculate it, ever: if the receipt does not print a VAT amount, return an empty string. A receipt showing only a VAT number or a rate percentage is not printing an amount.`;

/** The shape the answer has to come back in, so it can be used without hoping. */
const SCHEMA = {
  type: "object",
  properties: {
    date: { type: "string" },
    description: { type: "string" },
    amount: { type: "string" },
    vat: { type: "string" },
  },
  required: ["date", "description", "amount", "vat"],
  additionalProperties: false,
} as const;

/** Only digits and one decimal point, so a stray "£" or "GBP" cannot get in. */
function money(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/[^0-9.]/g, "");
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? cleaned : "";
}

function words(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 60) : "";
}

export async function scanReceipt(formData: FormData): Promise<ScanResult> {
  // Reading receipts is Finance, like everything else on this screen. Without
  // this, the address would be a way for anyone with an account to have the
  // company's API key read them a picture of their choosing.
  if ((await readSession())?.role !== "admin") {
    return { ok: false, reason: "Only an admin can do that." };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      ok: false,
      reason: "Reading receipts is not set up on this app yet.",
    };
  }

  const picture = formData
    .getAll("picture")
    .find((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!picture) return { ok: false, reason: "No picture to read." };

  const mediaType = READABLE[picture.type];
  if (!mediaType) {
    return {
      ok: false,
      reason:
        picture.type === "application/pdf"
          ? "PDFs are not read automatically. Type the details in."
          : "That kind of picture cannot be read automatically. Type the details in.",
    };
  }

  try {
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1000,
      // A receipt is a short, plain reading job, not a puzzle. Low effort
      // keeps it quick - somebody is standing there holding the receipt
      // waiting for the boxes to fill - and keeps the cost per receipt down.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: Buffer.from(await picture.arrayBuffer()).toString("base64"),
              },
            },
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "That picture could not be read. Type the details in." };
    }

    const text = response.content.find((block) => block.type === "text")?.text;
    if (!text) {
      return { ok: false, reason: "Nothing came back. Type the details in." };
    }

    const parsed: unknown = JSON.parse(text);
    const record = (typeof parsed === "object" && parsed !== null ? parsed : {}) as
      Record<string, unknown>;

    const date = typeof record.date === "string" ? record.date.trim() : "";
    return {
      ok: true,
      fields: {
        // A date that is not a real date is worse than none: it would sit in
        // the box looking filled in and be refused on save.
        date: isValidISODate(date) ? date : "",
        description: words(record.description),
        amount: money(record.amount),
        vat: money(record.vat),
      },
    };
  } catch (error) {
    // Never fatal. The form still works; this was only ever a shortcut.
    console.error("Could not read the receipt", error);
    return { ok: false, reason: whyNot(error) };
  }
}

/**
 * Why it could not be read, in words that say what to do about it.
 *
 * "Could not read it" was true and useless. These three go wrong in
 * completely different ways and are fixed in completely different places -
 * one is a key, one is a card, one is a slow photograph - and a person
 * standing in a yard holding a receipt cannot tell them apart from a
 * server log they have no way to open.
 */
function whyNot(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  const said = error instanceof Error ? error.message : String(error);

  if (status === 401 || status === 403) {
    return "The key for reading receipts was refused. Check ANTHROPIC_API_KEY.";
  }
  if (status === 400 && /credit|balance|billing/i.test(said)) {
    return "The account for reading receipts has run out of credit.";
  }
  if (status === 429) {
    return "Too many at once. Wait a moment and take it again.";
  }
  if (status === 402 || /credit|balance|billing/i.test(said)) {
    return "The account for reading receipts has run out of credit.";
  }
  if (/timeout|timed out|aborted/i.test(said)) {
    return "It took too long to read. Try again, or type the details in.";
  }
  return "Could not read it. Type the details in.";
}
