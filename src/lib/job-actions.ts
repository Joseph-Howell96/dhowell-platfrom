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
import type { FormState } from "./form-state";
import { addJob, updateJob } from "./jobs";
import {
  isStatusValidFor,
  isWeighedOrLater,
  JOB_DIRECTIONS,
  JOB_STATUSES,
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
  skipSize: string;
  material: string;
  notes: string;
  status: JobStatus;
  weightKg: number | null;
  direction: JobDirection;
  invoiceSentDate: string | null;
  supplierPO: string | null;
  poRaisedDate: string | null;
  supplierInvoiceRef: string | null;
  paidDate: string | null;
  disposalCostPence: number | null;
  onwardSalePence: number | null;
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
  // The status has to belong to this job's path. A purchase cannot be at
  // "invoice sent", and a sale cannot be at "paid".
  const statusIsKnown =
    JOB_STATUSES.includes(statusValue as JobStatus) &&
    directionIsKnown &&
    isStatusValidFor(statusValue as JobStatus, direction);
  if (!statusIsKnown) {
    fieldErrors.status = "Choose a status.";
  }
  const status = statusValue as JobStatus;

  // Once a job is weighed the weighbridge figure is the whole point of the
  // status, so it has to be there. Before that it is not asked for.
  let weightKg: number | null = null;
  if (statusIsKnown && isWeighedOrLater(status)) {
    const weightInput = text(formData, "weightTonnes");
    if (weightInput === "") {
      fieldErrors.weightTonnes = "Enter the weight in tonnes.";
    } else {
      weightKg = parseTonnesToKg(weightInput);
      if (weightKg === null) {
        fieldErrors.weightTonnes = "Enter a weight in tonnes, e.g. 2.45.";
      }
    }
  }

  /** A date field that has to be filled in and has to be a real date. */
  function requiredDate(name: string, missingMessage: string): string | null {
    const value = text(formData, name);
    if (value === "") {
      fieldErrors[name] = missingMessage;
      return null;
    }
    if (!isValidISODate(value)) {
      fieldErrors[name] = "That is not a real date.";
      return null;
    }
    return value;
  }

  // Sale side. The date the invoice went out is recorded once it has gone out.
  let invoiceSentDate: string | null = null;
  if (statusIsKnown && status === "invoice-sent") {
    invoiceSentDate = requiredDate(
      "invoiceSentDate",
      "Enter the date the invoice was sent.",
    );
  }

  // Purchase side. The order number and its date are needed from the moment an
  // order goes out, and stay on the job after it has been paid.
  let supplierPO: string | null = null;
  let poRaisedDate: string | null = null;
  let supplierInvoiceRef: string | null = null;
  let paidDate: string | null = null;

  if (statusIsKnown && (status === "po-raised" || status === "paid")) {
    supplierPO = text(formData, "supplierPO");
    if (supplierPO === "") {
      fieldErrors.supplierPO = "Enter the purchase order number.";
      supplierPO = null;
    }
    poRaisedDate = requiredDate(
      "poRaisedDate",
      "Enter the date the order was raised.",
    );
    // Optional: there is no supplier invoice at all when we self-bill.
    supplierInvoiceRef = text(formData, "supplierInvoiceRef") || null;
  }

  if (statusIsKnown && status === "paid") {
    paidDate = requiredDate("paidDate", "Enter the date they were paid.");
  }

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

  if (Object.keys(fieldErrors).length > 0) {
    return { errors: fieldErrors, job: null };
  }

  return {
    errors: null,
    job: {
      customerId,
      siteAddress,
      date,
      skipSize: text(formData, "skipSize"),
      material,
      notes: text(formData, "notes"),
      status,
      weightKg,
      direction,
      invoiceSentDate,
      supplierPO,
      poRaisedDate,
      supplierInvoiceRef,
      paidDate,
      disposalCostPence,
      onwardSalePence,
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
