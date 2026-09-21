/**
 * Make the first admin.
 *
 * A new database has nobody in it, which means nobody can sign in, which means
 * nobody can reach the screen where people are added. This breaks that circle,
 * once, from the outside.
 *
 * It is a script rather than a page in the app on purpose. A "set up the first
 * admin" screen has to be open to anyone - it runs before there is anybody to
 * check - and it has to decide for itself when to stop being open. Get that
 * wrong, or empty the user table by accident some Tuesday, and the front door
 * is standing open again. Nothing that can do this ships to the server at all.
 *
 * Run it once:
 *
 *   node scripts/create-admin.mjs joseph "Joseph Howell"
 *
 * It asks for the password rather than taking it as an argument, because an
 * argument is kept in your shell history and read by anything that can list
 * processes.
 */
import { createInterface } from "node:readline/promises";
import { readFileSync } from "node:fs";
import { stdin, stdout, argv, exit } from "node:process";

import { createClient } from "@supabase/supabase-js";

/** Read .env.local, so this works the same way the app does. */
function loadEnvFile() {
  let contents;
  try {
    contents = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const line of contents.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

function stop(message) {
  console.error(`\n${message}\n`);
  exit(1);
}

loadEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  stop(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.\n" +
      "Put them in .env.local, or set them for this command:\n\n" +
      "  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.mjs joseph",
  );
}

const username = (argv[2] ?? "").trim().toLowerCase();
const displayName = (argv[3] ?? "").trim();

if (!/^[a-z0-9._-]+$/.test(username)) {
  stop(
    'Give a username: node scripts/create-admin.mjs joseph "Joseph Howell"\n' +
      "Letters, numbers, full stops, dashes and underscores only.",
  );
}

// The same made-up address the app builds - see src/lib/auth-client.ts. A
// domain that cannot receive anything, so a stray e-mail can never reach a
// real person.
const email = `${username}@dhowell.invalid`;

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: taken, error: lookupFailed } = await supabase
  .from("app_users")
  .select("username")
  .eq("username", username)
  .maybeSingle();

if (lookupFailed) {
  stop(
    `Could not reach the database: ${lookupFailed.message}\n` +
      "Check the URL and the service role key, and that the schema has been run.",
  );
}
if (taken) stop(`"${username}" already signs in. Nothing to do.`);

const ask = createInterface({ input: stdin, output: stdout });
const password = await ask.question(`Password for "${username}": `);
const again = await ask.question("Again: ");
ask.close();

if (password.length < 8) stop("A password needs at least 8 characters.");
if (password !== again) stop("Those two do not match.");

const created = await supabase.auth.admin.createUser({
  email,
  password,
  // No inbox behind that address, so a confirmation mail would be a letter to
  // nowhere and the account would sit waiting for it forever.
  email_confirm: true,
});
if (created.error) stop(`Creating the sign-in failed: ${created.error.message}`);

const { error: roleFailed } = await supabase.from("app_users").insert({
  id: created.data.user.id,
  username,
  display_name: displayName,
  role: "admin",
});

if (roleFailed) {
  // Put it back as it was. An auth account with no row on the user list can
  // sign in and then be refused by every screen, which looks like a broken app
  // rather than an account that was never finished.
  await supabase.auth.admin.deleteUser(created.data.user.id);
  stop(`Saving the user failed: ${roleFailed.message}`);
}

console.log(
  `\nDone. "${username}" is an admin.\n` +
    "Sign in with that username and the password you just set, then add everybody else from Settings.\n",
);
