import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import PageHeader from "@/components/page-header";
import { todayISO } from "@/lib/calendar";
import { readCustomers } from "@/lib/customers";
import { formatDateGB } from "@/lib/dates";
import { requireSession } from "@/lib/guard";
import { invoicedJobIds, readAllInvoices } from "@/lib/invoices";
import { formatInvoiceNumber, invoiceGrossPence } from "@/lib/invoicing";
import { readJobs } from "@/lib/jobs";
import { formatPence } from "@/lib/money";
import { canOpen } from "@/lib/roles";
import { readSettings } from "@/lib/settings";
import { invoiceDueDate } from "@/lib/terms";
import {
  invoiceStanding,
  jobStanding,
  JOB_STANDING_LABELS,
  STANDING_LABELS,
} from "@/lib/types";
import Search from "./search-box";

export const metadata: Metadata = {
  title: "Search",
};

/**
 * How many of each kind to show before saying there are more.
 *
 * There is nowhere yet to send someone who wants the rest of the jobs - the
 * calendar has no search of its own - so this is a real ceiling rather than a
 * first page. Twelve is enough for a client's recent work without the screen
 * turning into a list.
 */
const LIMIT = 12;

/** One thing found, whatever kind of thing it is. */
type Hit = {
  id: string;
  href: string;
  /** The line you read first: the client, or the business name. */
  title: string;
  /** Everything else about it, on one line. */
  detail: string;
  /** How it stands, in a word. Blank where the thing has no standing. */
  tag: string;
};

/**
 * Does this text answer what was typed?
 *
 * Everything is squashed to lower case and the pieces are joined with a space,
 * so a search runs over the whole of a record rather than one field of it -
 * typing a postcode finds the client whose address holds it.
 */
function hit(term: string, ...parts: (string | null | undefined)[]): boolean {
  return parts
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ")
    .toLowerCase()
    .includes(term);
}

/** A group of results, or a line saying there were none. */
function Group({
  heading,
  hits,
  nothing,
}: {
  heading: string;
  hits: Hit[];
  nothing: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-semibold">
        {heading}{" "}
        <span className="font-normal text-muted">
          {hits.length === 0 ? "" : `· ${hits.length}`}
        </span>
      </h2>

      {hits.length === 0 ? (
        <p className="text-base text-muted">{nothing}</p>
      ) : (
        <ul className="space-y-2">
          {hits.slice(0, LIMIT).map((found) => (
            <li key={found.id}>
              <Link
                href={found.href}
                className="glass glass-hover flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg px-4 py-3"
              >
                <span className="text-base font-semibold">{found.title}</span>
                <span className="min-w-0 flex-1 truncate text-base text-muted">
                  {found.detail}
                </span>
                {found.tag ? (
                  <span className="shrink-0 text-base text-muted">
                    {found.tag}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hits.length > LIMIT ? (
        <p className="mt-2 text-sm text-muted">
          and {hits.length - LIMIT} more
        </p>
      ) : null}
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Read the files on every visit, so a search finds what is there now.
  await connection();
  const session = await requireSession("/search");

  const asked = (await searchParams).q;
  const term = ((Array.isArray(asked) ? asked[0] : asked) ?? "").trim();
  const needle = term.toLowerCase();
  const digits = needle.replace(/\D/g, "");

  // Money is Finance's, and a standard user cannot open Finance. Searching is
  // not a way round that, so their results simply do not hold any.
  const seesMoney = canOpen(session.role, "/finance");

  const [customers, jobs, invoices, settings] = await Promise.all([
    readCustomers(),
    readJobs(),
    seesMoney ? readAllInvoices() : Promise.resolve([]),
    readSettings(),
  ]);
  const clientsById = new Map(customers.map((c) => [c.id, c]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const named = (customerId: string) =>
    clientsById.get(customerId)?.businessName ?? "Unknown client";
  const today = todayISO();

  const clientHits: Hit[] =
    term === ""
      ? []
      : customers
          .filter((customer) =>
            hit(
              needle,
              customer.businessName,
              customer.contactName,
              customer.siteAddress,
              customer.billingAddress,
              customer.phone,
              customer.email,
              customer.notes,
              ...customer.rateLines.map((line) => line.material),
            ),
          )
          .map((customer) => ({
            id: customer.id,
            href: `/clients/${customer.id}/edit`,
            title: customer.businessName,
            detail: [customer.contactName, customer.siteAddress.split("\n")[0]]
              .filter(Boolean)
              .join(" · "),
            tag: customer.archivedAt ? "Archived" : "",
          }));

  const billed = invoicedJobIds(invoices);
  const jobHits: Hit[] =
    term === ""
      ? []
      : jobs
          .filter((job) =>
            hit(
              needle,
              named(job.customerId),
              job.material,
              job.notes,
              job.siteAddress,
              job.date,
              formatDateGB(job.date),
            ),
          )
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((job) => ({
            id: job.id,
            href: `/calendar/${job.id}`,
            title: named(job.customerId),
            detail: `${job.material} · ${formatDateGB(job.date)}`,
            tag: JOB_STANDING_LABELS[
              jobStanding(job.status, billed.has(job.id))
            ],
          }));

  const invoiceHits: Hit[] =
    term === "" || !seesMoney
      ? []
      : invoices
          .filter((invoice) => {
            const reference = formatInvoiceNumber(
              settings.invoiceNumberPrefix,
              invoice.number,
            );
            return (
              hit(needle, named(invoice.customerId), reference, invoice.customerPO) ||
              (digits !== "" && String(invoice.number).includes(digits))
            );
          })
          .map((invoice) => {
            const dueDate = invoiceDueDate(
              invoice.issueDate,
              settings.paymentTermsDays,
            );
            return {
              id: invoice.id,
              href: `/invoices/${invoice.id}`,
              title: named(invoice.customerId),
              detail: `${formatInvoiceNumber(settings.invoiceNumberPrefix, invoice.number)} · ${formatDateGB(invoice.issueDate)} · ${formatPence(
                invoiceGrossPence(
                  invoice,
                  jobsById,
                  clientsById.get(invoice.customerId),
                  settings.vatPercent,
                ),
              )}`,
              tag: invoice.deletedAt
                ? "Deleted"
                : STANDING_LABELS[
                    invoiceStanding(invoice.status, dueDate, today)
                  ],
            };
          });

  const total = clientHits.length + jobHits.length + invoiceHits.length;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <PageHeader
        title="Search"
        description="Clients, jobs and invoices, all at once."
      />

      <div className="mb-8">
        <Search value={term} />
      </div>

      {term === "" ? (
        <p className="text-base text-muted">
          Type a client, a material, a postcode, a date or an invoice number.
        </p>
      ) : (
        <>
          <p className="mb-6 text-base text-muted">
            {total === 0
              ? `Nothing found for “${term}”.`
              : `${total} ${total === 1 ? "thing" : "things"} found for “${term}”.`}
          </p>

          <Group
            heading="Clients"
            hits={clientHits}
            nothing="No client matches."
          />
          <Group heading="Jobs" hits={jobHits} nothing="No job matches." />
          {seesMoney ? (
            <Group
              heading="Invoices"
              hits={invoiceHits}
              nothing="No invoice matches."
            />
          ) : null}
        </>
      )}
    </main>
  );
}
