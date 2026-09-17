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
  readInvoices,
  updateInvoice,
} from "./invoices";
import { isBillable } from "./invoicing";
import { readJobs, updateJob } from "./jobs";
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
  const [jobs, invoices] = await Promise.all([readJobs(), readInvoices()]);
  const alreadyBilled = invoicedJobIds(invoices);
  const billable = new Set(
    jobs
      .filter(
        (job) =>
          job.customerId === customerId &&
          job.status !== "booked" &&
          !alreadyBilled.has(job.id) &&
          isBillable(job, customers.find((c) => c.id === customerId)),
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
      number: nextInvoiceNumber(invoices, settings.invoiceNumberStart),
      customerId,
      issueDate,
      customerPO: text(formData, "customerPO"),
      jobIds,
      status: "draft",
      paidDate: null,
      pdfSavedAt: null,
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
  redirect(`/invoices/${invoice.id}`);
}

/**
 * Move an invoice on. Sending it also moves every job it covers to "invoice
 * sent", so the calendar and the invoice never disagree.
 */
export async function setInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
): Promise<void> {
  if (!INVOICE_STATUSES.includes(status)) return;

  const invoices = await readInvoices();
  const invoice = invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) return;

  const today = todayISO();
  await updateInvoice(invoiceId, {
    status,
    paidDate: status === "paid" ? (invoice.paidDate ?? today) : null,
  });

  if (status !== "draft") {
    const jobs = await readJobs();
    for (const jobId of invoice.jobIds) {
      const job = jobs.find((entry) => entry.id === jobId);
      if (!job) continue;
      await updateJob(jobId, {
        ...job,
        status: "invoice-sent",
        invoiceSentDate: invoice.issueDate,
      });
    }
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/finance");
  revalidatePath("/calendar");
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

  const [jobs, invoices, customers, settings] = await Promise.all([
    readJobs(),
    readInvoices(),
    readCustomers(),
    readSettings(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const alreadyBilled = invoicedJobIds(invoices);

  const thisWeek = jobs.filter(
    (job) =>
      job.date >= weekStartISO &&
      job.date <= weekEnd &&
      job.status !== "booked" &&
      !alreadyBilled.has(job.id) &&
      isBillable(job, clientsById.get(job.customerId)),
  );
  if (thisWeek.length === 0) return;

  const byClient = new Map<string, string[]>();
  for (const job of thisWeek) {
    byClient.set(job.customerId, [...(byClient.get(job.customerId) ?? []), job.id]);
  }

  // Numbered as they are written, so two clients in the same run do not both
  // take the same next number.
  let raised = invoices;
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
    });
    raised = [invoice, ...raised];
  }

  revalidatePath("/invoices");
  revalidatePath("/finance");
  revalidatePath("/calendar");
  redirect("/invoices");
}
