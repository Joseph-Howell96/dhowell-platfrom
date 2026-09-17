/**
 * Drawing an invoice as a PDF.
 *
 * Done with pdf-lib, which is plain JavaScript: no browser to install and
 * nothing to download the first time it runs. The layout follows the invoice
 * on screen, laid out by hand because a PDF has no idea what a table is - each
 * piece of text is placed at a position on the page.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { formatDateGB } from "./dates";
import type { InvoiceLine, InvoiceTotals } from "./invoicing";
import { formatInvoiceNumber } from "./invoicing";
import { formatPence } from "./money";
import type { CompanySettings, Customer, Invoice } from "./types";

/** A4, in the points PDFs are measured in. */
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const RIGHT = PAGE.width - MARGIN;

const INK = rgb(0, 0, 0);
const GREY = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.8, 0.8, 0.8);

/** Where each column of the line table starts. */
// Four columns, and nothing else. A stock code nobody looks up was taking
// room the description wanted.
const COL = { description: MARGIN, qty: 320, unit: 430, amount: RIGHT };

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont };

/**
 * The built-in PDF fonts only know the Western European character set, and
 * refuse outright on anything else - an arrow, an emoji, a Japanese character.
 * A client name pasted out of an email could otherwise stop an invoice being
 * produced at all, so the everyday typographic characters are swapped for
 * their plain equivalents and anything still unknown is dropped.
 */
const SUBSTITUTES: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201a": ",",
  "\u201c": '"',
  "\u201d": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2212": "-",
  "\u2022": "-",
  "\u00b7": "-",
  "\u2026": "...",
  "\u00a0": " ",
  "\u2039": "<",
  "\u203a": ">",
};

function safe(text: string): string {
  let out = "";
  for (const character of text) {
    const swapped = SUBSTITUTES[character] ?? character;
    // Anything past the Western European range cannot be drawn at all.
    for (const piece of swapped) {
      if ((piece.codePointAt(0) ?? 0) <= 0xff) out += piece;
    }
  }
  return out;
}

function draw(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  { size = 9, bold = false, colour = INK } = {},
) {
  ctx.page.drawText(safe(text), {
    x,
    y,
    size,
    font: bold ? ctx.bold : ctx.regular,
    color: colour,
  });
}

/** Text ending at x rather than starting there, for money columns. */
function drawRight(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  { size = 9, bold = false, colour = INK } = {},
) {
  const font = bold ? ctx.bold : ctx.regular;
  const shown = safe(text);
  draw(ctx, shown, x - font.widthOfTextAtSize(shown, size), y, { size, bold, colour });
}

function rule(ctx: Ctx, y: number) {
  ctx.page.drawLine({
    start: { x: MARGIN, y },
    end: { x: RIGHT, y },
    thickness: 0.75,
    color: RULE,
  });
}

/** Cut text that will not fit a column, rather than letting it run over. */
function fit(font: PDFFont, rawText: string, size: number, maxWidth: number): string {
  const text = safe(rawText);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

/** Each line of an address on its own row, returning where it finished. */
function drawBlock(ctx: Ctx, text: string, x: number, y: number, size = 9): number {
  let line = y;
  for (const row of text.split("\n")) {
    if (row.trim() === "") continue;
    draw(ctx, row, x, line, { size, colour: GREY });
    line -= size + 3;
  }
  return line;
}

function drawBlockRight(ctx: Ctx, text: string, x: number, y: number, size = 9): number {
  let line = y;
  for (const row of text.split("\n")) {
    if (row.trim() === "") continue;
    drawRight(ctx, row, x, line, { size, colour: GREY });
    line -= size + 3;
  }
  return line;
}

export async function renderInvoicePdf({
  invoice,
  client,
  lines,
  totals,
  settings,
  dueDate,
}: {
  invoice: Invoice;
  client: Customer | undefined;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  settings: CompanySettings;
  dueDate: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE.width, PAGE.height]);
  const ctx: Ctx = {
    page,
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  const reference = formatInvoiceNumber(settings.invoiceNumberPrefix, invoice.number);
  pdf.setTitle(`Invoice ${reference}`);
  pdf.setProducer("Dennis");

  let y = PAGE.height - MARGIN;

  // Heading, with who we are on the right
  draw(ctx, "Invoice", MARGIN, y - 14, { size: 22, bold: true });
  drawRight(ctx, settings.companyName || "Company name not set", RIGHT, y - 10, {
    size: 12,
    bold: true,
  });
  let rightY = y - 26;
  rightY = drawBlockRight(ctx, settings.address, RIGHT, rightY);
  if (settings.phone) {
    drawRight(ctx, `Phone: ${settings.phone}`, RIGHT, rightY, { colour: GREY });
    rightY -= 12;
  }
  if (settings.email) {
    drawRight(ctx, `E-mail: ${settings.email}`, RIGHT, rightY, { colour: GREY });
    rightY -= 12;
  }

  y -= 44;
  for (const [label, value] of [
    ["Invoice no.", reference],
    ["Date", formatDateGB(invoice.issueDate)],
    ["Due", formatDateGB(dueDate)],
  ]) {
    draw(ctx, label, MARGIN, y, { colour: GREY });
    draw(ctx, value, MARGIN + 64, y, { bold: label === "Invoice no." });
    y -= 13;
  }

  y = Math.min(y, rightY) - 10;
  rule(ctx, y);
  y -= 20;

  // Who it goes to
  draw(ctx, "BILL TO", MARGIN, y, { size: 8, bold: true, colour: GREY });
  y -= 15;
  const billTo: [string, string][] = [
    ["Company", client?.businessName ?? ""],
    ["Name", client?.contactName ?? ""],
    ["Phone", client?.phone ?? ""],
    ["Email", client?.email ?? ""],
    ["PO / Ref", invoice.customerPO],
  ];
  for (const [label, value] of billTo) {
    if (!value) continue;
    draw(ctx, label, MARGIN, y, { colour: GREY });
    draw(ctx, value, MARGIN + 64, y);
    y -= 13;
  }
  const address = client?.billingAddress || client?.siteAddress || "";
  if (address) {
    draw(ctx, "Address", MARGIN, y, { colour: GREY });
    y = drawBlock(ctx, address, MARGIN + 64, y) - 2;
  }

  y -= 12;
  rule(ctx, y);
  y -= 16;

  // The lines
  draw(ctx, "DESCRIPTION", COL.description, y, { size: 8, bold: true });
  drawRight(ctx, "QTY", COL.qty, y, { size: 8, bold: true });
  drawRight(ctx, "UNIT PRICE", COL.unit, y, { size: 8, bold: true });
  drawRight(ctx, "AMOUNT", COL.amount, y, { size: 8, bold: true });
  y -= 6;
  rule(ctx, y);
  y -= 16;

  if (lines.length === 0) {
    draw(ctx, "No billable lines.", COL.description, y, { colour: GREY });
    y -= 16;
  }
  for (const line of lines) {
    draw(
      ctx,
      fit(ctx.regular, line.description, 9, COL.qty - COL.description - 12),
      COL.description,
      y,
    );
    drawRight(ctx, line.quantityLabel, COL.qty, y);
    drawRight(ctx, line.unitPriceLabel, COL.unit, y);
    drawRight(ctx, formatPence(line.amountPence), COL.amount, y);
    y -= 8;
    rule(ctx, y);
    y -= 14;
  }

  // Totals, stacked on the right
  y -= 6;
  for (const [label, value, bold] of [
    ["Subtotal", formatPence(totals.netPence), false],
    [`VAT ${settings.vatPercent}%`, formatPence(totals.vatPence), false],
    ["Grand total", formatPence(totals.grossPence), true],
  ] as [string, string, boolean][]) {
    if (bold) {
      ctx.page.drawLine({
        start: { x: RIGHT - 190, y: y + 11 },
        end: { x: RIGHT, y: y + 11 },
        thickness: 0.75,
        color: RULE,
      });
    }
    drawRight(ctx, label, RIGHT - 90, y, { bold, colour: bold ? INK : GREY });
    drawRight(ctx, value, RIGHT, y, { bold });
    y -= 14;
  }

  // Terms on the left, how to pay on the right
  y -= 24;
  rule(ctx, y);
  y -= 18;
  const footerTop = y;

  draw(ctx, "Terms & other comments", MARGIN, y, { size: 9, bold: true });
  y -= 14;
  draw(ctx, `Payment terms ${settings.paymentTermsDays} days from invoice.`, MARGIN, y, {
    colour: GREY,
  });
  y -= 12;
  draw(ctx, "Please note invoice number in payment method.", MARGIN, y, { colour: GREY });
  if (settings.companyName) {
    y -= 12;
    draw(ctx, `${settings.companyName} terms & conditions of sale.`, MARGIN, y, {
      colour: GREY,
    });
  }

  let bankY = footerTop;
  const bankX = MARGIN + 280;
  draw(ctx, "Banking information", bankX, bankY, { size: 9, bold: true });
  bankY -= 14;
  for (const row of [
    settings.bankAccountName,
    settings.bankAccountNumber ? `Account no: ${settings.bankAccountNumber}` : "",
    settings.bankSortCode ? `Sort code: ${settings.bankSortCode}` : "",
    settings.vatNumber ? `VAT no: ${settings.vatNumber}` : "",
  ]) {
    if (!row) continue;
    draw(ctx, row, bankX, bankY, { colour: GREY });
    bankY -= 12;
  }

  // The strip along the bottom
  const footerLine = [
    settings.address.split("\n").join(", "),
    settings.companyNumber ? `Company registration no: ${settings.companyNumber}` : "",
  ]
    .filter(Boolean)
    .join("  -  ");
  if (footerLine) {
    const size = 7.5;
    drawRight(ctx, footerLine, PAGE.width / 2 + ctx.regular.widthOfTextAtSize(footerLine, size) / 2, MARGIN, {
      size,
      colour: GREY,
    });
  }

  return pdf.save();
}
