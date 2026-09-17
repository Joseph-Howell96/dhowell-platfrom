"use server";

/**
 * What runs on the server when a job is booked or changed. As with clients,
 * everything the browser sends is checked again here, because a form can be
 * sent by anything, not just the page we built.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidISODate, monthKeyOf } from "./calendar";
import { readCustomers } from "./customers";
import { readAllInvoices, updateInvoice } from "./invoices";
import { deleteSavedPdf, pdfFileName } from "./invoice-files";
import { readSettings } from "./settings";
import type { FormState } from "./form-state";
import { addJob, deleteJob, readJobs, updateJob } from "./jobs";
import {
  isWeighedOrLater,
  JOB_DIRECTIONS,
  JOB_STATUSES,
  STATUS_LABELS,
  type JobDirection,
  type JobStatus,
} from "./types";
import { parsePoundsToPence } from "./money";
import { parseTonnesToKg } from "./weight";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

type ParsedJob = {
  customerId: string;
  siteAddress: string;
  date: string;
  material: string;
  notes: string;
  status: JobStatus;
  weightKg: number | null;
  direction: JobDirection;
  chargeHaulage: boolean;
  haulageRateOverridePence: number | null;
  supplierPO: string | null;
  poRaisedDate: string | null;
  supplierInvoiceRef: string | null;
  paidDate: string | null;
  disposalCostPence: number | null;
  onwardSalePence: number | null;
  outletId: string | null;
  haulageCostPence: number | null;
};

/**
 * Pull a job out of the submitted form, collecting any problems as it goes.
 * Returns the problems, or the finished job when there are none.
 */
async function parseJob(
  formData: FormData,
): Promise<
  { errors: Record<string, string>; job: null } | { errors: null; job: ParsedJob }
> {
  const fieldErrors: Record<string, string> = {};

  // The client has to be one we actually hold, not just any text that arrives.
  const customerId = text(formData, "customerId");
  const customers = await readCustomers();
  if (customerId === "") {
    fieldErrors.customerId = "Choose a client.";
  } else if (!customers.some((customer) => customer.id === customerId)) {
    fieldErrors.customerId = "That client no longer exists.";
  }

  const date = text(formData, "date");
  if (date === "") {
    fieldErrors.date = "Choose a date.";
  } else if (!isValidISODate(date)) {
    fieldErrors.date = "That is not a real date.";
  }

  const siteAddress = text(formData, "siteAddress");
  if (siteAddress === "") {
    fieldErrors.siteAddress = "Enter where the job is.";
  }

  // "Other" means the material is whatever was typed in the box beside it.
  const chosenMaterial = text(formData, "material");
  const otherMaterial = text(formData, "otherMaterial");
  let material = chosenMaterial;
  if (chosenMaterial === "") {
    fieldErrors.material = "Choose a material.";
  } else if (chosenMaterial === "Other") {
    if (otherMaterial === "") {
      fieldErrors.otherMaterial = "Type which material this is.";
    } else {
      material = otherMaterial;
    }
  }

  const directionValue = text(formData, "direction") || "sale";
  const directionIsKnown = JOB_DIRECTIONS.includes(
    directionValue as JobDirection,
  );
  if (!directionIsKnown) {
    fieldErrors.direction = "Choose whether this is a sale or a purchase.";
  }
  const direction = directionValue as JobDirection;

  const statusValue = text(formData, "status") || "booked";
  // Three statuses, the same three whichever way the money goes.
  const statusIsKnown = JOB_STATUSES.includes(statusValue as JobStatus);
  if (!statusIsKnown) {
    fieldErrors.status = "Choose a status.";
  }
  const status = statusValue as JobStatus;

  // Once a job is weighed the weighbridge figure is the whole point of the
  // status, so it has to be there. Before that it is not asked for.
  //
  // This is also what enforces the rule that a job cannot be marked complete
  // without a weight: complete is one of these statuses, so the save is
  // refused here whatever the browser sent.
  let weightKg: number | null = null;
  if (statusIsKnown && isWeighedOrLater(status)) {
    const weightInput = text(formData, "weightTonnes");
    if (weightInput === "") {
      fieldErrors.weightTonnes =
        status === "booked"
          ? "Enter the weight in tonnes."
          : `Enter the weight in tonnes. A job cannot be marked ${STATUS_LABELS[status].toLowerCase()} without one.`;
    } else {
      weightKg = parseTonnesToKg(weightInput);
      if (weightKg === null) {
        fieldErrors.weightTonnes = "Enter a weight in tonnes, e.g. 2.45.";
      }
    }
  }

  /** A date box that may be left blank, but must be a real date if filled. */
  function optionalDate(name: string): string | null {
    const value = text(formData, name);
    if (value === "") return null;
    if (!isValidISODate(value)) {
      fieldErrors[name] = "That is not a real date.";
      return null;
    }
    return value;
  }

  // Purchase side. The order we raise to pay the client for their material,
  // asked for once a rebate job has been checked off. All of it is optional:
  // the order goes out when it goes out, and the job is done either way.
  let supplierPO: string | null = null;
  let poRaisedDate: string | null = null;
  let supplierInvoiceRef: string | null = null;
  let paidDate: string | null = null;

  if (statusIsKnown && direction === "purchase" && status === "complete") {
    supplierPO = text(formData, "supplierPO") || null;
    poRaisedDate = optionalDate("poRaisedDate");
    supplierInvoiceRef = text(formData, "supplierInvoiceRef") || null;
    paidDate = optionalDate("paidDate");
  }

  // What to charge for haulage on this job instead of the client's rate. Only
  // read when haulage is actually being charged, so an amount left behind by
  // unticking the box cannot quietly come back later.
  const chargingHaulage = text(formData, "chargeHaulage") === "on";

  /** An optional money box: blank is allowed, nonsense is not. */
  function optionalMoney(name: string): number | null {
    const raw = text(formData, name);
    if (raw === "") return null;
    const pence = parsePoundsToPence(raw);
    if (pence === null) {
      fieldErrors[name] = "Enter an amount in pounds, e.g. 120.00.";
      return null;
    }
    return pence;
  }

  const haulageRateOverridePence = chargingHaulage
    ? optionalMoney("haulageRateOverride")
    : null;

  // Only asked for once a job has been weighed, and only on the side it
  // belongs to: what a load cost us to dispose of, or what it sold on for.
  const disposalCostPence =
    statusIsKnown && direction === "sale" && isWeighedOrLater(status)
      ? optionalMoney("disposalCost")
      : null;
  const onwardSalePence =
    statusIsKnown && direction === "purchase" && isWeighedOrLater(status)
      ? optionalMoney("onwardSale")
      : null;

  // Where a rebate load went, and what it cost to get it there. Both only
  // apply to rebate jobs, and both are optional.
  const isRebate = statusIsKnown && direction === "purchase";
  const outletId = isRebate ? text(formData, "outletId") || null : null;
  const haulageCostPence =
    isRebate && isWeighedOrLater(status) ? optionalMoney("haulageCost") : null;

  if (Object.keys(fieldErrors).length > 0) {
    return { errors: fieldErrors, job: null };
  }

  return {
    errors: null,
    job: {
      customerId,
      siteAddress,
      date,
      material,
      notes: text(formData, "notes"),
      status,
      weightKg,
      direction,
      // Charged either way round: collecting a skip costs the same whether we
      // are billing for what is in it or paying for it.
      chargeHaulage: text(formData, "chargeHaulage") === "on",
      haulageRateOverridePence,
      supplierPO,
      poRaisedDate,
      supplierInvoiceRef,
      paidDate,
      disposalCostPence,
      onwardSalePence,
      outletId,
      haulageCostPence,
    },
  };
}

export async function createJob(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseJob(formData);
  if (parsed.errors) {
    return {
      fieldErrors: parsed.errors,
      formError: "Some details need fixing before this can be saved.",
    };
  }

  try {
    await addJob(parsed.job);
  } catch (error) {
    console.error("Could not save the job", error);
    return {
      fieldErrors: {},
      formError: "Could not save the job. Please try again.",
    };
  }

  revalidatePath("/calendar");
  revalidatePath("/finance");
  // Land back on the month the job was booked into, not whichever month
  // happened to be on screen beforehand.
  redirect(`/calendar?month=${monthKeyOf(parsed.job.date)}`);
}

export async function saveJob(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const jobId = text(formData, "jobId");
  if (jobId === "") {
    return { fieldErrors: {}, formError: "Could not tell which job this is." };
  }

  const parsed = await parseJob(formData);
  if (parsed.errors) {
    return {
      fieldErrors: parsed.errors,
      formError: "Some details need fixing before this can be saved.",
    };
  }

  let updated;
  try {
    updated = await updateJob(jobId, parsed.job);
  } catch (error) {
    console.error("Could not save the job", error);
    return {
      fieldErrors: {},
      formError: "Could not save the job. Please try again.",
    };
  }

  if (!updated) {
    return {
      fieldErrors: {},
      formError: "That job no longer exists. It may have been removed.",
    };
  }

  revalidatePath("/calendar");
  revalidatePath("/finance");
  revalidatePath(`/calendar/${jobId}`);
  redirect(`/calendar?month=${monthKeyOf(parsed.job.date)}`);
}


/**
 * Delete a job, including one that has already been invoiced.
 *
 * An invoice holds the jobs it covers rather than a copy of their figures, so
 * taking a job away changes what the invoice comes to. That is the point: a
 * job booked in error should not keep being charged for. Three things happen
 * so the invoice does not end up describing something that is not there:
 *
 *  - the job is taken off the invoice's list, rather than left as an id
 *    pointing at nothing;
 *  - the filed PDF is thrown away, because it shows the old total. The next
 *    time the invoice is opened a fresh one is built at the new figure;
 *  - an invoice left covering nothing is kept, not scrapped. Its number has
 *    been issued and may already have gone out, and a £0.00 invoice on the
 *    list is a question someone can answer - a vanished one is not.
 *
 * Where a corrected invoice has already been sent, it has to be sent again.
 * Nothing here can reach into the client's inbox and fix the one they have.
 *
 * Returns a reason when it will not go ahead, or null when it has.
 */
export async function removeJob(jobId: string): Promise<string | null> {
  if (jobId === "") return "Could not tell which job this is.";

  // Every invoice, withdrawn ones included: a deleted invoice is kept to be
  // looked at, so it should not be left naming a job that is not there.
  const [invoices, jobs, settings] = await Promise.all([
    readAllInvoices(),
    readJobs(),
    readSettings(),
  ]);
  const job = jobs.find((entry) => entry.id === jobId);
  if (!job) return "That job no longer exists.";

  const billedOn = invoices.filter((invoice) => invoice.jobIds.includes(jobId));

  try {
    await deleteJob(jobId);
    for (const invoice of billedOn) {
      await updateInvoice(invoice.id, {
        jobIds: invoice.jobIds.filter((id) => id !== jobId),
        pdfSavedAt: null,
      });
      await deleteSavedPdf(
        pdfFileName(settings.invoiceNumberPrefix, invoice.number),
      );
    }
  } catch (error) {
    console.error("Could not delete the job", error);
    return "Could not delete the job. Please try again.";
  }

  revalidatePath("/calendar");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  for (const invoice of billedOn) revalidatePath(`/invoices/${invoice.id}`);
  redirect(`/calendar?month=${monthKeyOf(job.date)}`);
}
