/**
 * The company's own details.
 *
 * One record rather than a list: there is only one D Howell & Sons. The table
 * has a constraint saying so, so there is no way for a second one to appear.
 * Anything not filled in yet comes back blank rather than missing, so the rest
 * of the app never has to check whether settings exist.
 */
import { db } from "./db";
import type { CompanySettings } from "./types";

/** What a brand new installation starts with. */
export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: "",
  address: "",
  phone: "",
  email: "",
  vatNumber: "",
  companyNumber: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankSortCode: "",
  paymentTermsDays: 14,
  vatPercent: 20,
  invoiceNumberPrefix: "INV-",
  invoiceNumberStart: 1001,
};

/** The one row, as the database holds it. */
type Row = {
  company_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  vat_number: string | null;
  company_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
  payment_terms_days: number | null;
  vat_percent: number | string | null;
  invoice_number_prefix: string | null;
  invoice_number_start: number | null;
};

function wholeNumber(value: unknown, fallback: number): number {
  const asNumber = typeof value === "string" ? Number(value) : value;
  return typeof asNumber === "number" &&
    Number.isFinite(asNumber) &&
    asNumber >= 0
    ? Math.round(asNumber)
    : fallback;
}

export async function readSettings(): Promise<CompanySettings> {
  // maybeSingle rather than single: the row is put there by the schema, but a
  // database somebody has only half set up should show empty settings and a
  // prompt to fill them in, not an error page.
  const { data, error } = await db()
    .from("settings")
    .select("*")
    .maybeSingle<Row>();
  if (error) throw new Error(`Reading the company settings failed: ${error.message}`);
  if (!data) return DEFAULT_SETTINGS;

  const text = (value: string | null) => value ?? "";
  // Postgres hands `numeric` back as a string, so that a figure with more
  // digits than JavaScript can hold does not quietly lose some on the way.
  const percent =
    typeof data.vat_percent === "string"
      ? Number(data.vat_percent)
      : data.vat_percent;

  return {
    companyName: text(data.company_name),
    address: text(data.address),
    phone: text(data.phone),
    email: text(data.email),
    vatNumber: text(data.vat_number),
    companyNumber: text(data.company_number),
    bankAccountName: text(data.bank_account_name),
    bankAccountNumber: text(data.bank_account_number),
    bankSortCode: text(data.bank_sort_code),
    paymentTermsDays: wholeNumber(
      data.payment_terms_days,
      DEFAULT_SETTINGS.paymentTermsDays,
    ),
    vatPercent:
      typeof percent === "number" && Number.isFinite(percent) && percent >= 0
        ? percent
        : DEFAULT_SETTINGS.vatPercent,
    invoiceNumberPrefix:
      data.invoice_number_prefix ?? DEFAULT_SETTINGS.invoiceNumberPrefix,
    invoiceNumberStart: wholeNumber(
      data.invoice_number_start,
      DEFAULT_SETTINGS.invoiceNumberStart,
    ),
  };
}

export async function saveSettings(settings: CompanySettings): Promise<void> {
  // Upsert on the fixed id, so this works whether or not the schema's own row
  // is there - and cannot make a second one, because the id is always true.
  const { error } = await db()
    .from("settings")
    .upsert({
      id: true,
      company_name: settings.companyName,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      vat_number: settings.vatNumber,
      company_number: settings.companyNumber,
      bank_account_name: settings.bankAccountName,
      bank_account_number: settings.bankAccountNumber,
      bank_sort_code: settings.bankSortCode,
      payment_terms_days: settings.paymentTermsDays,
      vat_percent: settings.vatPercent,
      invoice_number_prefix: settings.invoiceNumberPrefix,
      invoice_number_start: settings.invoiceNumberStart,
    });
  if (error) throw new Error(`Saving the company settings failed: ${error.message}`);
}

/**
 * What is still missing before an invoice would look right. Used to warn on
 * the settings page rather than to block saving: half-filled settings are
 * better than none, and people fill these in over a few sittings.
 */
export function missingForInvoice(settings: CompanySettings): string[] {
  const missing: string[] = [];
  if (settings.companyName.trim() === "") missing.push("company name");
  if (settings.address.trim() === "") missing.push("address");
  if (settings.bankAccountNumber.trim() === "") missing.push("account number");
  if (settings.bankSortCode.trim() === "") missing.push("sort code");
  return missing;
}
