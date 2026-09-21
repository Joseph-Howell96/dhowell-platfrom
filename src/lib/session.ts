import "server-only";

/**
 * Who is signed in, for the current request.
 *
 * This used to be a cookie holding a name, with no password checked anywhere -
 * and, worse, a name nobody recognised was let in as an admin. That was fine
 * for a demo on one laptop and is not fine anywhere a real client list lives.
 *
 * Now it is a signed token from Supabase Auth, and two things have to be true
 * before anyone is anybody: the token has to check out, and there has to be a
 * row on the user list for the account it names. The second is what closes the
 * old hole. An account can exist in Auth and mean nothing here; no row, no
 * session, no way in.
 */
import { cache } from "react";

import { authClient, usernameFromEmail } from "./auth-client";
import type { Role } from "./roles";
import { findUserById } from "./users";

export type Session = {
  username: string;
  displayName: string;
  role: Role;
  /** The account id, for the rare case somebody has to be told from themselves. */
  id: string;
};

/**
 * The session on this request, or null when nobody is signed in.
 *
 * `getUser` rather than `getSession` on purpose. The second reads the cookie
 * and believes it; the first checks the token against Supabase before
 * answering. A cookie is something the browser hands us and anyone can hand us
 * one, so believing it is how you end up signed in as whoever you fancy.
 *
 * Wrapped in React's `cache` because that checking costs two round trips - one
 * to Auth, one to the user list - and this is asked several times over while a
 * single page is being built: once by the layout to draw the sidebar, again by
 * the page itself, which checks for itself rather than trusting the sidebar to
 * have hidden the link. `cache` makes those one lookup per request. It is
 * scoped to the request and nothing else, so nobody ever sees a session that
 * belonged to somebody else's.
 */
export const readSession = cache(async function readSession(): Promise<Session | null> {
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  // No row on the user list means no access, whatever Auth says. Removing
  // somebody takes the auth account with it, so this is belt and braces -
  // but it is the brace that matters, because it fails shut.
  const user = await findUserById(data.user.id);
  if (!user) return null;

  return {
    id: user.id,
    username: user.username || usernameFromEmail(data.user.email),
    displayName: user.displayName || user.username,
    role: user.role,
  };
});
