/**
 * When money is due.
 *
 * Our invoices run on one rule for every client: payment is due a number of
 * ordinary days after the invoice date. Weekends and bank holidays are not
 * skipped, so an invoice sent on the 1st with 14-day terms is due on the 15th
 * whatever days of the week those happen to be.
 *
 * How many days is not written down here. It is a company setting, edited on
 * the Settings page, and passed in by whoever is doing the working out.
 *
 * What we owe a client for material bought off them is a separate matter, and
 * runs on the terms recorded against that client rather than on this rule.
 */
import { addCalendarDays } from "./dates";

/** When an invoice sent on this date falls due, on the given terms. */
export function invoiceDueDate(sentISO: string, paymentDays: number): string {
  return addCalendarDays(sentISO, paymentDays);
}
