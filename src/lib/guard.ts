/**
 * The check every screen makes before it draws anything.
 *
 * Each page calls this for itself rather than trusting the sidebar to have
 * hidden the link: a hidden link is not a closed door, and typing an address
 * is the first thing anyone does.
 */
import { redirect } from "next/navigation";

import { canOpen } from "./roles";
import { readSession, type Session } from "./session";

/**
 * The session, or a redirect away from here.
 *
 * Signed out goes to the sign-in screen. Signed in but not allowed here goes
 * to the calendar, which everybody can see, rather than to an error - being
 * shown a door you cannot open is no use to anyone.
 */
export async function requireSession(pathname: string): Promise<Session> {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!canOpen(session.role, pathname)) redirect("/calendar");
  return session;
}
