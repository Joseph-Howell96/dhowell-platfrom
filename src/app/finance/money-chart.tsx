/**
 * Money in and money made, month by month.
 *
 * A plain grouped column chart: two bars a month, one for what came in and one
 * for what was left after the tip was paid. No hover, no animation and no
 * script - it is drawn on the server as flat SVG, and the table underneath it
 * on the page carries every exact figure. Someone reading this does not have
 * to find anything with a mouse to get the numbers.
 *
 * The two colours are the app's own series tokens, a blue and an orange, which
 * stay apart from each other under every kind of colour blindness. They are
 * the only colour in here: the labels and figures are ordinary text, so the
 * chart never asks anyone to read words in a pale colour.
 */
import { formatPence } from "@/lib/money";

export type MonthMoney = {
  /** "2026-09", used as the key. */
  key: string;
  /** Three letters for under the column, e.g. "Sep". */
  short: string;
  /** The whole thing, e.g. "September 2026", for the reader-aloud label. */
  long: string;
  revenuePence: number;
  /** Null where no job that month has both halves of the sum recorded. */
  profitPence: number | null;
};

/* The shape of the thing, in SVG units, which are plain pixels here. */
const SLOT = 96; // the width one month gets
const BAR = 24; // a bar, capped at the 24px the house style allows
const GAP = 2; // the gap between the two bars of a month
const LEFT = 76; // room for the money down the left-hand side
const RIGHT = 16;
const TOP = 18;
const PLOT = 190; // how tall the drawing itself is
const FEET = 30; // room for the month names underneath

/** A round number at or above this one: 1, 2, 2.5, 5 or 10 times a power of ten. */
function niceStep(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (factor * magnitude >= value) return factor * magnitude;
  }
  return 10 * magnitude;
}

/** A column with its top two corners rounded and its foot square on the line. */
function columnPath(x: number, top: number, width: number, height: number): string {
  const r = Math.min(4, height / 2);
  const bottom = top + height;
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${top + r}`,
    `Q ${x} ${top} ${x + r} ${top}`,
    `L ${x + width - r} ${top}`,
    `Q ${x + width} ${top} ${x + width} ${top + r}`,
    `L ${x + width} ${bottom}`,
    "Z",
  ].join(" ");
}

export default function MoneyChart({ months }: { months: MonthMoney[] }) {
  if (months.length === 0) return null;

  const values = months.flatMap((m) => [m.revenuePence, m.profitPence ?? 0]);
  // A loss is drawn below the line rather than clipped off, so a bad month
  // looks like a bad month instead of an empty one.
  const step = niceStep(
    (Math.max(0, ...values) - Math.min(0, ...values)) / 4 || 1,
  );
  const hi = Math.max(step, Math.ceil(Math.max(0, ...values) / step) * step);
  const lo = Math.floor(Math.min(0, ...values) / step) * step;

  const yOf = (pence: number) =>
    TOP + PLOT - ((pence - lo) / (hi - lo)) * PLOT;
  const zero = yOf(0);

  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1; t += step) ticks.push(t);

  const width = LEFT + months.length * SLOT + RIGHT;
  const height = TOP + PLOT + FEET;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`What came in and what was made, for each of ${months.length} months. The figures are in the table below.`}
      className="mx-auto max-w-full"
    >
      {/* The lines across, and the money they stand for. */}
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={LEFT}
            x2={width - RIGHT}
            y1={yOf(tick)}
            y2={yOf(tick)}
            stroke="var(--line)"
            strokeWidth={1}
          />
          <text
            x={LEFT - 10}
            y={yOf(tick) + 4}
            textAnchor="end"
            fontSize={13}
            fill="var(--muted)"
          >
            {tick === 0 ? "£0" : formatPence(tick).replace(/\.00$/, "")}
          </text>
        </g>
      ))}

      {/* The line money is measured from, drawn heavier than the rest. */}
      <line
        x1={LEFT}
        x2={width - RIGHT}
        y1={zero}
        y2={zero}
        stroke="var(--muted)"
        strokeWidth={1}
      />

      {months.map((month, index) => {
        const slotX = LEFT + index * SLOT;
        const pairX = slotX + (SLOT - (BAR * 2 + GAP)) / 2;
        const last = index === months.length - 1;

        const bars = [
          {
            name: "Came in",
            pence: month.revenuePence,
            colour: "var(--series-revenue)",
            x: pairX,
          },
          {
            name: "Made",
            pence: month.profitPence,
            colour: "var(--series-profit)",
            x: pairX + BAR + GAP,
          },
        ];

        return (
          <g key={month.key}>
            {bars.map((bar) =>
              bar.pence === null || bar.pence === 0 ? null : (
                <g key={bar.name}>
                  <path
                    d={columnPath(
                      bar.x,
                      Math.min(zero, yOf(bar.pence)),
                      BAR,
                      Math.abs(yOf(bar.pence) - zero),
                    )}
                    fill={bar.colour}
                  />
                  <title>{`${month.long} — ${bar.name} ${formatPence(bar.pence)}`}</title>
                  {/* One label, on the newest month's money in. Labelling
                      both bars puts two eight-character figures 26px apart,
                      which collide the moment the two are a similar height;
                      every other figure is in the table underneath, which is
                      where numbers are easier to read anyway. */}
                  {last && bar.name === "Came in" ? (
                    <text
                      x={bar.x + BAR / 2}
                      y={
                        bar.pence >= 0
                          ? yOf(bar.pence) - 7
                          : yOf(bar.pence) + 16
                      }
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight={600}
                      fill="var(--ink)"
                    >
                      {formatPence(bar.pence).replace(/\.00$/, "")}
                    </text>
                  ) : null}
                </g>
              ),
            )}

            <text
              x={slotX + SLOT / 2}
              y={TOP + PLOT + 22}
              textAnchor="middle"
              fontSize={14}
              fill="var(--muted)"
            >
              {month.short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
