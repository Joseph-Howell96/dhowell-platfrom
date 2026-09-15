import type { Metadata } from "next";

import Placeholder from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Finance",
};

export default function FinancePage() {
  return (
    <Placeholder
      title="Finance"
      description="Invoices, payments and supplier costs will appear here."
    />
  );
}
