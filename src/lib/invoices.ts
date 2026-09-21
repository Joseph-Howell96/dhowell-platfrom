/**
 * Reading and writing invoices.
 *
 * An invoice holds which jobs it covers rather than a copy of their figures,
 * and that list is a table of its own - `invoice_jobs`. The reason is one
 * line in the schema: `unique (job_id)`. It makes "a job can never be on two
 * invoices" something the database refuses rather than something this code
 * remembers to check. Two people generating invoices at the same moment used
 * to be able to bill the same load twice; now the second one is turned away.
 */
import { db, orThrow } from "./db";
import type { Invoice, InvoiceStatus } from "./types";

type Row = {
  id: string;
  number: number;
  customer_id: string;
  issue_date: string;
  customer_po: string | null;
  status: string;
  paid_date: string | null;
  pdf_saved_at: string | null;
  deleted_at: string | null;
  created_at: string;
  invoice_jobs: { job_id: string }[] | null;
};

const COLUMNS = `
  id, number, customer_id, issue_date, customer_po, status, paid_date,
  pdf_saved_at, deleted_at, created_at,
  invoice_jobs ( job_id )
`;

function toInvoice(row: Row): Invoice {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customer_id,
    issueDate: row.issue_date,
    customerPO: row.customer_po ?? "",
    jobIds: (row.invoice_jobs ?? []).map((link) => link.job_id),
    status: row.status as InvoiceStatus,
    paidDate: row.paid_date,
    pdfSavedAt: row.pdf_saved_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

/**
 * Every invoice, deleted ones included, newest number first.
 *
 * Two things need this: working out the next number, which must step past a
 * withdrawn invoice rather than reuse it, and checking whether a job is
 * already spoken for. Everywhere else wants readInvoices below.
 */
export async function readAllInvoices(): Promise<Invoice[]> {
  const rows = orThrow<Row[]>(
    "Reading the invoices",
    await db()
      .from("invoices")
      .select(COLUMNS)
      .order("number", { ascending: false })
      .returns<Row[]>(),
  );
  return rows.map(toInvoice);
}

/**
 * The invoices that stand, newest number first.
 *
 * Deleted ones are left out, which is what frees their jobs: nothing records
 * on the job that it has been billed, so a job whose only invoice has been
 * withdrawn goes back to waiting of its own accord.
 */
export async function readInvoices(): Promise<Invoice[]> {
  const rows = orThrow<Row[]>(
    "Reading the invoices",
    await db()
      .from("invoices")
      .select(COLUMNS)
      .is("deleted_at", null)
      .order("number", { ascending: false })
      .returns<Row[]>(),
  );
  return rows.map(toInvoice);
}

/** The withdrawn ones, most recently deleted first. */
export async function readDeletedInvoices(): Promise<Invoice[]> {
  const rows = orThrow<Row[]>(
    "Reading the withdrawn invoices",
    await db()
      .from("invoices")
      .select(COLUMNS)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .returns<Row[]>(),
  );
  return rows.map(toInvoice);
}

/** One invoice by id, whether it stands or has been deleted. */
export async function readInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await db()
    .from("invoices")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<Row>();
  if (error) throw new Error(`Reading an invoice failed: ${error.message}`);
  return data ? toInvoice(data) : null;
}

/**
 * The number the next invoice gets: one past the highest used so far, or the
 * starting number from settings where none have been raised yet. Worked out
 * from what exists rather than kept in a counter, so it cannot drift.
 *
 * Pass every invoice, deleted ones included. A withdrawn number is spent - two
 * invoices carrying the same one is exactly the mess numbering exists to
 * prevent.
 */
export function nextInvoiceNumber(
  invoices: Invoice[],
  startNumber: number,
): number {
  const highest = invoices.reduce(
    (top, invoice) => Math.max(top, invoice.number),
    0,
  );
  return highest === 0 ? startNumber : Math.max(highest + 1, startNumber);
}

/** Which jobs are already spoken for, so they cannot be billed twice. */
export function invoicedJobIds(invoices: Invoice[]): Set<string> {
  return new Set(invoices.flatMap((invoice) => invoice.jobIds));
}

/**
 * Raise an invoice over a set of jobs.
 *
 * If linking the jobs fails - because another invoice claimed one of them a
 * moment ago, which the unique constraint will not allow - the invoice itself
 * is removed again. An invoice covering nothing is worse than no invoice: it
 * has taken a number that can never be used again and shows on the list as a
 * document with no work on it.
 */
export async function addInvoice(
  details: Omit<Invoice, "id" | "createdAt">,
): Promise<Invoice> {
  const created = orThrow<{ id: string }>(
    "Saving the invoice",
    await db()
      .from("invoices")
      .insert({
        number: details.number,
        customer_id: details.customerId,
        issue_date: details.issueDate,
        customer_po: details.customerPO,
        status: details.status,
        paid_date: details.paidDate,
        pdf_saved_at: details.pdfSavedAt,
        deleted_at: details.deletedAt,
      })
      .select("id")
      .single<{ id: string }>(),
  );

  if (details.jobIds.length > 0) {
    const { error } = await db()
      .from("invoice_jobs")
      .insert(
        details.jobIds.map((jobId) => ({
          invoice_id: created.id,
          job_id: jobId,
        })),
      );
    if (error) {
      await db().from("invoices").delete().eq("id", created.id);
      throw new Error(
        `Putting the jobs on the invoice failed: ${error.message}. ` +
          `One of them may already be on another invoice.`,
      );
    }
  }

  const invoice = await readInvoice(created.id);
  if (!invoice) throw new Error("The invoice was saved but could not be read back.");
  return invoice;
}

export async function updateInvoice(
  id: string,
  changes: Partial<Omit<Invoice, "id" | "number" | "createdAt">>,
): Promise<Invoice | null> {
  const fields: Record<string, unknown> = {};
  if (changes.customerId !== undefined) fields.customer_id = changes.customerId;
  if (changes.issueDate !== undefined) fields.issue_date = changes.issueDate;
  if (changes.customerPO !== undefined) fields.customer_po = changes.customerPO;
  if (changes.status !== undefined) fields.status = changes.status;
  if (changes.paidDate !== undefined) fields.paid_date = changes.paidDate;
  if (changes.pdfSavedAt !== undefined) fields.pdf_saved_at = changes.pdfSavedAt;
  if (changes.deletedAt !== undefined) fields.deleted_at = changes.deletedAt;

  if (Object.keys(fields).length > 0) {
    const { data, error } = await db()
      .from("invoices")
      .update(fields)
      .eq("id", id)
      .select("id");
    if (error) throw new Error(`Saving the invoice failed: ${error.message}`);
    if ((data?.length ?? 0) === 0) return null;
  } else if (!(await readInvoice(id))) {
    return null;
  }

  // Absent means "leave the jobs alone". Taking one off an invoice frees it to
  // be billed on another, which is exactly what the unique constraint permits
  // once the link row is gone.
  if (changes.jobIds !== undefined) {
    const { error: cleared } = await db()
      .from("invoice_jobs")
      .delete()
      .eq("invoice_id", id);
    if (cleared) {
      throw new Error(`Changing which jobs are billed failed: ${cleared.message}`);
    }
    if (changes.jobIds.length > 0) {
      const { error } = await db()
        .from("invoice_jobs")
        .insert(
          changes.jobIds.map((jobId) => ({ invoice_id: id, job_id: jobId })),
        );
      if (error) {
        throw new Error(
          `Putting the jobs on the invoice failed: ${error.message}. ` +
            `One of them may already be on another invoice.`,
        );
      }
    }
  }

  return readInvoice(id);
}

/** Remove an invoice for good, freeing whatever jobs it covered. */
export async function deleteInvoiceForGood(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("invoices")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Deleting the invoice failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
