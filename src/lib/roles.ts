/**
 * The roles, and what each one can reach.
 *
 * Plain values and one pure function, on purpose: the sidebar runs in the
 * browser and the pages run on the server, and both have to agree on who can
 * see what. Anything here that touched the filesystem or the request would
 * stop the sidebar building.
 */

/** What a signed-in person is allowed to reach. */
export const ROLES = ["admin", "standard"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  standard: "Standard",
};

export const ROLE_HINTS: Record<Role, string> = {
  admin: "Everything, including money and settings",
  standard: "Clients and the calendar only",
};

/**
 * The sections a standard user can open. Admin is not on a list; it is all.
 *
 * Search is on here because everyone can search. What comes back is a
 * different matter: the search page leaves out anything the role could not
 * open, so a standard user searching a client's name is not shown their
 * invoices.
 */
const STANDARD_SECTIONS = ["/clients", "/calendar", "/search"];

/**
 * Is this role allowed on this address?
 *
 * Checked by path rather than by a list of pages, so a screen added under an
 * allowed section is allowed with it and one added anywhere else is not. The
 * sidebar uses it to decide what to show and every page uses it again to
 * decide whether to draw - a hidden link is not a closed door.
 */
export function canOpen(role: Role, pathname: string): boolean {
  if (role === "admin") return true;
  return STANDARD_SECTIONS.some(
    (section) => pathname === section || pathname.startsWith(`${section}/`),
  );
}
