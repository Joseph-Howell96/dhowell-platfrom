import type { Metadata } from "next";

import Placeholder from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <Placeholder
      title="Dashboard"
      description="An overview of jobs, clients and money will appear here."
    />
  );
}
