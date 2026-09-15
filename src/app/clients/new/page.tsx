import type { Metadata } from "next";
import Link from "next/link";

import PageHeader from "@/components/page-header";
import CustomerForm from "./customer-form";

export const metadata: Metadata = {
  title: "Add client",
};

export default function NewClientPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <Link
        href="/clients"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Back to clients
      </Link>
      <div className="mt-4">
        <PageHeader title="Add client" />
      </div>
      <CustomerForm />
    </main>
  );
}
