# dhowell-platfrom

A website built with [Next.js](https://nextjs.org), TypeScript and Tailwind CSS.

## Running it on your computer

You need [Node.js](https://nodejs.org) installed first (version 20 or newer).

Then, in a terminal, from this folder:

```bash
npm install   # downloads the code this project depends on (only needed once)
npm run dev   # starts the site on your machine
```

Open <http://localhost:3000> in a browser. Save a file and the page updates by itself.

Press `Ctrl+C` in the terminal to stop it.

## Screens

| Address | What it does |
| --- | --- |
| `/customers` | Lists every customer with their contact details and rate lines. |
| `/customers/new` | Form for adding a customer. |

Customers are saved to `data/customers.json`, a plain text file you can open and
read. There is no database yet. Rates are stored in pence as whole numbers
(£85.50 is `8550`) because computers handle decimals imprecisely, which would
cause rounding errors once invoices start adding figures up.

## Where things live

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | The home page. Start editing here. |
| `src/app/layout.tsx` | The wrapper around every page — fonts, page title, anything shared. |
| `src/app/globals.css` | Site-wide styling and colours. |
| `public/` | Images and files served as-is (e.g. `/logo.png`). |
| `src/lib/` | The shared logic: data types, saving and loading, formatting. |
| `data/customers.json` | The customer records. Back this up. |
| `package.json` | Project settings and the list of commands below. |

Adding a new page: create `src/app/about/page.tsx` and it becomes `/about`. The folder name is the web address.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the site locally while you work on it. |
| `npm run build` | Packages the site for going live. |
| `npm start` | Runs the packaged version (run `build` first). |
| `npm run lint` | Checks the code for common mistakes. |
