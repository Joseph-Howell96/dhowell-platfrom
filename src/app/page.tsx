import { redirect } from "next/navigation";
import { connection } from "next/server";

import { readSession } from "@/lib/session";

/**
 * Dennis has no separate front page. Opening it drops you wherever you are
 * allowed to start: the dashboard for an admin, the calendar for everybody
 * else, and the sign-in screen for anyone who is not signed in at all.
 */
export default async function Home() {
  await connection();
  const session = await readSession();
  if (!session) redirect("/login");
  redirect(session.role === "admin" ? "/dashboard" : "/calendar");
}
