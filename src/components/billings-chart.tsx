import { MONTH_SHORT, type MonthTotals } from "@/lib/analytics";
import { formatPence } from "@/lib/money";

/**
 * Revenue and profit side by side for each month of the year.
 *
 * Drawn as plain SVG rather than with a charting library: it is a dozen
 * rectangles, it renders on the server so the page arrives complete, and it
 * adds nothing for the browser to download.
 */

const WIDTH = 720;
const HEIGHT = 280;
const PAD = { top: 16, right: 12, bottom: 28, left: 64 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const BAR_MAX = 20; // capped, so the band keeps some air
const BAR_GAP = 2; // the surface gap that separates the pair

/** A bar with rounded corners at the data end and square ones at the baseline. */
function barPath(x: number, y: number, w: number, h: number, up: boolean) {
  const r = Math.min(4, Math.abs(h) / 2, w / 2);
  if (h <= 0.5) return "";
  return up
    ? `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
    : `M${x},${y} L${x},${y + h - r} Q${x},${y + h} ${x + r},${y + h} L${x + w - r},${y + h} Q${x + w},${y + h} ${x + w},${y + h - r} L${x + w},${y} Z`;
}

/** Round a number up to something a person would choose for an axis label. */
function niceCeiling(value: number): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function shortMoney(pence: number): string {
  const pounds = pence / 100;
  if (Math.abs(pounds) >= 1000) return `£${Math.round(pounds / 1000)}k`;
  return `£${Math.round(pounds)}`;
}

export default function BillingsChart({ months }: { months: MonthTotals[] }) {
  const revenues = months.map((m) => m.totals.revenuePence);
  const profits = months.map((m) => m.totals.profitPence);

  const top = niceCeiling(Math.max(0, ...revenues, ...profits));
  // A loss pushes the baseline up off the bottom rather than being clipped.
  const bottom = -niceCeiling(Math.abs(Math.min(0, ...profits)));
  const span = top - bottom || 1;

  const y = (pence: number) => PAD.top + ((top - pence) / span) * PLOT_H;
  const zeroY = y(0);

  const band = PLOT_W / 12;
  const barW = Math.min(BAR_MAX, (band - BAR_GAP) / 2 - 4);

  // Four or five hairlines is enough to read heights against.
  const ticks = [top, top * 0.5, 0, bottom * 0.5, bottom].filter(
    (value, index, all) => value !== null && all.indexOf(value) === index,
  );

  const everythingEmpty = top === 0 && bottom === 0;

  return (
    <figure className="m-0">
      <figcaption className="mb-4 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-2 text-sm text-muted">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm bg-series-revenue"
          />
          Revenue
        </span>
        <span className="flex items-center gap-2 text-sm text-muted">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm bg-series-profit"
          />
          Profit
        </span>
      </figcaption>

      {everythingEmpty ? (
        <p className="py-20 text-center text-sm text-muted">
          No weighed jobs in this year yet.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Revenue and profit for each month of the year. The figures are listed in the table below."
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-muted"
                fontSize={11}
              >
                {shortMoney(tick)}
              </text>
            </g>
          ))}

          {months.map((month, index) => {
            const left = PAD.left + index * band;
            const pairLeft = left + (band - (barW * 2 + BAR_GAP)) / 2;
            const revenue = month.totals.revenuePence;
            const profit = month.totals.profitPence;

            return (
              <g key={month.label}>
                <path
                  d={barPath(
                    pairLeft,
                    y(Math.max(revenue, 0)),
                    barW,
                    Math.abs(y(revenue) - zeroY),
                    revenue >= 0,
                  )}
                  fill="var(--series-revenue)"
                >
                  <title>{`${month.label} revenue ${formatPence(revenue)}`}</title>
                </path>
                <path
                  d={barPath(
                    pairLeft + barW + BAR_GAP,
                    y(Math.max(profit, 0)),
                    barW,
                    Math.abs(y(profit) - zeroY),
                    profit >= 0,
                  )}
                  fill="var(--series-profit)"
                >
                  <title>{`${month.label} profit ${formatPence(profit)}`}</title>
                </path>
                <text
                  x={left + band / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-muted"
                  fontSize={11}
                >
                  {month.label}
                </text>
              </g>
            );
          })}

          {/* The zero line sits on top of the bars so it stays readable. */}
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--grid)"
            strokeWidth={1}
          />
        </svg>
      )}

      {/* The same figures as text, for anyone using a screen reader. */}
      <table className="sr-only">
        <caption>Revenue and profit by month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Revenue</th>
            <th>Profit</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month, index) => (
            <tr key={month.label}>
              <th scope="row">{MONTH_SHORT[index]}</th>
              <td>{formatPence(month.totals.revenuePence)}</td>
              <td>{formatPence(month.totals.profitPence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
