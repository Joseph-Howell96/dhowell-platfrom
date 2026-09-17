import type { Metadata } from "next";
import Link from "next/link";

import PageHeader from "@/components/page-header";
import OutletForm from "./outlet-form";

export const metadata: Metadata = {
  title: "Add outlet",
};

export default function NewOutletPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <Link
        href="/outlets"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Back to outlets
      </Link>
      <div className="mt-4">
        <PageHeader title="Add outlet" />
      </div>
      <OutletForm />
    </main>
  );
}
