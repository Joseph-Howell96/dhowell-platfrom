/**
 * Who can sign in, and what they are allowed to see.
 *
 * The work is split in two. Supabase Auth owns identity - the password, the
 * hashing of it, the session token - and this module never sees a password in
 * any form. What lives here is the half that is ours to decide: the name
 * somebody types, the name that reads on screen, and their role.
 *
 * The two halves are joined by id: an `app_users` row has the same id as the
 * auth account it belongs to, and goes when that account does.
 */
import { loginEmail } from "./auth-client";
import { db, orThrow } from "./db";
import { ROLES, type Role } from "./roles";

export type User = {
  id: string;
  /** What they type to sign in. Held lower case, compared lower case. */
  username: string;
  /** Their name as it reads on screen, where they gave one. */
  displayName: string;
  role: Role;
  createdAt: string;
};

type Row = {
  id: string;
  username: string;
  display_name: string | null;
  role: string | null;
  created_at: string;
};

function toUser(row: Row): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? "",
    role: ROLES.includes(row.role as Role) ? (row.role as Role) : "standard",
    createdAt: row.created_at,
  };
}

const COLUMNS = "id, username, display_name, role, created_at";

/** Everyone on the list, admins first and then alphabetically. */
export async function readUsers(): Promise<User[]> {
  const rows = orThrow<Row[]>(
    "Reading the user list",
    await db()
      .from("app_users")
      .select(COLUMNS)
      .order("username")
      .returns<Row[]>(),
  );
  // Sorted the rest of the way here rather than in SQL, because "admins first"
  // is an ordering by meaning, not by the letters in the word.
  return rows
    .map(toUser)
    .sort(
      (a, b) =>
        (a.role === b.role ? 0 : a.role === "admin" ? -1 : 1) ||
        a.username.localeCompare(b.username),
    );
}

/** The person with this username, whatever case it was typed in. */
export async function findUser(username: string): Promise<User | null> {
  const wanted = username.trim().toLowerCase();
  if (wanted === "") return null;
  const { data, error } = await db()
    .from("app_users")
    .select(COLUMNS)
    .eq("username", wanted)
    .maybeSingle<Row>();
  if (error) throw new Error(`Looking up a user failed: ${error.message}`);
  return data ? toUser(data) : null;
}

/** The person behind a signed-in account id. */
export async function findUserById(id: string): Promise<User | null> {
  const { data, error } = await db()
    .from("app_users")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<Row>();
  if (error) throw new Error(`Looking up a user failed: ${error.message}`);
  return data ? toUser(data) : null;
}

/** Is anybody able to sign in yet? Decides whether the first-admin screen shows. */
export async function anyUsersExist(): Promise<boolean> {
  const { count, error } = await db()
    .from("app_users")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`Counting the users failed: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Make an account somebody can sign in with.
 *
 * Two things have to happen and either can fail, so the order matters. The
 * auth account goes first, because it is the one that can refuse - a username
 * already taken, a password too short. If writing the role afterwards fails,
 * the auth account is removed again rather than left behind: an account that
 * can sign in but has no row saying what it may see is a locked door with no
 * handle on either side.
 */
export async function createUser(details: {
  username: string;
  displayName: string;
  role: Role;
  password: string;
}): Promise<User> {
  const username = details.username.trim().toLowerCase();

  const created = await db().auth.admin.createUser({
    email: loginEmail(username),
    password: details.password,
    // Confirmed on the spot. There is no inbox behind these addresses, so a
    // confirmation mail would be a letter to nowhere and the account would
    // never come out of waiting for it.
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(
      `Creating the sign-in failed: ${created.error?.message ?? "no account came back"}`,
    );
  }

  const { data, error } = await db()
    .from("app_users")
    .insert({
      id: created.data.user.id,
      username,
      display_name: details.displayName.trim(),
      role: details.role,
    })
    .select(COLUMNS)
    .single<Row>();

  if (error || !data) {
    await db().auth.admin.deleteUser(created.data.user.id);
    throw new Error(
      `Saving the user failed: ${error?.message ?? "nothing came back"}`,
    );
  }

  return toUser(data);
}

/** Give somebody a new password. Used when one has been forgotten. */
export async function setUserPassword(
  id: string,
  password: string,
): Promise<void> {
  const { error } = await db().auth.admin.updateUserById(id, { password });
  if (error) throw new Error(`Changing the password failed: ${error.message}`);
}

/**
 * Remove someone. Returns false where the id matches nobody.
 *
 * Only the auth account is deleted: the `app_users` row has a foreign key onto
 * it that cascades, so it goes of its own accord. Doing it the other way round
 * would leave an account still able to sign in.
 */
export async function deleteUser(id: string): Promise<boolean> {
  if (!(await findUserById(id))) return false;
  const { error } = await db().auth.admin.deleteUser(id);
  if (error) throw new Error(`Removing the user failed: ${error.message}`);
  return true;
}

export async function setUserRole(id: string, role: Role): Promise<boolean> {
  const { data, error } = await db()
    .from("app_users")
    .update({ role })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Changing the role failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
