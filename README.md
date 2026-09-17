# Dennis

The internal platform for **D Howell & Sons**, a UK waste management business.

Built with [Next.js](https://nextjs.org), TypeScript and Tailwind CSS.

## Running it on your computer

You need [Node.js](https://nodejs.org) installed first (version 20 or newer).

Then, in a terminal, from this folder:

```bash
npm install   # downloads the code this project depends on (only needed once)
npm run dev   # starts the site on your machine
```

Open <http://localhost:3000> in a browser. Save a file and the page updates by itself.

Press `Ctrl+C` in the terminal to stop it.

## Sections

All six sidebar sections do something.

| Address | What it does |
| --- | --- |
| `/dashboard` | Totals for the year, a monthly billings chart and a breakdown by material. Opening the app lands here. |
| `/clients` | Lists every client with their contact details and rate lines. |
| `/clients/new` | Form for adding a client. |
| `/outlets` | Reprocessors we sell material on to, and what they pay per tonne. |
| `/outlets/new` | Form for adding an outlet. |
| `/calendar` | Month view of jobs, colour-coded by status. Click a day to book. |
| `/calendar/new` | Form for booking a job. |
| `/finance` | Money in and money out, with due dates and anything overdue in red. |
| `/invoices` | Every invoice raised, with what is outstanding and overdue. |
| `/invoices/new` | Raise an invoice covering a week's jobs for one client. |
| `/invoices/[id]` | The invoice itself. |
| `/invoices/[id]/pdf` | Builds the PDF, files a copy, and opens it. |
| `/settings` | The company's own details, as they belong on an invoice. |

Clients are saved to `data/clients.json` and jobs to `data/jobs.json`, plain
text files you can open and read. There is no database yet.

Two things are stored in a deliberate way:

- **Rates are whole pence** (£85.50 is `8550`). Computers handle decimals
  imprecisely, which would cause rounding errors once invoices add figures up.
- **Job dates are plain text** (`"2026-09-16"`), not points in time. A job
  booked for the 16th stays on the 16th whatever the clocks are doing.

A client's rate lines set what they are charged or paid. **One row per material
and skip size**, holding both figures at once:

| Field | What it is |
| --- | --- |
| Material | Wood, general rubbish, and so on |
| Skip size | Blank means the rate applies whatever size turns up |
| Rate per tonne | What the material itself is worth |
| Haulage rate | What we charge to come and collect it |
| Direction | **Charge** or **Rebate** — applies to the tonnage rate only |

Either rate can be left empty: a material we only haul has no tonnage rate, and
a tonnage rate with no haulage means the lorry is not charged separately.

Haulage is always charged to the client, never paid to them, whichever way the
material runs. A haulage rate filed under the material "Haulage" applies to
everything, so one rate can cover the lot instead of being repeated.

A rate for the exact skip size wins over one left blank. Where neither matches,
the job goes unpriced and shows a dash rather than being charged at the wrong
size. Sizes are free text, matched ignoring capitals and stray spaces but not
wording.

A job can charge haulage as well as its material - one lorry movement is one
job, so both sit on the same record. On a rebate job the material is settled by
purchase order and never reaches a sales invoice, but the haulage does, as a
line of its own.

**Charge jobs — money in**

| Status | Colour | What it means |
| --- | --- | --- |
| Booked | Blue | In the diary, not done yet |
| Weighed | Violet | Weighbridge ticket in. Records the weight in tonnes. |
| Generate invoice | Amber | Ready to invoice, not sent |
| Invoice sent | Green | Records the date sent, and works out the due date |

**Rebate jobs — money out**

| Status | Colour | What it means |
| --- | --- | --- |
| Booked | Blue | In the diary, not done yet |
| Weighed | Violet | Weighbridge ticket in. Records the weight in tonnes. |
| PO raised | Cyan | Records our PO number, its date, and their invoice reference |
| Paid | Grey | Records the date we paid them |

Switching a job between the two moves it to the matching stage on the other
path, so a job three steps along stays three steps along.

- **Weights are whole kilograms** (2.45 tonnes is `2450`), for the same reason
  as pence.
- **An invoice covers a week's jobs for one client**, since that is how billing
  runs. It stores which jobs it covers, not a copy of their figures, so
  correcting a weight or a rate corrects the invoice. The invoice number is the
  one thing fixed for good. Marking an invoice sent moves every job on it to
  "invoice sent", and a job already on an invoice cannot be billed again.
- **Invoice lines spell out the tonnage**: the quantity reads "6.75 t" and the
  unit price "£110.00 per tonne", so a client can check the sum rather than
  ringing up about it. A plain skip size reads "40 yard skip"; anything already
  naming itself, like a RoRo or a grab lorry, is left as typed.
- **Opening an invoice's PDF files a copy of it**, under `data/invoices`. There
  is no way to send one without a copy being kept. Finance lists them grouped
  by client, so a client's paperwork is in one place. A draft is rebuilt each
  time it is opened, since it is still changing; once an invoice is sent the
  saved file is served untouched, so what the client received stays on record
  even if a rate is corrected later.
- **Where an invoice stands is worked out, not chosen.** It is a Draft until
  marked sent, then **Due** (amber) or **Overdue** (red) depending on the date,
  with the days late shown. **Paid** (green) is the one thing set by hand, and
  records the day it was marked. Due and overdue are deliberately not offered
  as buttons: a status set by hand would sooner or later disagree with the
  calendar.
- **"Generate invoices" at the end of a week on the calendar** raises that
  week's invoices. Every job that week which is done, priced and not already
  billed is gathered up and split by client, one draft invoice each, filed in
  Finance under that client straight away. It says how many jobs are waiting
  before you press it.
- **A week does not have to be over.** What counts is whether a job is done,
  not whether the week has finished, so a week part way through can be billed
  early for whatever is already weighed. Jobs still only booked wait for the
  next run.
- Pressing it twice does nothing the second time: a job already on an invoice
  is skipped, checked against what invoices actually hold rather than a flag on
  the job that could fall out of step.
- **Clients can be edited and archived.** Archiving keeps the record - their
  jobs and invoices still name them - but takes them out of the lists and out
  of the boxes you pick a client from. A job already booked against an archived
  client still shows them, so saving it cannot lose the link.
- **VAT is charged on the whole invoice** at the rate set under Settings,
  rounded to the penny once on the total rather than line by line.
- **Our invoices fall due a set number of calendar days after the invoice
  date**, the same for every client. The number is edited under Settings, not
  written into the code; it starts at 14. Weekends and bank holidays are not
  skipped, so 14-day terms on an invoice sent on the 1st fall due on the 15th
  whatever day that lands on. Changing it moves the due date on every invoice,
  including ones already sent.
- **What we owe a client** for material bought off them is separate, and falls
  due on the payment terms recorded against that client, counted from the date
  the purchase order went out. Bank holidays are worked out from the rules
  rather than typed in, so they stay right in future years. One-offs like a
  jubilee have to be added by hand, in `src/lib/working-days.ts`.
- **Margin on a rebate job is material income, less the rebate, less haulage.**
  The income comes from the outlet's rate per tonne for that material against
  the recorded weight, so picking the outlet on the job prices it. A one-off
  figure typed against the job wins over the outlet's standing rate. Haulage is
  recorded per load.
- **Margin on a charge job is what the client is invoiced, less disposal.** The
  disposal cost is recorded per load; a client's rate cannot supply it.
- Jobs missing one of those figures count towards revenue but are left out of
  profit and margin, and the dashboard says how many. Treating a blank as zero
  would report every job as pure profit.
- **Invoice amounts are not stored.** They are worked out each time from the
  client's rate line for that material: a per-tonne rate multiplied by the
  recorded weight, anything else taken as a flat fee. Correcting a rate on the
  client record corrects every job priced off it. Where no rate matches the
  material, the amount shows as a dash.

## Where things live

| Path | What it is |
| --- | --- |
| `src/app/` | One folder per screen. The folder name is the web address. |
| `src/app/layout.tsx` | The wrapper around every page: the sidebar, fonts, page title. |
| `src/app/globals.css` | Every colour in the app, defined once at the top. |
| `src/components/` | Pieces shared between screens: the sidebar, icons, headings. |
| `src/lib/` | The shared logic: data types, saving and loading, formatting. |
| `data/clients.json` | The client records. Back this up. |
| `data/jobs.json` | The booked jobs. Back this up. |
| `data/outlets.json` | The outlets and their material income. Back this up. |
| `data/settings.json` | The company's own details, VAT rate and payment terms. |
| `data/invoices.json` | The invoices raised. Back this up. |
| `data/invoices/` | The generated PDFs. Not kept in git; made from the records. |
| `public/` | Images and files served as-is (e.g. `/logo.png`). |
| `package.json` | Project settings and the list of commands below. |

Adding a new screen: create `src/app/reports/page.tsx` and it becomes
`/reports`. Add it to the `NAV` list in `src/components/sidebar.tsx` to put it
in the sidebar.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the site locally while you work on it. |
| `npm run build` | Packages the site for going live. |
| `npm start` | Runs the packaged version (run `build` first). |
| `npm run lint` | Checks the code for common mistakes. |
