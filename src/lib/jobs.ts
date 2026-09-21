/**
 * Reading and writing the job list.
 *
 * Every check the file-backed version did on the way in is a column type or a
 * constraint now: a status has to be one of three, a weight cannot be
 * negative, and a job cannot be complete without one. Those rules used to be
 * promises this code made and are facts the database keeps, which means they
 * hold however a row is written - including by somebody poking at it in the
 * Supabase table editor at ten to five on a Friday.
 */
import { db, orThrow } from "./db";
import type { Job, JobDirection, JobStatus } from "./types";

type Row = {
  id: string;
  customer_id: string;
  site_address: string | null;
  job_date: string;
  material: string | null;
  notes: string | null;
  status: string;
  weight_kg: number | null;
  direction: string;
  supplier_po: string | null;
  po_raised_date: string | null;
  supplier_invoice_ref: string | null;
  paid_date: string | null;
  disposal_cost_pence: number | null;
  haulage_cost_pence: number | null;
  onward_sale_pence: number | null;
  created_at: string;
};

const COLUMNS = `
  id, customer_id, site_address, job_date, material, notes, status, weight_kg,
  direction, supplier_po, po_raised_date, supplier_invoice_ref, paid_date,
  disposal_cost_pence, haulage_cost_pence, onward_sale_pence, created_at
`;

function toJob(row: Row): Job {
  return {
    id: row.id,
    customerId: row.customer_id,
    siteAddress: row.site_address ?? "",
    date: row.job_date,
    material: row.material ?? "",
    notes: row.notes ?? "",
    status: row.status as JobStatus,
    weightKg: row.weight_kg,
    direction: row.direction as JobDirection,
    supplierPO: row.supplier_po,
    poRaisedDate: row.po_raised_date,
    supplierInvoiceRef: row.supplier_invoice_ref,
    paidDate: row.paid_date,
    disposalCostPence: row.disposal_cost_pence,
    haulageCostPence: row.haulage_cost_pence,
    onwardSalePence: row.onward_sale_pence,
    createdAt: row.created_at,
  };
}

function fields(job: Omit<Job, "id" | "createdAt">) {
  return {
    customer_id: job.customerId,
    site_address: job.siteAddress,
    job_date: job.date,
    material: job.material,
    notes: job.notes,
    status: job.status,
    weight_kg: job.weightKg,
    direction: job.direction,
    supplier_po: job.supplierPO,
    po_raised_date: job.poRaisedDate,
    supplier_invoice_ref: job.supplierInvoiceRef,
    paid_date: job.paidDate,
    disposal_cost_pence: job.disposalCostPence,
    haulage_cost_pence: job.haulageCostPence,
    onward_sale_pence: job.onwardSalePence,
  };
}

/** Every job we hold, earliest date first. */
export async function readJobs(): Promise<Job[]> {
  const rows = orThrow<Row[]>(
    "Reading the jobs",
    await db()
      .from("jobs")
      .select(COLUMNS)
      .order("job_date", { ascending: true })
      .returns<Row[]>(),
  );
  return rows.map(toJob);
}

/** One job by its id, or null if there is no such job. */
export async function readJob(id: string): Promise<Job | null> {
  const { data, error } = await db()
    .from("jobs")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<Row>();
  if (error) throw new Error(`Reading a job failed: ${error.message}`);
  return data ? toJob(data) : null;
}

/** Add a job and save. Returns the job as it was stored. */
export async function addJob(
  details: Omit<Job, "id" | "createdAt">,
): Promise<Job> {
  const row = orThrow<Row>(
    "Saving the job",
    await db().from("jobs").insert(fields(details)).select(COLUMNS).single<Row>(),
  );
  return toJob(row);
}

/**
 * Change an existing job. Returns the updated job, or null if the id does not
 * match anything - which happens if the same job is deleted in another tab.
 */
export async function updateJob(
  id: string,
  changes: Omit<Job, "id" | "createdAt">,
): Promise<Job | null> {
  const { data, error } = await db()
    .from("jobs")
    .update(fields(changes))
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle<Row>();
  if (error) throw new Error(`Saving the job failed: ${error.message}`);
  return data ? toJob(data) : null;
}

/**
 * Remove a job for good. Returns false where the id matches nothing, which
 * happens if it was already deleted in another tab.
 */
export async function deleteJob(id: string): Promise<boolean> {
  const { data, error } = await db().from("jobs").delete().eq("id", id).select("id");
  if (error) throw new Error(`Deleting a job failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
