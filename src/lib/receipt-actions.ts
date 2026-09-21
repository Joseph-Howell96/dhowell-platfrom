"use server";

/**
 * Keeping a receipt, and throwing one away.
 *
 * The picture arrives as a file on the form, which is checked here the same
 * way every other field is: what the browser sends can be anything, and this
 * is the one field where "anything" means arbitrary bytes written to our disk.
 */
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { isValidISODate, todayISO } from "./calendar";
import type { FormState } from "./form-state";
import { parsePoundsToPence } from "./money";
import {
  deleteReceiptFile,
  LARGEST_RECEIPT,
  receiptFileName,
  RECEIPT_TYPES,
  saveReceiptFile,
} from "./receipt-files";
import { addReceipt, deleteReceipt, readReceipt } from "./receipts";
import { readSession } from "./session";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

/** Receipts live under Finance, and Finance is not everybody's. */
async function isAdmin(): Promise<boolean> {
  return (await readSession())?.role === "admin";
}

export async function createReceipt(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) {
    return {
      fieldErrors: {},
      formError: "Only an admin can keep receipts.",
    };
  }

  const fieldErrors: Record<string, string> = {};

  const date = text(formData, "date") || todayISO();
  if (!isValidISODate(date)) {
    fieldErrors.date = "That is not a real date.";
  }

  const description = text(formData, "description");
  if (description === "") {
    fieldErrors.description = "Say what it was for, e.g. Diesel, Shell Orpington.";
  }

  // Optional, but worth having: a receipt whose amount nobody typed is a
  // picture, not a record.
  let amountPence: number | null = null;
  const amountInput = text(formData, "amount");
  if (amountInput !== "") {
    amountPence = parsePoundsToPence(amountInput);
    if (amountPence === null) {
      fieldErrors.amount = "Enter an amount, e.g. 84.20, or leave it blank.";
    }
  }

  let vatPence: number | null = null;
  const vatInput = text(formData, "vat");
  if (vatInput !== "") {
    vatPence = parsePoundsToPence(vatInput);
    if (vatPence === null) {
      fieldErrors.vat = "Enter the VAT, e.g. 14.03, or leave it blank.";
    } else if (amountPence !== null && vatPence > amountPence) {
      // The VAT is inside the total, not on top of it, so it cannot be the
      // larger of the two. Usually it means the net was typed by mistake.
      fieldErrors.vat = "The VAT cannot be more than the total.";
    }
  }

  const picture = formData.get("picture");
  let bytes: Uint8Array | null = null;
  let extension = "";
  let contentType = "";

  if (!(picture instanceof File) || picture.size === 0) {
    fieldErrors.picture = "Take a photo of the receipt, or choose a file.";
  } else if (picture.size > LARGEST_RECEIPT) {
    fieldErrors.picture = `That file is ${(picture.size / 1024 / 1024).toFixed(1)} MB. The limit is ${LARGEST_RECEIPT / 1024 / 1024} MB.`;
  } else {
    contentType = picture.type;
    extension = RECEIPT_TYPES[contentType] ?? "";
    if (extension === "") {
      fieldErrors.picture =
        "That is not a photo or a PDF. Use the camera, or pick a JPEG, PNG or PDF.";
    } else {
      bytes = new Uint8Array(await picture.arrayBuffer());
    }
  }

  if (Object.keys(fieldErrors).length > 0 || bytes === null) {
    return { fieldErrors, formError: null };
  }

  // The picture is written before the record that points at it, so a failure
  // between the two leaves an unreferenced file rather than a receipt whose
  // photograph is missing.
  const id = randomUUID();
  const fileName = receiptFileName(id, extension);
  try {
    await saveReceiptFile(fileName, bytes);
    await addReceipt({
      id,
      date,
      description,
      amountPence,
      vatPence,
      notes: text(formData, "notes"),
      fileName,
      contentType,
    });
  } catch (error) {
    console.error("Could not keep the receipt", error);
    return {
      fieldErrors: {},
      formError: "Could not save the receipt. Please try again.",
    };
  }

  revalidatePath("/finance/receipts");
  return { fieldErrors: {}, formError: null, success: "Receipt saved." };
}

/** Returns a reason when it will not go ahead, or null when it has. */
export async function removeReceipt(receiptId: string): Promise<string | null> {
  if (!(await isAdmin())) return "Only an admin can remove a receipt.";

  const receipt = await readReceipt(receiptId);
  if (!receipt) return "That receipt is already gone.";

  try {
    // The record first this time: a receipt nobody can see is better than a
    // row pointing at a photograph that is not there.
    await deleteReceipt(receiptId);
    await deleteReceiptFile(receipt.fileName);
  } catch (error) {
    console.error("Could not remove the receipt", error);
    return "Could not remove the receipt. Please try again.";
  }

  revalidatePath("/finance/receipts");
  return null;
}
