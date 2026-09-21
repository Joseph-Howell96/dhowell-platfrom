"use server";

/**
 * Signing in and out.
 *
 * The sign-in form takes a username and a password, and the password is now
 * actually checked - by Supabase Auth, against a hash, with a rate limit in
 * front of it. Nothing in this app ever sees a password in a form it could
 * store, log or compare.
 */
import { redirect } from "next/navigation";

import { authClient, loginEmail } from "./auth-client";
import type { FormState } from "./form-state";
import { findUser } from "./users";

export async function signIn(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (username === "") fieldErrors.username = "Enter your username.";
  if (password === "") fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: null };
  }

  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginEmail(username),
    password,
  });

  if (error) {
    // Deliberately the same message whether the name is unknown or the
    // password is wrong. Saying which would let anyone with the sign-in page
    // work out who has an account here, one guess at a time.
    return {
      fieldErrors: {},
      formError: "That username and password do not match. Try again.",
    };
  }

  // Signed in as far as Auth is concerned, but this app also wants a row on
  // the user list saying what they may see. Without one they would be in a
  // session that every screen refuses, which reads as the app being broken.
  // Better to say plainly that the account is not set up, and sign them back
  // out so they are not left half in.
  if (!(await findUser(username))) {
    await supabase.auth.signOut();
    return {
      fieldErrors: {},
      formError:
        "That sign-in exists but has not been set up on this app. Ask an administrator to add you.",
    };
  }

  redirect(safeNextPage(formData.get("next")));
}

/**
 * Where to land after signing in.
 *
 * Checked here as well as on the way into the form, and for the same reason
 * each time: this arrives as a hidden field, and a hidden field is only a
 * suggestion from whatever posted it. Anything that is not a plain path within
 * this app becomes the home page. Skipping this is how a sign-in screen ends
 * up bouncing somebody, moments after they typed their password, to a copy of
 * itself on a domain that is not ours.
 */
function safeNextPage(value: FormDataEntryValue | null): string {
  const wanted = typeof value === "string" ? value : "";
  // One leading slash and no more: a browser reads "//elsewhere.example" as
  // another site altogether.
  return /^\/(?!\/)/.test(wanted) ? wanted : "/";
}

export async function signOut(): Promise<void> {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/login");
}
