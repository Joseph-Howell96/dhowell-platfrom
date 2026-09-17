/**
 * Who can sign in, and what they are allowed to see.
 *
 * This is a demo. Nobody's password is checked and nothing is encrypted -
 * signing in only says which role the screens should be drawn for. Before this
 * goes anywhere near a real client list it needs proper authentication, and
 * the shape here is deliberately the shape that would need: a user record with
 * a role, read from a store, resolved once per request.
 */
import { randomUUID } from "node:crypto";

import { ROLES, type Role } from "./roles";
import { readJsonList, writeJsonList } from "./store";

const FILE = "users.json";

export type User = {
  id: string;
  /** What they type to sign in. Compared without regard to case. */
  username: string;
  /** Their name as it reads on screen, where they gave one. */
  displayName: string;
  role: Role;
  createdAt: string;
};

function toUser(raw: unknown): User | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const username =
    typeof record.username === "string" ? record.username.trim() : "";
  if (username === "") return null;
  const role = ROLES.includes(record.role as Role)
    ? (record.role as Role)
    : "standard";
  return {
    id: typeof record.id === "string" ? record.id : randomUUID(),
    username,
    displayName:
      typeof record.displayName === "string" ? record.displayName.trim() : "",
    role,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
  };
}

/** Everyone on the list, admins first and then alphabetically. */
export async function readUsers(): Promise<User[]> {
  const rows = await readJsonList(FILE);
  return rows
    .map(toUser)
    .filter((user) => user !== null)
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
  const users = await readUsers();
  return users.find((user) => user.username.toLowerCase() === wanted) ?? null;
}

export async function addUser(
  details: Omit<User, "id" | "createdAt">,
): Promise<User> {
  const users = await readUsers();
  const user: User = {
    ...details,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await writeJsonList(FILE, [...users, user]);
  return user;
}

/** Remove someone. Returns false where the id matches nobody. */
export async function deleteUser(id: string): Promise<boolean> {
  const users = await readUsers();
  if (!users.some((user) => user.id === id)) return false;
  await writeJsonList(
    FILE,
    users.filter((user) => user.id !== id),
  );
  return true;
}

export async function setUserRole(id: string, role: Role): Promise<boolean> {
  const users = await readUsers();
  if (!users.some((user) => user.id === id)) return false;
  await writeJsonList(
    FILE,
    users.map((user) => (user.id === id ? { ...user, role } : user)),
  );
  return true;
}
