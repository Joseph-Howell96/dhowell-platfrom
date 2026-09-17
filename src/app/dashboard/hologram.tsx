/**
 * The hand at the foot of the Dashboard. Joseph asked for it, for his dad.
 *
 * Drawn rather than an image: an SVG costs nothing to download, scales to any
 * screen and takes the accent colour from the theme, so it stays right if the
 * green ever changes again.
 *
 * "Hologram" is done with three things and no animation, which keeps the house
 * rule that nothing moves unless you are pointing at it: a fill that fades out
 * towards the top, scan lines ruled across it, and a pool of light underneath
 * where a projector would be.
 */
export default function Hologram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 210"
      className={className}
      role="img"
      aria-label="A hologram of a hand with one finger raised"
    >
      <defs>
        <linearGradient id="holo-body" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.12" />
        </linearGradient>
        {/* Ruled lines, the width of one so they read as scan lines rather
            than as stripes. */}
        <pattern
          id="holo-scan"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="4" height="1" fill="var(--accent)" opacity="0.28" />
        </pattern>
        <radialGradient id="holo-pool" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        {/* One shape, used three times over: filled, ruled and outlined. */}
        <g id="holo-hand">
          {/* The fist, then the one finger, then the three folded down, the
              thumb across the front and the wrist below. */}
          <rect x="24" y="90" width="102" height="66" rx="24" />
          <rect x="63" y="6" width="26" height="94" rx="13" />
          <rect x="34" y="78" width="27" height="30" rx="13.5" />
          <rect x="91" y="80" width="25" height="28" rx="12.5" />
          <rect x="107" y="90" width="21" height="25" rx="10.5" />
          <rect x="14" y="106" width="38" height="23" rx="11.5" />
          <rect x="58" y="150" width="42" height="26" rx="10" />
        </g>
      </defs>

      {/* The light it is standing in. */}
      <ellipse cx="80" cy="182" rx="66" ry="14" fill="url(#holo-pool)" />

      <g style={{ filter: "drop-shadow(0 0 12px rgba(34,197,94,0.35))" }}>
        <use href="#holo-hand" fill="url(#holo-body)" />
        <use href="#holo-hand" fill="url(#holo-scan)" />
        <use
          href="#holo-hand"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeOpacity="0.85"
        />
      </g>
    </svg>
  );
}
