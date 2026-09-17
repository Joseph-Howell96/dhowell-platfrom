"use server";

/**
 * Adding, removing and re-roling users. Admin work, so every one of these
 * checks the caller is an admin before it does anything - a form can be sent
 * by anything, not just the page we built.
 */
import { revalidatePath } from "next/cache";

import type { FormState } from "./form-state";
import { ROLES, type Role } from "./roles";
import { readSession } from "./session";
import { addUser, deleteUser, findUser, setUserRole } from "./users";

/** Nobody but an admin changes the user list. */
async function requireAdmin(): Promise<boolean> {
  return (await readSession())?.role === "admin";
}

export async function createUser(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await requireAdmin())) {
    return { fieldErrors: {}, formError: "Only an admin can add users." };
  }

  const fieldErrors: Record<string, string> = {};
  const username = String(formData.get("username") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const roleValue = String(formData.get("role") ?? "");

  if (username === "") {
    fieldErrors.username = "Enter a username.";
  } else if (/\s/.test(username)) {
    fieldErrors.username = "A username cannot contain spaces.";
  } else if (await findUser(username)) {
    fieldErrors.username = "Somebody already signs in with that username.";
  }

  if (!ROLES.includes(roleValue as Role)) {
    fieldErrors.role = "Choose a role.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: "Some details need fixing." };
  }

  try {
    await addUser({ username, displayName, role: roleValue as Role });
  } catch (error) {
    console.error("Could not add the user", error);
    return { fieldErrors: {}, formError: "Could not add the user. Try again." };
  }

  revalidatePath("/settings");
  return { fieldErrors: {}, formError: null };
}

/**
 * Remove someone.
 *
 * Refused on your own account, which is the one mistake that locks a person
 * out of the screen they would need to undo it.
 */
export async function removeUser(id: string): Promise<string | null> {
  const session = await readSession();
  if (session?.role !== "admin") return "Only an admin can remove users.";

  const users = await import("./users").then((m) => m.readUsers());
  const target = users.find((user) => user.id === id);
  if (!target) return "That user no longer exists.";
  if (target.username.toLowerCase() === session.username.toLowerCase()) {
    return "That is you. Removing your own account would sign you out of the only screen that could put it back.";
  }

  try {
    await deleteUser(id);
  } catch (error) {
    console.error("Could not remove the user", error);
    return "Could not remove the user. Try again.";
  }

  revalidatePath("/settings");
  return null;
}

/** Change what somebody can see. Refused on your own account, as above. */
export async function changeUserRole(
  id: string,
  role: Role,
): Promise<string | null> {
  const session = await readSession();
  if (session?.role !== "admin") return "Only an admin can change a role.";
  if (!ROLES.includes(role)) return "That is not a role.";

  const users = await import("./users").then((m) => m.readUsers());
  const target = users.find((user) => user.id === id);
  if (!target) return "That user no longer exists.";
  if (
    target.username.toLowerCase() === session.username.toLowerCase() &&
    role !== "admin"
  ) {
    return "That is you. Taking your own admin away would shut you out of this screen.";
  }

  try {
    await setUserRole(id, role);
  } catch (error) {
    console.error("Could not change the role", error);
    return "Could not change the role. Try again.";
  }

  revalidatePath("/settings");
  return null;
}
