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

  /** A whole number that has to be there. */
  function wholeNumber(name: string, missing: string, wrong: string, fallback: number) {
    const raw = text(formData, name);
    if (raw === "") {
      fieldErrors[name] = missing;
      return fallback;
    }
    if (!/^\d+$/.test(raw)) {
      fieldErrors[name] = wrong;
      return fallback;
    }
    return Number(raw);
  }

  const paymentTermsDays = wholeNumber(
    "paymentTermsDays",
    "Enter how many days clients have to pay.",
    "Enter a whole number of days, e.g. 14.",
    14,
  );

  const vatInput = text(formData, "vatPercent");
  let vatPercent = 20;
  if (vatInput === "") {
    fieldErrors.vatPercent = "Enter the VAT rate, e.g. 20.";
  } else if (!/^\d+(\.\d{1,2})?$/.test(vatInput)) {
    fieldErrors.vatPercent = "Enter a percentage, e.g. 20.";
  } else {
    vatPercent = Number(vatInput);
  }

  const invoiceNumberStart = wholeNumber(
    "invoiceNumberStart",
    "Enter the number to start invoices at.",
    "Enter a whole number, e.g. 1001.",
    1001,
  );

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
      vatPercent,
      invoiceNumberPrefix: text(formData, "invoiceNumberPrefix"),
      invoiceNumberStart,
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
  revalidatePath("/invoices");
  // The payment terms decide what is overdue, which the dashboard counts.
  revalidatePath("/dashboard");

  // No redirect: you stay on the page, which is why this says so out loud.
  return { fieldErrors: {}, formError: null, success: "Settings saved." };
}
