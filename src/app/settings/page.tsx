import type { Metadata } from "next";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { missingForInvoice, readSettings } from "@/lib/settings";
import SettingsForm from "./settings-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  // Read the file on every visit, so the form always opens on what is saved.
  await connection();
  const settings = await readSettings();
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
    </main>
  );
}
