import "server-only";

/**
 * The connection to the database.
 *
 * There is one client here and it holds the service role key, which goes
 * through row level security rather than being checked by it. That sounds
 * alarming and is deliberate: every rule in this app - who may see the rate
 * card, who may delete an invoice, whether a job can be moved once it is
 * billed - is already written in the server actions, in one place, in plain
 * TypeScript that can say why it refused. Writing those rules a second time
 * in SQL would mean two sets of rules to keep in step, and the day they
 * disagree is the day one of them is wrong.
 *
 * What makes that safe is that this key never leaves the server. The
 * `server-only` import at the top is not decoration: it makes the build fail
 * if any of this is ever pulled into a file that ships to a browser. The
 * database itself has row level security on with no policies granted, so the
 * public key the browser does get can read nothing at all.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A setting that has to be there, read at the moment it is used.
 *
 * Read lazily rather than at the top of the file on purpose. Next builds
 * pages ahead of time, and a missing variable at build time would fail the
 * build of screens that never touch the database. Read here, a missing one
 * fails the request that actually needed it, and says which one is missing.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. The app cannot reach the database without it - ` +
        `add it to the environment (locally in .env.local, on Vercel in the ` +
        `project's Environment Variables).`,
    );
  }
  return value;
}

let client: SupabaseClient | null = null;

/** The database, for server code. Made once and reused. */
export function db(): SupabaseClient {
  if (client) return client;
  client = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        // This client is for data, not for people. It must never pick up
        // whoever happens to be signed in, or write a session anywhere.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  return client;
}

/**
 * Complain properly when a query fails.
 *
 * Supabase hands back errors rather than throwing them, which is easy to read
 * past: forget the check and a failed read looks exactly like an empty table.
 * Everything in this app goes through here so that a broken query stops, loudly
 * and with the name of the thing it was doing attached.
 */
export function orThrow<T>(
  what: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error) {
    throw new Error(`${what} failed: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`${what} returned nothing.`);
  }
  return result.data;
}
