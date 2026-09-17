import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import CustomerForm from "@/components/customer-form";
import PageHeader from "@/components/page-header";
import { saveCustomer } from "@/lib/actions";
import { readCustomers } from "@/lib/customers";

export const metadata: Metadata = {
  title: "Edit client",
};

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await connection();

  const { clientId } = await params;
  const customer = (await readCustomers()).find((c) => c.id === clientId);
  if (!customer) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10">
      <Link
        href="/clients"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Back to clients
      </Link>
      <div className="mt-4">
        <PageHeader
          title={customer.businessName}
          description="Changing a rate changes every job priced off it, including ones already invoiced but not yet sent."
        />
      </div>
      <CustomerForm
        action={saveCustomer}
        submitLabel="Save changes"
        customer={customer}
      />
    </main>
  );
}
