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

import { addCustomer, updateCustomer } from "./customers";
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

type ParsedCustomer = {
  businessName: string;
  siteAddress: string;
  billingAddress: string;
  contactName: string;
  phone: string;
  email: string;
  paymentTermsDays: number;
  notes: string;
  rateLines: RateLine[];
};

/**
 * Read a client out of the form, collecting anything wrong as it goes.
 * Shared by adding one and by changing one, so the two cannot drift apart.
 */
function parseCustomer(
  formData: FormData,
):
  | { errors: Record<string, string>; customer: null }
  | { errors: null; customer: ParsedCustomer } {
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
    return { errors: fieldErrors, customer: null };
  }

  return {
    errors: null,
    customer: {
      businessName,
      siteAddress: text(formData, "siteAddress"),
      billingAddress: text(formData, "billingAddress"),
      contactName: text(formData, "contactName"),
      phone: text(formData, "phone"),
      email,
      paymentTermsDays,
      notes: text(formData, "notes"),
      rateLines,
    },
  };
}

/** Everything that shows a client or prices off their rates. */
function refreshClientPages() {
  revalidatePath("/clients");
  revalidatePath("/calendar");
  revalidatePath("/finance");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function createCustomer(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseCustomer(formData);
  if (parsed.errors) {
    return {
      fieldErrors: parsed.errors,
      formError: "Some details need fixing before this can be saved.",
    };
  }

  try {
    await addCustomer(parsed.customer);
  } catch (error) {
    console.error("Could not save the customer", error);
    return {
      fieldErrors: {},
      formError: "Could not save the customer. Please try again.",
    };
  }

  refreshClientPages();
  redirect("/clients");
}

export async function saveCustomer(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const clientId = text(formData, "clientId");
  if (clientId === "") {
    return { fieldErrors: {}, formError: "Could not tell which client this is." };
  }

  const parsed = parseCustomer(formData);
  if (parsed.errors) {
    return {
      fieldErrors: parsed.errors,
      formError: "Some details need fixing before this can be saved.",
    };
  }

  let updated;
  try {
    updated = await updateCustomer(clientId, parsed.customer);
  } catch (error) {
    console.error("Could not save the customer", error);
    return {
      fieldErrors: {},
      formError: "Could not save the customer. Please try again.",
    };
  }

  if (!updated) {
    return {
      fieldErrors: {},
      formError: "That client no longer exists.",
    };
  }

  refreshClientPages();
  redirect("/clients");
}

/**
 * Put a client away, or bring them back.
 *
 * Archiving never deletes: their jobs and invoices still name them, and a
 * record that vanished would leave those pointing at nothing.
 */
export async function setCustomerArchived(
  clientId: string,
  archived: boolean,
): Promise<void> {
  await updateCustomer(clientId, {
    archivedAt: archived ? new Date().toISOString() : null,
  });
  refreshClientPages();
}
