"use client";

/**
 * The user list on Settings: who can sign in, what they can see, and their
 * password.
 *
 * This is the only way in. There is no sign-up page and no "forgot my
 * password" e-mail - the addresses behind these accounts are not real inboxes
 * - so an account exists because somebody here made it, and a forgotten
 * password is fixed by somebody here setting a new one.
 */
import { useActionState, useState, useTransition } from "react";

import Select from "@/components/select";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { ROLES, ROLE_HINTS, ROLE_LABELS, type Role } from "@/lib/roles";
import {
  changeUserRole,
  createUser,
  removeUser,
  resetPassword,
} from "@/lib/user-actions";
import type { User } from "@/lib/users";

const inputClass =
  "w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-danger";

/** Setting somebody's password, shown once the row's button is pressed. */
function PasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    resetPassword,
    EMPTY_FORM_STATE,
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // The action comes back with no errors when it worked. Closing the form is
  // done on the way out of a successful submit rather than in an effect
  // watching the state, which would fire again on every later render.
  function submit(formData: FormData) {
    formAction(formData);
    setPassword("");
    setConfirm("");
  }

  return (
    <form
      action={submit}
      noValidate
      className="mt-3 rounded-lg border border-line bg-elevated/40 p-3"
    >
      <input type="hidden" name="userId" value={user.id} />

      {state.formError ? (
        <p role="alert" className={`mb-2 ${errorClass}`}>
          {state.formError}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <div>
          <label className={labelClass} htmlFor={`password-${user.id}`}>
            New password
          </label>
          <input
            id={`password-${user.id}`}
            name="password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {state.fieldErrors.password ? (
            <p className={errorClass}>{state.fieldErrors.password}</p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor={`confirm-${user.id}`}>
            Again
          </label>
          <input
            id={`confirm-${user.id}`}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>

        <div className="flex gap-2 sm:mt-7">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Setting…" : "Set"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        Tell them the new password yourself. Nothing here can e-mail it to them.
      </p>
    </form>
  );
}

/** One row: who they are, what they can see, and a way to remove them. */
function Row({ user, isYou }: { user: User; isYou: boolean }) {
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

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

        <button
          type="button"
          onClick={() => setSettingPassword((open) => !open)}
          aria-expanded={settingPassword}
          className="shrink-0 rounded-lg border border-line px-3 py-2.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink"
        >
          Password
        </button>

        {asking ? (
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => removeUser(user.id))}
              className="rounded-lg bg-danger px-3 py-3 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Removing…" : "Yes, remove"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAsking(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:text-ink"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="shrink-0 rounded-lg border border-line px-3 py-2.5 text-sm text-muted transition-colors hover:border-danger/50 hover:text-danger"
          >
            Remove
          </button>
        )}
      </div>

      {settingPassword ? (
        <PasswordForm user={user} onDone={() => setSettingPassword(false)} />
      ) : null}

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
  signedInId,
}: {
  users: User[];
  signedInId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createUser,
    EMPTY_FORM_STATE,
  );
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("standard");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  function submit(formData: FormData) {
    formAction(formData);
    // Cleared on the way out rather than waiting to hear back. A password left
    // sitting in a box on a shared iPad is the thing worth being quick about.
    setPassword("");
    setConfirm("");
  }

  return (
    <div className="space-y-4">
      {users.length === 0 ? (
        <div className="glass-dashed rounded-xl px-6 py-10 text-center">
          <p className="font-medium">Nobody on the list yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Add the people who need to sign in. Each one gets a username and a
            password you set here and tell them yourself.
          </p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-xl">
          <ul className="divide-y divide-line">
            {users.map((user) => (
              <Row key={user.id} user={user} isYou={user.id === signedInId} />
            ))}
          </ul>
        </div>
      )}

      <form
        action={submit}
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

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_12rem]">
          <div>
            <label className={labelClass} htmlFor="newUsername">
              Username
            </label>
            <input
              id="newUsername"
              name="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          <div>
            <label className={labelClass} htmlFor="newPassword">
              Password
            </label>
            <input
              id="newPassword"
              name="password"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {state.fieldErrors.password ? (
              <p className={errorClass}>{state.fieldErrors.password}</p>
            ) : null}
          </div>

          <div>
            <label className={labelClass} htmlFor="newConfirmPassword">
              Again
            </label>
            <input
              id="newConfirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:opacity-50 sm:mt-7"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>

        <p className="mt-3 text-xs text-muted">
          {ROLE_LABELS.admin}: {ROLE_HINTS.admin.toLowerCase()}.{" "}
          {ROLE_LABELS.standard}: {ROLE_HINTS.standard.toLowerCase()}. Tell them
          their password yourself — nothing here can e-mail it.
        </p>
      </form>
    </div>
  );
}
