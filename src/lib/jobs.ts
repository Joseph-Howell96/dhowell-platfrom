/**
 * Reading and writing the job list, kept in data/jobs.json.
 *
 * The same arrangement as clients: one plain file you can open and read, with
 * every value checked on the way in because a hand-edited file can hold
 * anything.
 */
import { randomUUID } from "node:crypto";

import { isValidISODate } from "./calendar";
import { readJsonList, writeJsonList } from "./store";
import {
  isStatusValidFor,
  JOB_DIRECTIONS,
  JOB_STATUSES,
  type Job,
  type JobDirection,
  type JobStatus,
} from "./types";

const FILE = "jobs.json";

/**
 * Statuses that existed before the list changed, and what they became.
 * Without this, a job saved under an old name would quietly fall back to
 * "booked" and lose its place in the run of work.
 */
const RENAMED_STATUSES: Record<string, JobStatus> = {
  // "Completed" meant collected but not yet weighed, which is where a booked
  // job sits under the current list.
  completed: "booked",
  // Billing is no longer a status. A job that had reached one of the old
  // billing steps had certainly been weighed, so that is where it lands; if it
  // is on an invoice it reads as invoiced anyway, worked out from the invoice.
  invoiced: "weighed",
  "generate-invoice": "weighed",
  "invoice-sent": "weighed",
};

function toStatus(value: unknown): JobStatus | null {
  if (typeof value !== "string") return null;
  if (JOB_STATUSES.includes(value as JobStatus)) return value as JobStatus;
  return RENAMED_STATUSES[value] ?? null;
}

function toDirection(value: unknown): JobDirection | null {
  if (typeof value !== "string") return null;
  return JOB_DIRECTIONS.includes(value as JobDirection)
    ? (value as JobDirection)
    : null;
}

function toJob(raw: unknown): Job | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  // Without a date there is nowhere to put it on the calendar, and without a
  // client it belongs to nobody. Anything missing those is skipped.
  if (typeof record.date !== "string" || !isValidISODate(record.date)) {
    return null;
  }
  if (typeof record.customerId !== "string" || record.customerId === "") {
    return null;
  }

  const text = (key: string) =>
    typeof record[key] === "string" ? (record[key] as string) : "";

  // A weight of zero is a real answer, so only a proper number counts.
  const weightKg =
    typeof record.weightKg === "number" &&
    Number.isFinite(record.weightKg) &&
    record.weightKg >= 0
      ? Math.round(record.weightKg)
      : null;

  const optionalDate = (key: string) =>
    typeof record[key] === "string" && isValidISODate(record[key] as string)
      ? (record[key] as string)
      : null;

  const optionalPence = (key: string) => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? Math.round(value)
      : null;
  };

  const optionalText = (key: string) => {
    const value = record[key];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  };

  // Jobs saved before sales and purchases were told apart have no direction
  // recorded. They were all being treated as money coming in, so that is what
  // they stay until someone says otherwise on the job itself.
  const direction = toDirection(record.direction) ?? "sale";

  const status = toStatus(record.status) ?? "booked";
  // A status from the other path cannot apply here. Falling back to the start
  // of this one is the safe answer: it understates progress rather than
  // claiming an invoice went out when it did not.
  const safeStatus = isStatusValidFor(status, direction) ? status : "booked";

  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    customerId: record.customerId,
    siteAddress: text("siteAddress"),
    date: record.date,
    skipSize: text("skipSize"),
    material: text("material"),
    notes: text("notes"),
    status: safeStatus,
    weightKg,
    direction,
    chargeHaulage: record.chargeHaulage === true,
    supplierPO: optionalText("supplierPO"),
    poRaisedDate: optionalDate("poRaisedDate"),
    supplierInvoiceRef: optionalText("supplierInvoiceRef"),
    paidDate: optionalDate("paidDate"),
    outletId: optionalText("outletId"),
    haulageCostPence: optionalPence("haulageCostPence"),
    disposalCostPence: optionalPence("disposalCostPence"),
    onwardSalePence: optionalPence("onwardSalePence"),
    createdAt: text("createdAt") || new Date().toISOString(),
  };
}

/** Every job we hold, earliest date first. */
export async function readJobs(): Promise<Job[]> {
  const rows = await readJsonList(FILE);
  return rows
    .map(toJob)
    .filter((job) => job !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** One job by its id, or null if there is no such job. */
export async function readJob(id: string): Promise<Job | null> {
  const jobs = await readJobs();
  return jobs.find((job) => job.id === id) ?? null;
}

/** Add a job and save. Returns the job as it was stored. */
export async function addJob(
  details: Omit<Job, "id" | "createdAt">,
): Promise<Job> {
  const jobs = await readJobs();
  const job: Job = {
    ...details,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await writeJsonList(FILE, [...jobs, job]);
  return job;
}

/**
 * Change an existing job. Returns the updated job, or null if the id does not
 * match anything - which happens if the same job is deleted in another tab.
 */
export async function updateJob(
  id: string,
  changes: Omit<Job, "id" | "createdAt">,
): Promise<Job | null> {
  const jobs = await readJobs();
  const existing = jobs.find((job) => job.id === id);
  if (!existing) return null;

  const updated: Job = { ...existing, ...changes, id: existing.id };
  await writeJsonList(
    FILE,
    jobs.map((job) => (job.id === id ? updated : job)),
  );
  return updated;
}

/**
 * Remove a job for good. Returns false where the id matches nothing, which
 * happens if it was already deleted in another tab.
 */
export async function deleteJob(id: string): Promise<boolean> {
  const jobs = await readJobs();
  if (!jobs.some((job) => job.id === id)) return false;
  await writeJsonList(
    FILE,
    jobs.filter((job) => job.id !== id),
  );
  return true;
}
