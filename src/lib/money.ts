/**
 * Money is stored in pence as a whole number, never as pounds with a decimal point.
 *
 * Why: computers store decimals approximately, so 0.1 + 0.2 comes out as
 * 0.30000000000000004. Fine when you look at one number, a real problem once
 * you start adding up an invoice. Whole pence sidesteps it entirely.
 */

/** Turn what someone typed ("85.50", "£85.50", "1,085.5") into pence. */
export function parsePoundsToPence(input: string): number | null {
  const cleaned = input.trim().replace(/[£,\s]/g, "");
  if (cleaned === "") return null;
  // Up to two decimal places, optional, no negative numbers.
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  // Round rather than truncate so 0.005 cases do not silently lose a penny.
  return Math.round(Number(cleaned) * 100);
}

/** Turn pence into something to show on screen: 8550 becomes "£85.50". */
export function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

/** Turn pence back into a plain number for a form field: 8550 becomes "85.50". */
export function penceToInputValue(pence: number): string {
  return (pence / 100).toFixed(2);
}
