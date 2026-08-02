import type { FlagCode } from "../engine/countries";

/**
 * Country flags, rendered 1:1 (square).
 *
 * The artwork is the real thing: native square SVGs from `flag-icons`
 * (MIT licensed), vendored into src/assets/flags/ so the game still works
 * offline instead of depending on a CDN at runtime. They are natively 1x1, so
 * nothing is cropped or stretched to reach a square.
 *
 * Emoji flags are deliberately NOT used: Windows ships no glyphs for
 * regional-indicator pairs, so Segoe UI Emoji renders them as the bare
 * letters ("IN", "PK", "ZA"). A test guards against them creeping back.
 *
 * Two dataset entries aren't nations and have no flag to source: the West
 * Indies and East Africa are composite cricket sides. Rather than misuse a
 * trademarked team crest, they get a simple drawn mark in their colours.
 */

// Vite resolves each vendored SVG to a URL at build time (small ones get
// inlined as data URIs), keyed here by the dataset's country code.
const FLAG_FILES = import.meta.glob("../assets/flags/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const FLAG_URL: Partial<Record<FlagCode, string>> = Object.fromEntries(
  Object.entries(FLAG_FILES).map(([path, url]) => [
    path.split("/").pop()!.replace(".svg", "").toUpperCase(),
    url,
  ])
);

/** Codes with no sourceable flag, drawn instead on a square viewBox to match. */
const DRAWN: Partial<Record<FlagCode, React.ReactNode>> = {
  // Multi-island cricket side. Maroon and gold are the team's colours; the
  // palm is generic, not the (trademarked) Cricket West Indies crest.
  WI: (
    <g>
      <rect width="40" height="40" fill="#7B0000" />
      <path d="M19.4,33 q.6,-11 1.6,-15" stroke="#FFC72C" strokeWidth="1.8" fill="none" />
      <g fill="#FFC72C">
        <path d="M20,18 q-8,-3 -11,2.5 q5.5,-5.5 11,-1Z" />
        <path d="M20,18 q8,-3 11,2.5 q-5.5,-5.5 -11,-1Z" />
        <path d="M20,17 q-4.5,-7.5 -11,-7.5 q7.5,1 11,5.5Z" />
        <path d="M20,17 q4.5,-7.5 11,-7.5 q-7.5,1 -11,5.5Z" />
        <path d="M20,16 q0,-8.5 0,-9.5 q2,5.5 1,9.5Z" />
      </g>
    </g>
  ),
  // Fielded players from Kenya, Uganda, Tanzania and Zambia in 1975 only --
  // a region, never a state, so there is no flag. Neutral regional mark.
  EAF: (
    <g>
      <rect width="40" height="40" fill="#0B6E4F" />
      <rect y="16" width="40" height="3.4" fill="#FFC72C" />
      <rect y="21" width="40" height="3.4" fill="#000" />
      <circle cx="20" cy="20" r="7.5" fill="none" stroke="#fff" strokeWidth="1.3" />
      <path d="M20,12.5 v15 M12.5,20 h15" stroke="#fff" strokeWidth="1" />
    </g>
  ),
};

/** The player's own drafted XI isn't a nation — mark it with a cricket ball. */
const YOUR_MARK = (
  <g>
    <rect width="40" height="40" fill="#20160a" />
    <circle cx="20" cy="20" r="13" fill="#C1272D" />
    <path d="M12.5,9 q-3,11 0,22 M27.5,9 q3,11 0,22" stroke="#fff" strokeWidth="1.2" fill="none" />
    <path d="M20,7 v26" stroke="#fff" strokeWidth=".7" opacity=".5" />
  </g>
);

export interface FlagProps {
  /** Country code from the dataset (IND, AUS, WI, …). */
  code?: string | null;
  /** Render the "your XI" mark instead of a nation. */
  isYou?: boolean;
  /** Defaults to a square that sits nicely inline with text. */
  className?: string;
  /** Accessible label. Omit when a visible team name sits right next to it. */
  title?: string;
}

const INLINE =
  "inline-block h-[1.05em] w-[1.05em] rounded-[3px] align-[-0.18em] shrink-0 ring-1 ring-black/15 object-cover";

export default function Flag({ code, isYou, className, title }: FlagProps) {
  const cls = className ?? INLINE;
  const url = !isYou && code ? FLAG_URL[code as FlagCode] : undefined;

  // Real flag artwork: a plain <img>, so the browser caches and scales it.
  if (url) {
    return (
      <img
        src={url}
        alt={title ?? ""}
        title={title}
        className={cls}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const drawn = isYou ? YOUR_MARK : code ? DRAWN[code as FlagCode] : undefined;
  return (
    <svg
      viewBox="0 0 40 40"
      className={cls}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {drawn ?? (
        // Unknown code: a neutral tile rather than a broken-image box.
        <g>
          <rect width="40" height="40" fill="#5B6472" />
          <circle cx="20" cy="20" r="10" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".7" />
        </g>
      )}
    </svg>
  );
}
