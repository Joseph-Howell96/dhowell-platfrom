-- Dennis, as tables.
--
-- The app kept everything in JSON files until now. That was fine for one
-- person on one laptop and stops being fine the moment two people use it:
-- saving a record rewrote a whole file, so two edits at once meant one of
-- them silently disappeared. Postgres is here for that as much as for
-- surviving a deploy.
--
-- Money is in whole pence and weight in whole kilograms, both as integers,
-- for the same reason they were in the files: decimals drift, whole numbers
-- do not. Dates that mean a day are `date`, not a timestamp - a job booked
-- for the 16th is on the 16th whatever the clocks are doing.
--
-- Run this once, in the Supabase SQL editor.

-- Row level security is on for every table and no policy is ever granted.
-- Nothing reaches these tables except the app's own server, holding the
-- service role key. The public key that ships to the browser can read
-- nothing, which is what we want: the browser talks to our server, and our
-- server talks to the database.

begin;

-- ---------------------------------------------------------------------------
-- Who we are. One row, and the constraint makes sure it stays one row.
-- ---------------------------------------------------------------------------
create table public.settings (
  id                    boolean primary key default true,
  company_name          text    not null default '',
  address               text    not null default '',
  phone                 text    not null default '',
  email                 text    not null default '',
  vat_number            text    not null default '',
  company_number        text    not null default '',
  bank_account_name     text    not null default '',
  bank_account_number   text    not null default '',
  bank_sort_code        text    not null default '',
  payment_terms_days    integer not null default 14 check (payment_terms_days >= 0),
  vat_percent           numeric not null default 20 check (vat_percent >= 0),
  invoice_number_prefix text    not null default 'INV-',
  invoice_number_start  integer not null default 1001 check (invoice_number_start >= 0),
  constraint settings_is_a_singleton check (id)
);

insert into public.settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table public.customers (
  id                 uuid primary key default gen_random_uuid(),
  business_name      text not null,
  site_address       text not null default '',
  billing_address    text not null default '',
  contact_name       text not null default '',
  phone              text not null default '',
  email              text not null default '',
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0),
  notes              text not null default '',
  -- Every collection carries this. Ten collections in a day is ten lorry
  -- movements, so ten haulage charges. Not a tickbox and never null: a client
  -- who is not charged for haulage has a fee of zero, said out loud.
  haulage_fee_pence  integer not null default 0 check (haulage_fee_pence >= 0),
  -- Archiving hides a client without removing them, because their old jobs
  -- and invoices still name them and deleting would break those.
  archived_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index customers_active_idx on public.customers (business_name)
  where archived_at is null;

-- What a client is charged or paid for one material, per tonne.
create table public.rate_lines (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.customers (id) on delete cascade,
  material             text not null,
  -- Null where the material is known but nobody has set a price yet. A job
  -- using it is then complete but not billable, which the app says out loud
  -- rather than quietly charging nothing.
  rate_per_tonne_pence integer check (rate_per_tonne_pence >= 0),
  direction            text not null check (direction in ('charge', 'pay')),
  -- One rate per material per client. Two rows for the same material is a
  -- question with two answers.
  unique (customer_id, material)
);

create index rate_lines_customer_idx on public.rate_lines (customer_id);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table public.jobs (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.customers (id) on delete restrict,
  site_address         text not null default '',
  job_date             date not null,
  material             text not null default '',
  notes                text not null default '',
  -- In the diary, weighed, checked off. Whether it has been invoiced is not
  -- here: that is true because it appears on an invoice, and the join table
  -- below is the only place it is written down.
  status               text not null default 'booked'
                         check (status in ('booked', 'weighed', 'complete')),
  -- Whole kilograms. 2.45 tonnes is 2450. Null until it has been weighed.
  weight_kg            integer check (weight_kg >= 0),
  direction            text not null default 'sale'
                         check (direction in ('sale', 'purchase')),

  -- Paperwork that follows a rebate job being checked off. None of it is a
  -- status: a job is not less done for an order not being raised yet.
  supplier_po          text,
  po_raised_date       date,
  supplier_invoice_ref text,
  paid_date            date,

  -- The other half of each sum, which no rate line can tell us. Null means
  -- nobody has recorded it, which is not the same as nothing: profit is left
  -- unknown rather than overstated.
  disposal_cost_pence  integer,
  haulage_cost_pence   integer,
  onward_sale_pence    integer,

  created_at           timestamptz not null default now(),

  -- Complete means someone checked the weighbridge ticket, so there has to be
  -- one. This is the rule the app enforces on the job form, kept here as well
  -- so it holds however the row is written.
  constraint jobs_complete_needs_a_weight
    check (status <> 'complete' or weight_kg is not null)
);

create index jobs_by_day_idx on public.jobs (job_date);
create index jobs_by_customer_idx on public.jobs (customer_id);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  -- Unique across every invoice there has ever been, withdrawn ones included:
  -- a number that went out is never given to another document.
  number       integer not null unique,
  customer_id  uuid not null references public.customers (id) on delete restrict,
  issue_date   date not null,
  customer_po  text not null default '',
  status       text not null default 'draft'
                 check (status in ('draft', 'sent', 'paid')),
  paid_date    date,
  -- When the PDF was last written out. Once an invoice is sent the saved file
  -- is served as it was, so what the client received stays on record.
  pdf_saved_at timestamptz,
  -- Deleting an invoice sets this rather than removing the row. It comes out
  -- of what is owed and off the client's list, but a bookkeeper can still
  -- account for a number that was issued and withdrawn.
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),

  constraint invoices_paid_has_a_date
    check (status <> 'paid' or paid_date is not null)
);

create index invoices_live_idx on public.invoices (issue_date)
  where deleted_at is null;

-- Which jobs an invoice covers. A table rather than a list on the invoice,
-- because of the unique constraint: it is what makes "a job can never be
-- invoiced twice" a fact about the database rather than a promise the code
-- makes. Deleting an invoice for good frees its jobs; withdrawing one leaves
-- the rows in place, which is why restoring can find them again.
create table public.invoice_jobs (
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  job_id     uuid not null references public.jobs (id) on delete cascade,
  primary key (invoice_id, job_id),
  unique (job_id)
);

create index invoice_jobs_by_job_idx on public.invoice_jobs (job_id);

-- ---------------------------------------------------------------------------
-- People
--
-- Supabase Auth owns who somebody is - their e-mail, their password, resetting
-- it. This table owns only what they are allowed to see, which is ours to
-- decide. One row per sign-in, gone when the account is.
-- ---------------------------------------------------------------------------
create table public.app_users (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role         text not null default 'standard'
                 check (role in ('admin', 'standard')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shut every door. No policies are added on purpose: with row level security
-- on and nothing granted, the anon key that ships to the browser can read and
-- write nothing at all. Only the server, holding the service role key, gets
-- through - and the server is where every rule in this app already lives.
-- ---------------------------------------------------------------------------
alter table public.settings     enable row level security;
alter table public.customers    enable row level security;
alter table public.rate_lines   enable row level security;
alter table public.jobs         enable row level security;
alter table public.invoices     enable row level security;
alter table public.invoice_jobs enable row level security;
alter table public.app_users    enable row level security;

commit;
