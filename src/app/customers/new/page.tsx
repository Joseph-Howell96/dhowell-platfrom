import type { Metadata } from "next";
import Link from "next/link";

import CustomerForm from "./customer-form";

export const metadata: Metadata = {
  title: "Add customer",
};

export default function NewCustomerPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link
        href="/customers"
        className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        ← Back to customers
      </Link>
      <h1 className="mt-4 mb-8 text-3xl font-bold tracking-tight">
        Add customer
      </h1>
      <CustomerForm />
    </main>
  );
}
