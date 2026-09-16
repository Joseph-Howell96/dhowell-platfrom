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
import { JOB_STATUSES, type JobStatus } from "./types";

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

  const statusValue = text(formData, "status") || "booked";
  if (!JOB_STATUSES.includes(statusValue as JobStatus)) {
    fieldErrors.status = "Choose a status.";
  }

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
      status: statusValue as JobStatus,
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
  revalidatePath(`/calendar/${jobId}`);
  redirect(`/calendar?month=${monthKeyOf(parsed.job.date)}`);
}
