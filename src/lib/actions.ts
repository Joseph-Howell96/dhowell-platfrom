"use server";

/**
 * The code that runs on the server when the "Add customer" form is submitted.
 *
 * "use server" at the top of the file is what makes that happen: the browser
 * sends the form to the server, this runs there, and only the result comes back.
 * The form can never be trusted, so everything is checked again here even though
 * the browser checks it too.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addCustomer } from "./customers";
import type { FormState } from "./form-state";
import { parsePoundsToPence } from "./money";
import { randomUUID } from "node:crypto";
import { DIRECTIONS, type Direction, type RateLine } from "./types";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  // Browsers send the Enter key inside a text box as two characters rather
  // than one. Store the tidier single character so the saved file stays clean.
  return value.replace(/\r\n/g, "\n").trim();
}

export async function createCustomer(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const fieldErrors: Record<string, string> = {};

  const businessName = text(formData, "businessName");
  if (businessName === "") {
    fieldErrors.businessName = "Enter the business name.";
  }

  const email = text(formData, "email");
  // Deliberately loose: something, an @, something, a dot, something. Being
  // strict about email addresses rejects real ones.
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That does not look like an email address.";
  }

  const paymentTermsRaw = text(formData, "paymentTermsDays");
  let paymentTermsDays = 30;
  if (paymentTermsRaw !== "") {
    if (!/^\d+$/.test(paymentTermsRaw)) {
      fieldErrors.paymentTermsDays = "Enter a whole number of days, e.g. 30.";
    } else {
      paymentTermsDays = Number(paymentTermsRaw);
    }
  }

  // Rate lines arrive as lists that line up by position: the first material
  // goes with the first size, the first pair of rates and the first direction.
  const materials = formData.getAll("rateMaterial");
  const sizes = formData.getAll("rateSkipSize");
  const tonnageRates = formData.getAll("ratePerTonne");
  const haulageRates = formData.getAll("rateHaulage");
  const directions = formData.getAll("rateDirection");

  const rateLines: RateLine[] = [];
  for (let index = 0; index < materials.length; index += 1) {
    const material = String(materials[index] ?? "").trim();
    const tonnageInput = String(tonnageRates[index] ?? "").trim();
    const haulageInput = String(haulageRates[index] ?? "").trim();

    // A row where nothing was filled in is someone who added a row and
    // changed their mind. Ignore it rather than complaining.
    if (material === "" && tonnageInput === "" && haulageInput === "") continue;

    if (material === "") {
      fieldErrors[`rateMaterial-${index}`] = "Choose or type a material.";
    }

    let ratePerTonnePence: number | null = null;
    if (tonnageInput !== "") {
      ratePerTonnePence = parsePoundsToPence(tonnageInput);
      if (ratePerTonnePence === null) {
        fieldErrors[`ratePerTonne-${index}`] = "Enter a rate, e.g. 42.00.";
      }
    }

    let haulageRatePence: number | null = null;
    if (haulageInput !== "") {
      haulageRatePence = parsePoundsToPence(haulageInput);
      if (haulageRatePence === null) {
        fieldErrors[`rateHaulage-${index}`] = "Enter a rate, e.g. 95.00.";
      }
    }

    // A row naming a material but pricing nothing does no work.
    if (
      material !== "" &&
      tonnageInput === "" &&
      haulageInput === ""
    ) {
      fieldErrors[`ratePerTonne-${index}`] =
        "Enter a tonnage rate, a haulage rate, or both.";
    }

    const direction = String(directions[index] ?? "");
    if (!DIRECTIONS.includes(direction as Direction)) {
      fieldErrors[`rateDirection-${index}`] = "Choose which way the money goes.";
    }

    if (
      material !== "" &&
      (ratePerTonnePence !== null || haulageRatePence !== null) &&
      DIRECTIONS.includes(direction as Direction)
    ) {
      rateLines.push({
        id: randomUUID(),
        material,
        skipSize: String(sizes[index] ?? "").trim(),
        ratePerTonnePence,
        haulageRatePence,
        // Only the tonnage rate has a direction; haulage is always charged.
        direction: direction as Direction,
      });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      formError: "Some details need fixing before this can be saved.",
    };
  }

  try {
    await addCustomer({
      businessName,
      siteAddress: text(formData, "siteAddress"),
      billingAddress: text(formData, "billingAddress"),
      contactName: text(formData, "contactName"),
      phone: text(formData, "phone"),
      email,
      paymentTermsDays,
      notes: text(formData, "notes"),
      rateLines,
    });
  } catch (error) {
    console.error("Could not save the customer", error);
    return {
      fieldErrors: {},
      formError: "Could not save the customer. Please try again.",
    };
  }

  // Throw away the cached copy of the list page so it rebuilds with the new
  // customer, then send the browser there.
  revalidatePath("/clients");
  redirect("/clients");
}
