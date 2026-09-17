"use server";

/**
 * What runs on the server when an outlet is added. As with clients, the form
 * is checked again here rather than trusted.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import type { FormState } from "./form-state";
import { parsePoundsToPence } from "./money";
import { addOutlet } from "./outlets";
import type { OutletMaterial } from "./types";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

export async function createOutlet(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const fieldErrors: Record<string, string> = {};

  const name = text(formData, "name");
  if (name === "") fieldErrors.name = "Enter the outlet's name.";

  const email = text(formData, "email");
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That does not look like an email address.";
  }

  // The material rows arrive as two lists that line up by position.
  const names = formData.getAll("materialName");
  const incomes = formData.getAll("materialIncome");

  const materials: OutletMaterial[] = [];
  for (let index = 0; index < names.length; index += 1) {
    const material = String(names[index] ?? "").trim();
    const income = String(incomes[index] ?? "").trim();

    // A row where nothing was filled in is someone who changed their mind.
    if (material === "" && income === "") continue;

    if (material === "") {
      fieldErrors[`materialName-${index}`] = "Choose or type a material.";
    }
    const incomePence = parsePoundsToPence(income);
    if (incomePence === null) {
      fieldErrors[`materialIncome-${index}`] = "Enter a price, e.g. 240.00.";
    }

    if (material !== "" && incomePence !== null) {
      materials.push({ id: randomUUID(), material, incomePence });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      formError: "Some details need fixing before this can be saved.",
    };
  }

  try {
    await addOutlet({
      name,
      contactName: text(formData, "contactName"),
      phone: text(formData, "phone"),
      email,
      address: text(formData, "address"),
      notes: text(formData, "notes"),
      materials,
    });
  } catch (error) {
    console.error("Could not save the outlet", error);
    return {
      fieldErrors: {},
      formError: "Could not save the outlet. Please try again.",
    };
  }

  revalidatePath("/outlets");
  // An outlet's rate is what a rebate load earned, so the year's figures move.
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  redirect("/outlets");
}
