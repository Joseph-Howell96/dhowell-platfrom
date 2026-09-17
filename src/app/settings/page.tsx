import type { Metadata } from "next";
import { connection } from "next/server";

import { requireSession } from "@/lib/guard";

import PageHeader from "@/components/page-header";
import { missingForInvoice, readSettings } from "@/lib/settings";
import SettingsForm from "./settings-form";
import UsersPanel from "./users-panel";
import { readUsers } from "@/lib/users";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  // Read the file on every visit, so the form always opens on what is saved.
  await connection();
  const session = await requireSession("/settings");
  const [settings, users] = await Promise.all([readSettings(), readUsers()]);
  const missing = missingForInvoice(settings);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Settings"
        description="The company's own details, as they belong on an invoice."
      />

      {missing.length > 0 ? (
        <p className="mb-6 glass rounded-lg px-4 py-3 text-sm text-muted">
          Still to fill in before an invoice would look right:{" "}
          <span className="text-ink">{missing.join(", ")}</span>. Saving part of
          it now is fine.
        </p>
      ) : null}

      <SettingsForm settings={settings} />

      <section className="mt-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="mt-1 text-sm text-muted">
            Who can sign in, and what they see. Admin sees everything; a
            standard user sees clients and the calendar, and Finance is not on
            their sidebar or reachable by typing the address.
          </p>
        </div>
        <UsersPanel users={users} signedInAs={session.username} />
      </section>
    </main>
  );
}
