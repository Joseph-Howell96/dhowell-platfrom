"use server";

/**
 * Raising an invoice and moving it along. As everywhere else, what the browser
 * sends is checked again here.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidISODate, todayISO } from "./calendar";
import { addCalendarDays } from "./dates";
import { readCustomers } from "./customers";
import type { FormState } from "./form-state";
import {
  addInvoice,
  invoicedJobIds,
  nextInvoiceNumber,
  readAllInvoices,
  readInvoice,
  readInvoices,
  updateInvoice,
} from "./invoices";
import { isReadyToInvoice } from "./invoicing";
import { readJobs } from "./jobs";
import { readSettings } from "./settings";
import { INVOICE_STATUSES, type InvoiceStatus } from "./types";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

export async function createInvoice(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const fieldErrors: Record<string, string> = {};

  const customerId = text(formData, "customerId");
  const customers = await readCustomers();
  if (customerId === "") {
    fieldErrors.customerId = "Choose a client.";
  } else if (!customers.some((customer) => customer.id === customerId)) {
    fieldErrors.customerId = "That client no longer exists.";
  }

  const issueDate = text(formData, "issueDate");
  if (issueDate === "") {
    fieldErrors.issueDate = "Choose the invoice date.";
  } else if (!isValidISODate(issueDate)) {
    fieldErrors.issueDate = "That is not a real date.";
  }

  // Only jobs that belong to this client, are ready to bill, and are not
  // already on another invoice.
  const chosen = formData.getAll("jobId").map(String);
  const [jobs, invoices, everyInvoice] = await Promise.all([
    readJobs(),
    readInvoices(),
    readAllInvoices(),
  ]);
  const alreadyBilled = invoicedJobIds(invoices);
  const client = customers.find((c) => c.id === customerId);
  const billable = new Set(
    jobs
      .filter(
        (job) =>
          job.customerId === customerId &&
          isReadyToInvoice(job, client, alreadyBilled),
      )
      .map((job) => job.id),
  );
  const jobIds = chosen.filter((id) => billable.has(id));

  if (jobIds.length === 0) {
    fieldErrors.jobId = "Tick at least one job to bill.";
  } else if (jobIds.length !== chosen.length) {
    fieldErrors.jobId =
      "Some of those jobs cannot be billed any more. Check the list and try again.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      formError: "Some details need fixing before this can be raised.",
    };
  }

  const settings = await readSettings();
  let invoice;
  try {
    invoice = await addInvoice({
      number: nextInvoiceNumber(everyInvoice, settings.invoiceNumberStart),
      customerId,
      issueDate,
      customerPO: text(formData, "customerPO"),
      jobIds,
      status: "draft",
      paidDate: null,
      pdfSavedAt: null,
      deletedAt: null,
    });
  } catch (error) {
    console.error("Could not raise the invoice", error);
    return {
      fieldErrors: {},
      formError: "Could not raise the invoice. Please try again.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoice.id}`);
}

/**
 * Move an invoice on.
 *
 * Only the invoice changes. Where an invoice has got to is the invoice's own
 * business - the jobs it covers already read as invoiced because they are on
 * it, and nothing is copied onto them. Two records of the same fact is how
 * they end up disagreeing.
 */
export async function setInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
): Promise<void> {
  if (!INVOICE_STATUSES.includes(status)) return;

  const invoices = await readInvoices();
  const invoice = invoices.find((entry) => entry.id === invoiceId);
  // Only the ones that stand. A withdrawn invoice is not sent or paid; it is
  // restored first, or it is not touched.
  if (!invoice) return;

  const today = todayISO();
  await updateInvoice(invoiceId, {
    status,
    paidDate: status === "paid" ? (invoice.paidDate ?? today) : null,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/finance");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}


/**
 * Raise a week's invoices in one go.
 *
 * Every job in the week that is ready to bill and is not already on an invoice
 * is gathered up, split by client, and each client gets one draft invoice
 * covering all of theirs. Drafts, not sent: they are meant to be looked over.
 *
 * Running it twice does nothing the second time. A job that is already on an
 * invoice is skipped, which is what stops anything being billed twice - the
 * check is against what invoices actually hold, not a flag on the job that
 * could fall out of step.
 */
export async function generateWeekInvoices(weekStartISO: string): Promise<void> {
  if (!isValidISODate(weekStartISO)) return;
  const weekEnd = addCalendarDays(weekStartISO, 6);

  const [jobs, invoices, everyInvoice, customers, settings] = await Promise.all([
    readJobs(),
    readInvoices(),
    readAllInvoices(),
    readCustomers(),
    readSettings(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const alreadyBilled = invoicedJobIds(invoices);

  const thisWeek = jobs.filter(
    (job) =>
      job.date >= weekStartISO &&
      job.date <= weekEnd &&
      isReadyToInvoice(job, clientsById.get(job.customerId), alreadyBilled),
  );
  if (thisWeek.length === 0) return;

  const byClient = new Map<string, string[]>();
  for (const job of thisWeek) {
    byClient.set(job.customerId, [...(byClient.get(job.customerId) ?? []), job.id]);
  }

  // Numbered as they are written, so two clients in the same run do not both
  // take the same next number.
  // Numbered off every invoice there has ever been, withdrawn ones included.
  let raised = everyInvoice;
  const today = todayISO();
  for (const [customerId, jobIds] of byClient) {
    const invoice = await addInvoice({
      number: nextInvoiceNumber(raised, settings.invoiceNumberStart),
      customerId,
      issueDate: today,
      customerPO: "",
      jobIds,
      status: "draft",
      paidDate: null,
      pdfSavedAt: null,
      deletedAt: null,
    });
    raised = [invoice, ...raised];
  }

  revalidatePath("/invoices");
  revalidatePath("/finance");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect("/invoices");
}

/**
 * Withdraw an invoice.
 *
 * It is set aside rather than removed. An invoice number that went out and was
 * then withdrawn is something a bookkeeper has to be able to account for, and
 * a record that simply vanishes cannot be accounted for at all. It moves to
 * the deleted list in Finance, comes out of what is owed, and its number is
 * never given to another invoice.
 *
 * Its jobs are freed by this alone. Nothing is written on a job to say it has
 * been billed - a job is invoiced because an invoice names it - so as soon as
 * this invoice stops standing, its jobs go back to waiting.
 *
 * The filed PDF is kept. It is what was sent, and the whole point of setting
 * the invoice aside rather than deleting it is being able to look at it later.
 *
 * Returns a reason when it will not go ahead, or null when it has.
 */
export async function deleteInvoice(invoiceId: string): Promise<string | null> {
  if (invoiceId === "") return "Could not tell which invoice this is.";

  const invoice = await readInvoice(invoiceId);
  if (!invoice) return "That invoice no longer exists.";
  if (invoice.deletedAt !== null) return "That invoice has already been deleted.";

  try {
    await updateInvoice(invoiceId, { deletedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Could not delete the invoice", error);
    return "Could not delete the invoice. Please try again.";
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/finance");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect("/finance");
}

/**
 * Put a withdrawn invoice back.
 *
 * Refused where any of its jobs have been billed somewhere else in the
 * meantime, which is the whole risk of restoring: those jobs were freed when
 * this was withdrawn, and if one has since gone onto another invoice, bringing
 * this one back would have the client charged for it twice. Better to say so
 * than to quietly drop the line and change the total.
 *
 * Returns a reason when it will not go ahead, or null when it has.
 */
export async function restoreInvoice(invoiceId: string): Promise<string | null> {
  if (invoiceId === "") return "Could not tell which invoice this is.";

  const invoice = await readInvoice(invoiceId);
  if (!invoice) return "That invoice no longer exists.";
  if (invoice.deletedAt === null) return "That invoice has not been deleted.";

  const standing = await readInvoices();
  const spokenFor = invoicedJobIds(standing);
  const clash = invoice.jobIds.filter((id) => spokenFor.has(id));
  if (clash.length > 0) {
    const other = standing.find((entry) =>
      entry.jobIds.some((id) => clash.includes(id)),
    );
    return `${clash.length === 1 ? "A job" : `${clash.length} jobs`} on this invoice ${clash.length === 1 ? "has" : "have"} since been billed on invoice number ${other?.number ?? "another"}. Restoring this one would charge for the same work twice. Take ${clash.length === 1 ? "it" : "them"} off that invoice first.`;
  }

  try {
    await updateInvoice(invoiceId, { deletedAt: null });
  } catch (error) {
    console.error("Could not restore the invoice", error);
    return "Could not restore the invoice. Please try again.";
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/finance");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoiceId}`);
}
