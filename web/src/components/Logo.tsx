export interface LogoProps {
  /** Small tagline shown under the wordmark, e.g. "WORLD CUP DRAFT · 1975–2023". */
  tagline?: string;
  /** Smaller mark + type for tight mobile headers. */
  compact?: boolean;
  className?: string;
}

/** The app's mark + wordmark lockup, shared by the desktop and mobile headers. */
export default function Logo({ tagline, compact, className }: LogoProps) {
  return (
    <span className={["flex items-center gap-2", className].filter(Boolean).join(" ")}>
      <img
        src="/favicon.svg"
        alt=""
        className={compact ? "w-7 h-7 shrink-0" : "w-9 h-9 shrink-0"}
      />
      <span className="flex flex-col leading-none">
        <span className={compact ? "text-lg font-black tracking-tight" : "text-2xl font-black tracking-tight"}>
          <span className="text-ink">UNBEATEN</span> <span className="text-accent">XI</span>
        </span>
        {tagline && (
          <span className="hidden sm:inline text-[11px] tracking-[3px] text-slate-400 font-bold mt-0.5">
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
