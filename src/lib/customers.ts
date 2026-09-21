/**
 * Reading and writing the client list.
 *
 * A client and their rate card are two tables, joined on the client's id. That
 * is why the reads below ask for the rate lines in the same breath: one round
 * trip that brings back a client with their rates already attached, rather
 * than a list of clients followed by a query per client.
 *
 * Everything the old file-backed version did by hand - checking a figure was
 * really a number, that a direction was one of the two allowed - is a column
 * type or a constraint now. A rate that would have been nonsense is refused by
 * the database rather than quietly dropped on the way in.
 */
import { db, orThrow } from "./db";
import type { Customer, Direction, RateLine } from "./types";

type RateRow = {
  id: string;
  material: string;
  rate_per_tonne_pence: number | null;
  direction: string;
  onward_rate_per_tonne_pence: number | null;
};

type CustomerRow = {
  id: string;
  business_name: string;
  site_address: string | null;
  billing_address: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  payment_terms_days: number | null;
  notes: string | null;
  haulage_fee_pence: number | null;
  archived_at: string | null;
  created_at: string;
  rate_lines: RateRow[] | null;
};

const COLUMNS = `
  id, business_name, site_address, billing_address, contact_name, phone, email,
  payment_terms_days, notes, haulage_fee_pence, archived_at, created_at,
  rate_lines ( id, material, rate_per_tonne_pence, direction, onward_rate_per_tonne_pence )
`;

function toRateLine(row: RateRow): RateLine {
  return {
    id: row.id,
    material: row.material,
    ratePerTonnePence: row.rate_per_tonne_pence,
    direction: row.direction as Direction,
    onwardRatePerTonnePence: row.onward_rate_per_tonne_pence,
  };
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    businessName: row.business_name,
    siteAddress: row.site_address ?? "",
    billingAddress: row.billing_address ?? "",
    contactName: row.contact_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    paymentTermsDays: row.payment_terms_days ?? 0,
    notes: row.notes ?? "",
    haulageFeePence: row.haulage_fee_pence ?? 0,
    // A rate line with no price prices nothing, so it is not worth showing.
    rateLines: (row.rate_lines ?? [])
      .filter((line) => line.rate_per_tonne_pence !== null)
      .map(toRateLine)
      .sort((a, b) => a.material.localeCompare(b.material)),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

/** Every customer we hold, newest first. */
export async function readCustomers(): Promise<Customer[]> {
  const rows = orThrow<CustomerRow[]>(
    "Reading the client list",
    await db()
      .from("customers")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .returns<CustomerRow[]>(),
  );
  return rows.map(toCustomer);
}

/** Just the clients still in use, for lists and for picking one out of. */
export async function readActiveCustomers(): Promise<Customer[]> {
  const rows = orThrow<CustomerRow[]>(
    "Reading the client list",
    await db()
      .from("customers")
      .select(COLUMNS)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .returns<CustomerRow[]>(),
  );
  return rows.map(toCustomer);
}

export async function readCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await db()
    .from("customers")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<CustomerRow>();
  if (error) throw new Error(`Reading a client failed: ${error.message}`);
  return data ? toCustomer(data) : null;
}

/** The client's own columns, without the rates, which live in their own table. */
function customerFields(details: Partial<Omit<Customer, "id" | "createdAt">>) {
  const fields: Record<string, unknown> = {};
  if (details.businessName !== undefined) fields.business_name = details.businessName;
  if (details.siteAddress !== undefined) fields.site_address = details.siteAddress;
  if (details.billingAddress !== undefined) fields.billing_address = details.billingAddress;
  if (details.contactName !== undefined) fields.contact_name = details.contactName;
  if (details.phone !== undefined) fields.phone = details.phone;
  if (details.email !== undefined) fields.email = details.email;
  if (details.paymentTermsDays !== undefined) fields.payment_terms_days = details.paymentTermsDays;
  if (details.notes !== undefined) fields.notes = details.notes;
  if (details.haulageFeePence !== undefined) fields.haulage_fee_pence = details.haulageFeePence;
  if (details.archivedAt !== undefined) fields.archived_at = details.archivedAt;
  return fields;
}

/**
 * Write a client's rate card, so that afterwards it holds exactly these rates.
 *
 * The order matters and is the whole point. The new rates go in first, then
 * anything no longer on the card is removed. Done the other way round - clear
 * the card, then write it - a failure between the two steps would leave a
 * client with no rates at all, which is the one outcome worth engineering
 * against: it turns every job for them into one nobody can price. This way the
 * worst a half-finished save can leave behind is a rate that should have gone,
 * which is visible on the client's own screen and takes a moment to delete.
 */
async function writeRateLines(
  customerId: string,
  lines: RateLine[],
): Promise<void> {
  const wanted = lines.filter((line) => line.material.trim() !== "");

  if (wanted.length > 0) {
    const { error } = await db()
      .from("rate_lines")
      .upsert(
        wanted.map((line) => ({
          customer_id: customerId,
          material: line.material.trim(),
          rate_per_tonne_pence: line.ratePerTonnePence,
          direction: line.direction,
          onward_rate_per_tonne_pence: line.onwardRatePerTonnePence,
        })),
        // One rate per material per client is a rule the database holds, so
        // this is also what tells it that a second save of the same material
        // is a correction rather than a new line.
        { onConflict: "customer_id,material" },
      );
    if (error) throw new Error(`Saving the rates failed: ${error.message}`);
  }

  // Which rows are now surplus is worked out here rather than asked of the
  // database as a "material not in this list" filter. Materials are partly
  // free text - the job form lets anyone type their own - so one containing a
  // comma or a quotation mark would have come out the far side as a filter
  // meaning something else entirely. Ids cannot, so the deleting is done by id.
  const present = orThrow<{ id: string; material: string }[]>(
    "Reading the rates back",
    await db()
      .from("rate_lines")
      .select("id, material")
      .eq("customer_id", customerId)
      .returns<{ id: string; material: string }[]>(),
  );

  const keep = new Set(wanted.map((line) => line.material.trim()));
  const surplus = present
    .filter((row) => !keep.has(row.material))
    .map((row) => row.id);

  if (surplus.length > 0) {
    const { error } = await db().from("rate_lines").delete().in("id", surplus);
    if (error) throw new Error(`Tidying up the old rates failed: ${error.message}`);
  }
}

/** Add one customer and their rates. Returns the customer that was stored. */
export async function addCustomer(
  details: Omit<Customer, "id" | "createdAt" | "archivedAt">,
): Promise<Customer> {
  const created = orThrow<{ id: string }>(
    "Saving the client",
    await db()
      .from("customers")
      .insert(customerFields(details))
      .select("id")
      .single<{ id: string }>(),
  );

  await writeRateLines(created.id, details.rateLines);

  const customer = await readCustomer(created.id);
  if (!customer) throw new Error("The client was saved but could not be read back.");
  return customer;
}

/**
 * Change an existing client. Returns the updated record, or null where the id
 * matches nothing.
 */
export async function updateCustomer(
  id: string,
  changes: Partial<Omit<Customer, "id" | "createdAt">>,
): Promise<Customer | null> {
  const fields = customerFields(changes);

  if (Object.keys(fields).length > 0) {
    const { data, error } = await db()
      .from("customers")
      .update(fields)
      .eq("id", id)
      .select("id");
    if (error) throw new Error(`Saving the client failed: ${error.message}`);
    if ((data?.length ?? 0) === 0) return null;
  } else if (!(await readCustomer(id))) {
    return null;
  }

  // Absent means "leave the rate card alone"; an empty list means "clear it".
  if (changes.rateLines !== undefined) {
    await writeRateLines(id, changes.rateLines);
  }

  return readCustomer(id);
}
