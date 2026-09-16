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
import { JOB_STATUSES, type Job, type JobStatus } from "./types";

const FILE = "jobs.json";

function isStatus(value: unknown): value is JobStatus {
  return JOB_STATUSES.includes(value as JobStatus);
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

  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    customerId: record.customerId,
    siteAddress: text("siteAddress"),
    date: record.date,
    skipSize: text("skipSize"),
    material: text("material"),
    notes: text("notes"),
    status: isStatus(record.status) ? record.status : "booked",
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
