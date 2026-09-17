"use server";

/**
 * Signing in and out.
 *
 * Signing in accepts anything. This is a demo: there is no password to check
 * against, so the form takes a name, writes it to a cookie and sends you in.
 * The password box is there because a sign-in screen without one does not look
 * like a sign-in screen, and it is read and thrown away.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { FormState } from "./form-state";
import { SESSION_COOKIE } from "./session";

export async function signIn(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim();
  if (username === "") {
    return {
      fieldErrors: { username: "Enter a username." },
      formError: null,
    };
  }

  (await cookies()).set(SESSION_COOKIE, username, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // A working day, so a demo left open over lunch is still signed in.
    maxAge: 60 * 60 * 12,
  });

  redirect("/");
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
