/** Show a stored timestamp in British format, e.g. "15/09/2026". */
export function formatDateGB(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  // Built by hand from UTC parts so the server and the browser always agree.
  // Letting the machine's timezone decide can render two different dates and
  // make React complain that the page changed under it.
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
