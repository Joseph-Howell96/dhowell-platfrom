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

The sidebar has five sections. Clients, Calendar and Finance work; the rest are stubs.

| Address | What it does |
| --- | --- |
| `/dashboard` | Placeholder. Opening the app lands here. |
| `/clients` | Lists every client with their contact details and rate lines. |
| `/clients/new` | Form for adding a client. |
| `/calendar` | Month view of jobs, colour-coded by status. Click a day to book. |
| `/calendar/new` | Form for booking a job. |
| `/finance` | Money in and money out, with due dates and anything overdue in red. |
| `/settings` | Placeholder. |

Clients are saved to `data/clients.json` and jobs to `data/jobs.json`, plain
text files you can open and read. There is no database yet.

Two things are stored in a deliberate way:

- **Rates are whole pence** (£85.50 is `8550`). Computers handle decimals
  imprecisely, which would cause rounding errors once invoices add figures up.
- **Job dates are plain text** (`"2026-09-16"`), not points in time. A job
  booked for the 16th stays on the 16th whatever the clocks are doing.

Every job is either a **sale** (we charge the client) or a **purchase** (we buy
material off them and sell it on). The direction is set from the client's rate
for that material when you pick one, and can be changed by hand. It decides
which run of work the job follows.

**Sales — money in**

| Status | Colour | What it means |
| --- | --- | --- |
| Booked | Blue | In the diary, not done yet |
| Weighed | Violet | Weighbridge ticket in. Records the weight in tonnes. |
| Generate invoice | Amber | Ready to invoice, not sent |
| Invoice sent | Green | Records the date sent, and works out the due date |

**Purchases — money out**

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
- **Our invoices fall due 28 working days after being sent**, skipping weekends
  and England and Wales bank holidays. **What we owe a client** falls due on
  the payment terms recorded against them, counted in ordinary days, because
  that is what "30 days" on a supplier account means. Bank holidays are worked out from the rules
  rather than typed in, so they stay right in future years. One-offs like a
  jubilee have to be added by hand, in `src/lib/working-days.ts`.
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
