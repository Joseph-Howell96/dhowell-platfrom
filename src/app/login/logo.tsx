/**
 * The mark on the sign-in screen: a recycling symbol turning slowly inside a D.
 *
 * The D is drawn as a ring with a flat left edge rather than as the letter,
 * so the arrows have a round space to turn in. The turn is the one piece of
 * movement in the app that is not a hover, and it is slow on purpose - twelve
 * seconds a revolution reads as alive rather than as something loading.
 */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`relative grid place-items-center ${className}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        {/* The D: a thick stem and a bowl, in the accent colour. */}
        <path
          d="M26 14 h30 a46 46 0 0 1 0 92 h-30 z"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinejoin="round"
        />
      </svg>

      {/* The arrows, centred in the bowl of the D. */}
      <svg
        viewBox="0 0 100 100"
        className="absolute h-[42%] w-[42%] translate-x-[14%] motion-safe:animate-[spin_12s_linear_infinite]"
        aria-hidden
      >
        <g fill="var(--accent)">
          {/* Three arms of the Mobius loop, each the same shape turned 120°. */}
          <path
            d="M50 6 L64 30 H56 L56 48 H44 L44 30 H36 Z"
            transform="rotate(0 50 50)"
          />
          <path
            d="M50 6 L64 30 H56 L56 48 H44 L44 30 H36 Z"
            transform="rotate(120 50 50)"
          />
          <path
            d="M50 6 L64 30 H56 L56 48 H44 L44 30 H36 Z"
            transform="rotate(240 50 50)"
          />
        </g>
      </svg>
    </span>
  );
}
