"use client";

/**
 * The user list on Settings: who can sign in, and what they can see.
 *
 * A demo, so nobody has a password. What a user record decides is which
 * screens are drawn - see users.ts, which says what would have to change
 * before this is real.
 */
import { useActionState, useState, useTransition } from "react";

import Select from "@/components/select";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { ROLES, ROLE_HINTS, ROLE_LABELS, type Role } from "@/lib/roles";
import { changeUserRole, createUser, removeUser } from "@/lib/user-actions";
import type { User } from "@/lib/users";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";

/** One row: who they are, what they can see, and a way to remove them. */
function Row({ user, isYou }: { user: User; isYou: boolean }) {
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  function run(action: () => Promise<string | null>) {
    setProblem(null);
    startTransition(async () => {
      const reason = await action();
      setProblem(reason);
      if (!reason) setAsking(false);
    });
  }

  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {user.username}
            {isYou ? <span className="ml-2 text-xs text-muted">you</span> : null}
          </span>
          {user.displayName ? (
            <span className="block truncate text-xs text-muted">
              {user.displayName}
            </span>
          ) : null}
        </span>

        <Select
          aria-label={`Role for ${user.username}`}
          className={`${inputClass} w-40 shrink-0`}
          value={user.role}
          disabled={pending}
          onChange={(event) =>
            run(() => changeUserRole(user.id, event.target.value as Role))
          }
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>

        {asking ? (
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => removeUser(user.id))}
              className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Removing…" : "Yes, remove"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAsking(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-danger/50 hover:text-danger"
          >
            Remove
          </button>
        )}
      </div>

      {problem ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </li>
  );
}

export default function UsersPanel({
  users,
  signedInAs,
}: {
  users: User[];
  signedInAs: string;
}) {
  const [state, formAction, pending] = useActionState(
    createUser,
    EMPTY_FORM_STATE,
  );
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("standard");

  return (
    <div className="space-y-4">
      {users.length === 0 ? (
        <div className="glass-dashed rounded-xl px-6 py-10 text-center">
          <p className="font-medium">Nobody on the list yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Anyone can sign in while this list is empty, and they get admin.
            Add the people who should be here and everybody else drops to what
            their record says.
          </p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-xl">
          <ul className="divide-y divide-line">
            {users.map((user) => (
              <Row
                key={user.id}
                user={user}
                isYou={
                  user.username.toLowerCase() === signedInAs.toLowerCase()
                }
              />
            ))}
          </ul>
        </div>
      )}

      <form
        action={formAction}
        noValidate
        className="rounded-lg border border-line bg-elevated/40 p-4"
      >
        <p className="mb-3 text-sm font-medium">Add someone</p>

        {state.formError ? (
          <p
            role="alert"
            className="mb-3 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {state.formError}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_12rem_auto] sm:items-start">
          <div>
            <label className={labelClass} htmlFor="newUsername">
              Username
            </label>
            <input
              id="newUsername"
              name="username"
              className={inputClass}
              placeholder="dave"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            {state.fieldErrors.username ? (
              <p className={errorClass}>{state.fieldErrors.username}</p>
            ) : null}
          </div>

          <div>
            <label className={labelClass} htmlFor="newDisplayName">
              Name <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="newDisplayName"
              name="displayName"
              className={inputClass}
              placeholder="Dave Marsh"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="newRole">
              Role
            </label>
            <Select
              id="newRole"
              name="role"
              className={inputClass}
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {ROLES.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </Select>
            {state.fieldErrors.role ? (
              <p className={errorClass}>{state.fieldErrors.role}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50 sm:mt-7"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>

        <p className="mt-3 text-xs text-muted">
          {ROLE_LABELS.admin}: {ROLE_HINTS.admin.toLowerCase()}.{" "}
          {ROLE_LABELS.standard}: {ROLE_HINTS.standard.toLowerCase()}.
        </p>
      </form>
    </div>
  );
}
