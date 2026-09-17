/**
 * Who is signed in, for the current request.
 *
 * A cookie holding a username, and nothing else. There is no password check
 * anywhere in this app - see users.ts - so this says which role to draw the
 * screens for and makes no claim about who anybody is.
 */
import { cookies } from "next/headers";

import type { Role } from "./roles";
import { findUser } from "./users";

export const SESSION_COOKIE = "dennis.signed-in-as";

export type Session = {
  username: string;
  displayName: string;
  role: Role;
};

/**
 * The session on this request, or null when nobody is signed in.
 *
 * A username that is not on the users list still signs in, as an admin. That
 * is a demo convenience and would be the first thing to go: it means anyone
 * typing an unknown name gets everything. It is here so that a demo cannot
 * lock itself out of the screen where users are added.
 */
export async function readSession(): Promise<Session | null> {
  const username = (await cookies()).get(SESSION_COOKIE)?.value?.trim();
  if (!username) return null;

  const known = await findUser(username);
  return {
    username,
    displayName: known?.displayName || username,
    role: known?.role ?? "admin",
  };
}
