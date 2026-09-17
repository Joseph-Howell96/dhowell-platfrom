/**
 * Reading and writing the outlet list, kept in data/outlets.json.
 *
 * The same arrangement as clients and jobs: one plain file, with every value
 * checked on the way in.
 */
import { randomUUID } from "node:crypto";

import { readJsonList, writeJsonList } from "./store";
import type { Outlet, OutletMaterial } from "./types";

const FILE = "outlets.json";

function toMaterial(raw: unknown): OutletMaterial | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.material !== "string" || row.material.trim() === "") return null;
  if (typeof row.incomePence !== "number" || !Number.isFinite(row.incomePence)) {
    return null;
  }
  return {
    id: typeof row.id === "string" ? row.id : randomUUID(),
    material: row.material.trim(),
    incomePence: Math.round(row.incomePence),
  };
}

function toOutlet(raw: unknown): Outlet | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.trim() === "") return null;

  const text = (key: string) =>
    typeof record[key] === "string" ? (record[key] as string) : "";

  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    name: record.name.trim(),
    contactName: text("contactName"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    materials: Array.isArray(record.materials)
      ? record.materials.map(toMaterial).filter((row) => row !== null)
      : [],
    createdAt: text("createdAt") || new Date().toISOString(),
  };
}

/** Every outlet we hold, newest first. */
export async function readOutlets(): Promise<Outlet[]> {
  const rows = await readJsonList(FILE);
  return rows
    .map(toOutlet)
    .filter((outlet) => outlet !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Add an outlet and save. Returns the outlet as it was stored. */
export async function addOutlet(
  details: Omit<Outlet, "id" | "createdAt">,
): Promise<Outlet> {
  const outlets = await readOutlets();
  const outlet: Outlet = {
    ...details,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await writeJsonList(FILE, [outlet, ...outlets]);
  return outlet;
}

/**
 * What an outlet pays for a tonne of a material, or null where they do not
 * take it. Matched ignoring capitalisation, as rate lines are.
 */
export function outletIncomeFor(
  outlet: Outlet | undefined,
  material: string,
): number | null {
  if (!outlet) return null;
  const row = outlet.materials.find(
    (entry) => entry.material.toLowerCase() === material.toLowerCase(),
  );
  return row ? row.incomePence : null;
}
