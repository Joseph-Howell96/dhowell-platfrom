import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import DeleteReceiptButton from "./delete-button";
import ReceiptForm from "./receipt-form";
import PageHeader from "@/components/page-header";
import { monthKeyOf, monthLabel, todayISO } from "@/lib/calendar";
import { formatDateGB } from "@/lib/dates";
import { requireSession } from "@/lib/guard";
import { formatPence } from "@/lib/money";
import { readReceipts } from "@/lib/receipts";

export const metadata: Metadata = {
  title: "Receipts",
};

export default async function ReceiptsPage() {
  // Read on every visit, so a receipt taken on a phone a minute ago is here.
  await connection();
  // Receipts sit under Finance and are guarded as Finance: a standard user
  // cannot open them, and the picture itself is behind the same check.
  await requireSession("/finance");

  const receipts = await readReceipts();
  const total = receipts.reduce(
    (sum, receipt) => sum + (receipt.amountPence ?? 0),
    0,
  );
  const unpriced = receipts.filter(
    (receipt) => receipt.amountPence === null,
  ).length;

  /** Gathered by month, newest month first, the way a shoebox gets sorted. */
  const months = new Map<string, typeof receipts>();
  for (const receipt of receipts) {
    const key = monthKeyOf(receipt.date);
    months.set(key, [...(months.get(key) ?? []), receipt]);
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
      <Link
        href="/finance"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Back to Finance
      </Link>
      <div className="mt-4">
        <PageHeader
          title="Receipts"
          description="Photograph it now, sort it out later."
        />
      </div>

      {/* Keyed on how many there are, so saving one gives back an empty
          form rather than the last one's words. */}
      <ReceiptForm key={receipts.length} today={todayISO()} />

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Kept</h2>
        <p className="mt-1 mb-4 text-base text-muted">
          {receipts.length === 0
            ? "Nothing yet."
            : `${receipts.length} ${receipts.length === 1 ? "receipt" : "receipts"}, ${formatPence(total)} between them${
                unpriced === 0
                  ? "."
                  : ` — ${unpriced} with no amount typed, so ${unpriced === 1 ? "it is" : "they are"} not in that total.`
              }`}
        </p>

        {receipts.length === 0 ? (
          <div className="glass-dashed rounded-xl px-6 py-14 text-center">
            <p className="text-lg font-medium">No receipts yet</p>
            <p className="mx-auto mt-2 max-w-md text-base text-muted">
              Use the button above. On a phone it opens the camera, so a tip
              ticket can be kept before it goes in the footwell.
            </p>
          </div>
        ) : (
          [...months.entries()].map(([month, ofMonth]) => (
            <div key={month} className="mb-8">
              <h3 className="mb-3 flex flex-wrap items-baseline gap-x-3 text-base font-semibold">
                {monthLabel(month)}
                <span className="font-normal text-muted">
                  {ofMonth.length}{" "}
                  {ofMonth.length === 1 ? "receipt" : "receipts"},{" "}
                  {formatPence(
                    ofMonth.reduce((sum, r) => sum + (r.amountPence ?? 0), 0),
                  )}
                </span>
              </h3>

              <ul className="grid gap-4 sm:grid-cols-2">
                {ofMonth.map((receipt) => (
                  <li key={receipt.id} className="glass rounded-xl p-4">
                    {/* The picture is the point, so it is the biggest thing
                        on the card and opens full size in its own tab. */}
                    <a
                      href={`/finance/receipts/${receipt.id}/image`}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border border-line"
                    >
                      {receipt.contentType === "application/pdf" ? (
                        <span className="grid h-40 place-items-center bg-elevated text-base text-muted">
                          PDF — open it
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/finance/receipts/${receipt.id}/image`}
                          alt={`Receipt: ${receipt.description}`}
                          // Anchored to the top: a receipt's shop name and
                          // date are at the head of it, and a thumbnail
                          // cropped to the middle is a picture of a column of
                          // numbers that could be anybody's.
                          className="h-40 w-full bg-elevated object-cover object-top"
                        />
                      )}
                    </a>

                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-base font-semibold">
                        {receipt.description}
                      </p>
                      <p className="text-base font-semibold tabular-nums">
                        {receipt.amountPence === null
                          ? "—"
                          : formatPence(receipt.amountPence)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {formatDateGB(receipt.date)}
                      {receipt.notes ? ` · ${receipt.notes}` : ""}
                    </p>

                    <div className="mt-3">
                      <DeleteReceiptButton
                        receiptId={receipt.id}
                        description={receipt.description}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <p className="mt-8 text-xs text-muted">
        The pictures are kept on this machine, in the app&rsquo;s own folder,
        and are not part of the code. Nobody who is not signed in as an admin
        can open one, including by typing its address.
      </p>
    </main>
  );
}
