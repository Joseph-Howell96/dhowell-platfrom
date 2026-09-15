import { redirect } from "next/navigation";

/**
 * Dennis has no separate front page: opening the app drops you straight on
 * the dashboard, the same as clicking the first item in the sidebar.
 */
export default function Home() {
  redirect("/dashboard");
}
