"use server";

/**
 * Adding, removing and re-roling users, and setting passwords. Admin work, so
 * every one of these checks the caller is an admin before it does anything - a
 * form can be sent by anything, not just the page we built.
 *
 * A password typed here goes straight to Supabase Auth and is never written
 * down, logged or returned. The one place it must not end up is in the
 * `console.error` calls below, which is why those report that something
 * failed rather than what was sent.
 */
import { revalidatePath } from "next/cache";

import type { FormState } from "./form-state";
import { ROLES, type Role } from "./roles";
import { readSession } from "./session";
import {
  createUser as createAccount,
  deleteUser,
  findUser,
  readUsers,
  setUserPassword,
  setUserRole,
} from "./users";

/**
 * The shortest password allowed.
 *
 * Eight rather than the six Supabase defaults to. Nobody types one of these
 * more than a few times a year - the session lasts weeks - so the usual
 * argument for keeping it short does not apply here.
 *
 * Not exported, and it cannot be: a "use server" file is allowed to export
 * async functions and nothing else. Exporting a plain value from one does not
 * fail with a complaint about that value - the whole module comes out with no
 * exports at all, and every action in it goes missing at once.
 */
const SHORTEST_PASSWORD = 8;

/** Nobody but an admin changes the user list. */
async function requireAdmin(): Promise<boolean> {
  return (await readSession())?.role === "admin";
}

function passwordProblem(password: string, confirm: string): string | null {
  if (password === "") return "Enter a password.";
  if (password.length < SHORTEST_PASSWORD) {
    return `A password needs at least ${SHORTEST_PASSWORD} characters.`;
  }
  if (password !== confirm) return "The two passwords do not match.";
  return null;
}

export async function createUser(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await requireAdmin())) {
    return { fieldErrors: {}, formError: "Only an admin can add users." };
  }

  const fieldErrors: Record<string, string> = {};
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const roleValue = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (username === "") {
    fieldErrors.username = "Enter a username.";
  } else if (/\s/.test(username)) {
    fieldErrors.username = "A username cannot contain spaces.";
  } else if (!/^[a-z0-9._-]+$/.test(username)) {
    // Kept to what makes a sane e-mail local part, because behind the scenes
    // that is exactly what this becomes.
    fieldErrors.username =
      "Use letters, numbers, full stops, dashes or underscores.";
  } else if (await findUser(username)) {
    fieldErrors.username = "Somebody already signs in with that username.";
  }

  if (!ROLES.includes(roleValue as Role)) {
    fieldErrors.role = "Choose a role.";
  }

  const password_problem = passwordProblem(password, confirm);
  if (password_problem) fieldErrors.password = password_problem;

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: "Some details need fixing." };
  }

  try {
    await createAccount({
      username,
      displayName,
      role: roleValue as Role,
      password,
    });
  } catch (error) {
    console.error("Could not add the user", error);
    return { fieldErrors: {}, formError: "Could not add the user. Try again." };
  }

  revalidatePath("/settings");
  return { fieldErrors: {}, formError: null };
}

/**
 * Give somebody a new password.
 *
 * There is no "forgot my password" e-mail, because the addresses behind these
 * accounts are not real inboxes. This is the way back in, and it is deliberately
 * an admin doing it in person rather than a link anybody could ask for.
 *
 * Allowed on your own account, unlike the other two below. Changing your own
 * password is not a way to lock yourself out - you choose the new one, and you
 * are the one typing it.
 */
export async function resetPassword(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await requireAdmin())) {
    return { fieldErrors: {}, formError: "Only an admin can set a password." };
  }

  const id = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const problem = passwordProblem(password, confirm);
  if (problem) {
    return { fieldErrors: { password: problem }, formError: null };
  }

  const target = (await readUsers()).find((user) => user.id === id);
  if (!target) {
    return { fieldErrors: {}, formError: "That user no longer exists." };
  }

  try {
    await setUserPassword(id, password);
  } catch (error) {
    console.error("Could not set the password", error);
    return {
      fieldErrors: {},
      formError: "Could not set the password. Try again.",
    };
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

  const users = await readUsers();
  const target = users.find((user) => user.id === id);
  if (!target) return "That user no longer exists.";
  if (target.id === session.id) {
    return "That is you. Removing your own account would sign you out of the only screen that could put it back.";
  }
  // The last admin going is the same lock-out by a slower route: nobody left
  // who can add anyone, reset a password or put an admin back.
  if (
    target.role === "admin" &&
    users.filter((user) => user.role === "admin").length <= 1
  ) {
    return "That is the only admin. Make somebody else an admin first.";
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

  const users = await readUsers();
  const target = users.find((user) => user.id === id);
  if (!target) return "That user no longer exists.";
  if (target.id === session.id && role !== "admin") {
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
