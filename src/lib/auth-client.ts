import "server-only";

/**
 * The connection that knows who is signed in.
 *
 * Separate from db.ts on purpose, and holding a different key. That one is the
 * service role and answers "what does the database say"; this one is the
 * public key, carries whoever's session is in the request's cookies, and
 * answers "who is asking". Keeping them apart means a query can never
 * accidentally run as nobody, and a sign-in can never accidentally run as
 * everybody.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Turn what somebody types into what Supabase Auth wants.
 *
 * Supabase is built around e-mail addresses. This app signs people in by
 * name - drivers do not all have a work e-mail, and the iPad in the cab is
 * shared - so each username is given an address in a domain that does not
 * exist and cannot receive anything. Nobody ever sees it or types it.
 *
 * The domain is deliberately unroutable. An address here must never be a real
 * inbox somewhere: a password reset link or a confirmation mail escaping to an
 * actual person would be worse than no e-mail at all.
 */
export const LOGIN_DOMAIN = "dhowell.invalid";

/** The address behind a username. Lower case, so capitals never make two people. */
export function loginEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`;
}

/** The username behind an address, for reading a session back out. */
export function usernameFromEmail(email: string | undefined): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  return at === -1 ? email : email.slice(0, at);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Signing in cannot work without it - add it to ` +
        `the environment (locally in .env.local, on Vercel in the project's ` +
        `Environment Variables).`,
    );
  }
  return value;
}

/**
 * A Supabase client for this request, reading and writing the session cookies.
 */
export async function authClient() {
  const jar = await cookies();

  return createServerClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(incoming) {
          try {
            for (const { name, value, options } of incoming) {
              jar.set(name, value, options);
            }
          } catch {
            // A Server Component is not allowed to set cookies, and rendering
            // one is the commonest reason to be here. Nothing is lost: the
            // proxy refreshes the session on the way in, before any of this
            // renders, so the cookies are already current by now.
          }
        },
      },
    },
  );
}
