import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import Logo from "./logo";
import SignInForm from "./sign-in-form";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
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

        <SignInForm />

        <p className="mt-6 text-center text-xs text-muted">
          Demo only. Any username and password will sign you in, and nothing is
          checked.
        </p>
      </div>
    </main>
  );
}
