/**
 * Weights are stored in whole kilograms, never in tonnes with a decimal point.
 *
 * The same reasoning as money in pence: 0.1 + 0.2 does not come to 0.3 in a
 * computer, which matters as soon as a weight is multiplied by a per-tonne
 * rate. Whole kilograms keep it exact, and one kilogram is finer than any
 * weighbridge ticket needs.
 */

/** Turn what someone typed ("2.45", "2.45 t") into kilograms. */
export function parseTonnesToKg(input: string): number | null {
  const cleaned = input.trim().replace(/\s*(t|tonnes?)$/i, "").trim();
  if (cleaned === "") return null;
  // Up to three decimal places, since a thousandth of a tonne is one kilogram.
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 1000);
}

/** 2450 becomes "2.45 t". */
export function formatKg(kg: number): string {
  return `${(kg / 1000).toFixed(2)} t`;
}

/** 2450 becomes "2.45", for putting back into a form field. */
export function kgToInputValue(kg: number): string {
  return String(kg / 1000);
}
