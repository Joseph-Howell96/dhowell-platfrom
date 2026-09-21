import "server-only";

/**
 * Is the app actually wired up to a database?
 *
 * Worth its own check, ahead of everything else, because of how this fails
 * otherwise. A missing setting throws from deep inside a page, and Next in
 * production quite rightly refuses to put the reason on screen - so what a
 * person sees is a blank error with a number on it, while the one sentence
 * that would have explained it sits in a server log they have to go and find.
 *
 * Three names checked here, against the commonest way each goes wrong: not
 * set at all, or set on Vercel after the build that needed them had already
 * run.
 */
export const REQUIRED_SETTINGS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/** The ones still missing. Empty means everything is there. */
export function missingSettings(): string[] {
  return REQUIRED_SETTINGS.filter((name) => !process.env[name]?.trim());
}
