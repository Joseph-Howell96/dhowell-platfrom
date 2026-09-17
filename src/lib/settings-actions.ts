"use server";

/**
 * Saving the company settings. As with every other form, what the browser
 * sends is checked again here.
 */
import { revalidatePath } from "next/cache";

import type { FormState } from "./form-state";
import { saveSettings } from "./settings";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

/** Sort codes are six digits. Stored as 12-34-56 however they were typed. */
function normaliseSortCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

export async function saveCompanySettings(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const fieldErrors: Record<string, string> = {};

  const email = text(formData, "email");
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That does not look like an email address.";
  }

  // Getting either of these wrong means not being paid, so they are checked
  // properly rather than taken on trust.
  const accountNumberInput = text(formData, "bankAccountNumber");
  let bankAccountNumber = "";
  if (accountNumberInput !== "") {
    const digits = accountNumberInput.replace(/[\s-]/g, "");
    if (!/^\d{8}$/.test(digits)) {
      fieldErrors.bankAccountNumber = "An account number is eight digits.";
    } else {
      bankAccountNumber = digits;
    }
  }

  const sortCodeInput = text(formData, "bankSortCode");
  let bankSortCode = "";
  if (sortCodeInput !== "") {
    const normalised = normaliseSortCode(sortCodeInput);
    if (normalised === null) {
      fieldErrors.bankSortCode = "A sort code is six digits, e.g. 12-34-56.";
    } else {
      bankSortCode = normalised;
    }
  }

  const termsInput = text(formData, "paymentTermsDays");
  let paymentTermsDays = 14;
  if (termsInput === "") {
    fieldErrors.paymentTermsDays = "Enter how many days clients have to pay.";
  } else if (!/^\d+$/.test(termsInput)) {
    fieldErrors.paymentTermsDays = "Enter a whole number of days, e.g. 14.";
  } else {
    paymentTermsDays = Number(termsInput);
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      formError: "Some details need fixing before this can be saved.",
    };
  }

  try {
    await saveSettings({
      companyName: text(formData, "companyName"),
      address: text(formData, "address"),
      phone: text(formData, "phone"),
      email,
      vatNumber: text(formData, "vatNumber"),
      companyNumber: text(formData, "companyNumber"),
      bankAccountName: text(formData, "bankAccountName"),
      bankAccountNumber,
      bankSortCode,
      paymentTermsDays,
    });
  } catch (error) {
    console.error("Could not save the settings", error);
    return {
      fieldErrors: {},
      formError: "Could not save. Please try again.",
    };
  }

  // Due dates are worked out from the payment terms, so anything showing one
  // has to be built again.
  revalidatePath("/settings");
  revalidatePath("/finance");
  revalidatePath("/calendar");

  // No redirect: you stay on the page, which is why this says so out loud.
  return { fieldErrors: {}, formError: null, success: "Settings saved." };
}
