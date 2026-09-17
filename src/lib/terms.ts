/**
 * When money is due.
 *
 * Our invoices run on one rule for every client: payment is due a fixed number
 * of ordinary days after the invoice date. Weekends and bank holidays are not
 * skipped, so an invoice sent on the 1st is due on the 15th whatever days of
 * the week those happen to be.
 *
 * What we owe a client for material bought off them is a separate matter, and
 * runs on the terms recorded against that client rather than on this rule.
 */
import { addCalendarDays } from "./dates";

/** How long a client has to pay one of our invoices. */
export const PAYMENT_DAYS = 14;

/** When an invoice sent on this date falls due. */
export function invoiceDueDate(sentISO: string): string {
  return addCalendarDays(sentISO, PAYMENT_DAYS);
}
