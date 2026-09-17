/**
 * The company's own details, kept in data/settings.json.
 *
 * One record rather than a list: there is only one D Howell & Sons. Anything
 * not filled in yet comes back blank rather than missing, so the rest of the
 * app never has to check whether settings exist.
 */
import { readJsonRecord, writeJsonRecord } from "./store";
import type { CompanySettings } from "./types";

const FILE = "settings.json";

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

function wholeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback;
}

export async function readSettings(): Promise<CompanySettings> {
  const record = await readJsonRecord(FILE);
  if (!record) return DEFAULT_SETTINGS;

  const text = (key: keyof CompanySettings) =>
    typeof record[key] === "string" ? (record[key] as string) : "";

  return {
    companyName: text("companyName"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    vatNumber: text("vatNumber"),
    companyNumber: text("companyNumber"),
    bankAccountName: text("bankAccountName"),
    bankAccountNumber: text("bankAccountNumber"),
    bankSortCode: text("bankSortCode"),
    paymentTermsDays: wholeNumber(record.paymentTermsDays, DEFAULT_SETTINGS.paymentTermsDays),
    vatPercent:
      typeof record.vatPercent === "number" &&
      Number.isFinite(record.vatPercent) &&
      record.vatPercent >= 0
        ? record.vatPercent
        : DEFAULT_SETTINGS.vatPercent,
    invoiceNumberPrefix:
      typeof record.invoiceNumberPrefix === "string"
        ? record.invoiceNumberPrefix
        : DEFAULT_SETTINGS.invoiceNumberPrefix,
    invoiceNumberStart: wholeNumber(
      record.invoiceNumberStart,
      DEFAULT_SETTINGS.invoiceNumberStart,
    ),
  };
}

export async function saveSettings(settings: CompanySettings): Promise<void> {
  await writeJsonRecord(FILE, { ...settings });
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
