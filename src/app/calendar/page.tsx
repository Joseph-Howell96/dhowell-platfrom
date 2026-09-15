import type { Metadata } from "next";

import Placeholder from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Calendar",
};

export default function CalendarPage() {
  return (
    <Placeholder
      title="Calendar"
      description="Scheduled collections and job planning will appear here."
    />
  );
}
