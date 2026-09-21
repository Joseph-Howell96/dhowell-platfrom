# Putting Dennis live

Seven steps. Read step 1 before you start — it is the one that is annoying to
undo.

---

## 1. A Supabase project of its own

**Not** one an existing app is using.

Dennis has tables called `customers`, `jobs`, `invoices` and `settings`. Those
are ordinary names, and any other app in the same project stands a fair chance
of having used one already. The good outcome is that the schema refuses to run.
The bad one is that it does run, and two apps quietly share a table until the
day one of them deletes a row the other needed.

So: **New project**, and pick a region near you (London, `eu-west-2`, if it is
offered). Give it a database password and keep it somewhere — Supabase will not
show it to you again.

---

## 2. Run the schema

Supabase dashboard → **SQL Editor** → **New query**. Paste the whole of
`supabase/schema.sql` in and run it.

It makes the tables, the two storage buckets, and every rule that matters:

| Rule | What it stops |
|---|---|
| `unique (job_id)` on `invoice_jobs` | The same load being billed on two invoices |
| `number` unique on `invoices` | An invoice number being reused after one is withdrawn |
| `jobs_complete_needs_a_weight` | A job signed off without a weighbridge ticket |
| `settings_is_a_singleton` | A second set of company details appearing |
| `receipts_vat_fits_inside_the_total` | More VAT on a receipt than there is money |

These are enforced by the database, not by the app. That means they hold even
if somebody edits a row by hand in the Supabase table editor.

If it runs without complaint, you should see the tables under **Table Editor**,
and `receipts` and `invoices` under **Storage**.

---

## 3. Collect three keys

Supabase dashboard → **Project Settings** → **API**.

| Setting | Where it comes from | Safe in public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Yes — it is an address |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key | Yes — it can read nothing |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key | **No. Never.** |

The third one goes through every security rule in the database. Anyone holding
it can read or delete anything in the project. It must never be committed, and
it must never be given a `NEXT_PUBLIC_` prefix — that prefix is precisely what
tells Next.js to bundle a value into the JavaScript it sends to browsers.

---

## 4. Try it on your own machine first

```bash
cp .env.example .env.local
```

Open `.env.local`, paste the three values in, then:

```bash
npm install
npm run dev
```

Go to <http://localhost:3000>. You will be sent to the sign-in screen and you
will not be able to get past it, because nobody exists yet. That is step 5.

---

## 5. Make the first admin

An empty database has no users, so nobody can sign in, so nobody can reach the
screen where users are added. This breaks that circle once, from outside:

```bash
node scripts/create-admin.mjs joseph "Joseph Howell"
```

It asks for a password twice. It does not take one as an argument, because
arguments end up in your shell history.

Now sign in as `joseph`. Everybody else — including your dad — you add from
**Settings**, each with a username, a role and a password you set and tell them
yourself.

There is no "forgot my password" e-mail. The addresses behind these accounts
are not real inboxes, deliberately. If somebody forgets theirs, you set a new
one on Settings.

Fill in **Settings → Company details** while you are there. Invoices are built
from them, so a blank address means a blank address on the invoice.

---

## 6. Deploy

Merge this branch into `main` and let Vercel build it as usual.

Before it will work, add the same three values in Vercel:
**Project → Settings → Environment Variables**, for **Production**,
**Preview** and **Development**.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the same
values as locally. `SUPABASE_SERVICE_ROLE_KEY` is the one to paste carefully
and not put anywhere else.

Environment variables are read at build time, so if you add them after a build
has already run, **redeploy** or nothing will pick them up.

---

## 7. Check these four things, in this order

1. **Sign in** as `joseph`. Then sign out and try a wrong password — it should
   refuse, and say the same thing whether the username is real or not.
2. **Add a client**, with a rate line on it. Reload the page. It should still
   be there. (On the old version it would not have been.)
3. **Photograph a receipt** on the iPad. It should appear in the list with its
   picture, and the VAT should add up on the total line.
4. **Book a job, weigh it, complete it, generate an invoice**, and open the
   PDF. Then try to change that job's date — it should refuse, and name the
   invoice.

If all four work, it is live.

---

## Things worth knowing

**Money.** Vercel's Hobby plan is not licensed for commercial use, and
Supabase's free tier pauses a project after a week with nothing hitting it and
keeps no backups worth the name. Between them that is roughly £35/month to be
on plans that fit a business. Whether you start there or move to it before real
client data goes in is your call — but do not still be on free tiers the first
time you need a backup.

**Backups.** On Supabase Pro these are daily and automatic. On the free tier
there is effectively nothing. This is the single thing most worth paying for.

**The service role key.** If it ever leaks — pasted into a chat, committed by
accident — rotate it in the Supabase dashboard straight away and update it in
Vercel. Rotating it is quick. Not rotating it is not.

**Sessions last weeks.** So signing in is a rare event, not a daily one. That
is deliberate, for an iPad in a cab.

**The old `data/` folder** is no longer read by anything and is no longer
committed. Everything lives in Postgres now. You can delete it locally whenever
you like.
