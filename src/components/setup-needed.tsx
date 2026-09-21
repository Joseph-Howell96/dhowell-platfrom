/**
 * What shows when the app has no database to talk to.
 *
 * Deliberately a plain page rather than an error: nothing is broken, something
 * has not been filled in yet, and those want different words. It names the
 * settings that are missing and where they go, because the alternative - which
 * is what this replaces - was a blank screen with a number on it.
 *
 * It is safe to name these out loud. They are the names of the settings, never
 * their values, and the names are in the example file in the repository
 * anyway.
 */
export default function SetupNeeded({ missing }: { missing: string[] }) {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="glass w-full max-w-lg rounded-2xl p-8">
        <h1 className="text-xl font-semibold">Dennis is not connected yet</h1>
        <p className="mt-2 text-sm text-muted">
          The app is running, but it has not been told where its database is.
          Nothing is broken — {missing.length === 1 ? "one setting is" : "these settings are"}{" "}
          missing:
        </p>

        <ul className="mt-4 space-y-1.5">
          {missing.map((name) => (
            <li
              key={name}
              className="rounded-lg bg-elevated px-3 py-2 font-mono text-sm"
            >
              {name}
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-3 text-sm">
          <p>
            <span className="font-medium">On your own machine:</span> put{" "}
            {missing.length === 1 ? "it" : "them"} in{" "}
            <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs">
              .env.local
            </code>
            , copying{" "}
            <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs">
              .env.example
            </code>
            , then start it again.
          </p>
          <p>
            <span className="font-medium">On Vercel:</span> Project → Settings →
            Environment Variables. Then <strong>redeploy</strong> — these are
            read while the app is being built, so a build that has already
            finished will not pick up a value added afterwards.
          </p>
          <p className="text-muted">
            The values come from your Supabase project, under Project Settings →
            API. Step 3 of <code className="font-mono text-xs">DEPLOY.md</code>{" "}
            says which is which.
          </p>
        </div>
      </div>
    </main>
  );
}
