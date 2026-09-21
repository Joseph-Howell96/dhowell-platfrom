import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import Logo from "./logo";
import SignInForm from "./sign-in-form";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * The page they were heading for before being sent here, if any.
 *
 * Only a path from this app is ever returned. A search parameter is whatever
 * somebody put in the address bar, so a full URL here would let a link like
 * /login?next=https://not-us.example send a person who has just typed their
 * password somewhere else entirely - and it would look, to them, like a normal
 * part of signing in.
 */
function wantedPage(params: Record<string, string | string[] | undefined>) {
  const raw = params.next;
  const wanted = Array.isArray(raw) ? raw[0] : raw;
  if (!wanted) return undefined;
  // A single leading slash, so "//elsewhere.example" - which a browser reads
  // as another site - does not get through.
  return /^\/(?!\/)/.test(wanted) ? wanted : undefined;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await connection();
  // Already signed in: there is nothing to do here.
  if (await readSession()) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="glass w-full max-w-sm rounded-2xl p-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-24 w-24" />
          <h1 className="neon mt-5 text-2xl font-semibold tracking-wide text-accent">
            Dennis
          </h1>
          <p className="mt-1 text-sm text-muted">D Howell &amp; Sons</p>

          {/* For Dad, who has not seen this screen before. The arrow points at
              the username box directly underneath it, so the two must stay in
              this order: sign-post, then arrow, then the form. */}
          <p className="neon mt-6 text-sm font-bold tracking-widest text-accent">
            DAD SIGN IN HERE
          </p>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-2 h-9 w-5 text-accent"
          >
            <path d="M12 3 v29" />
            <path d="M5 25 l7 8 7-8" />
          </svg>
        </div>

        <SignInForm next={wantedPage(await searchParams)} />

        <p className="mt-6 text-center text-xs text-muted">
          Forgotten your password? Ask an administrator to set you a new one.
        </p>
      </div>
    </main>
  );
}
