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

The sidebar has five sections. Clients and Calendar work; the rest are stubs.

| Address | What it does |
| --- | --- |
| `/dashboard` | Placeholder. Opening the app lands here. |
| `/clients` | Lists every client with their contact details and rate lines. |
| `/clients/new` | Form for adding a client. |
| `/calendar` | Month view of jobs, colour-coded by status. Click a day to book. |
| `/calendar/new` | Form for booking a job. |
| `/finance` | Placeholder. |
| `/settings` | Placeholder. |

Clients are saved to `data/clients.json` and jobs to `data/jobs.json`, plain
text files you can open and read. There is no database yet.

Two things are stored in a deliberate way:

- **Rates are whole pence** (£85.50 is `8550`). Computers handle decimals
  imprecisely, which would cause rounding errors once invoices add figures up.
- **Job dates are plain text** (`"2026-09-16"`), not points in time. A job
  booked for the 16th stays on the 16th whatever the clocks are doing.

A job moves through four statuses, each with its own colour on the calendar:
booked, completed, weighed, invoiced.

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
