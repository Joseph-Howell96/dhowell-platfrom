"use client";

/**
 * The sign-in form. Any details will do - see session-actions.ts.
 */
import { useActionState, useState } from "react";

import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { signIn } from "@/lib/session-actions";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";

export default function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, EMPTY_FORM_STATE);
  // Controlled, as everywhere else here: React clears an uncontrolled field
  // when the form comes back from the server.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} noValidate className="mt-3 space-y-4">
      <div>
        <label className={labelClass} htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          className={inputClass}
          placeholder="joseph"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        {state.fieldErrors.username ? (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.username}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClass} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputClass}
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
