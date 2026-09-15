import type { Metadata } from "next";

import Placeholder from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <Placeholder
      title="Settings"
      description="Users, materials and default rates will be managed here."
    />
  );
}
