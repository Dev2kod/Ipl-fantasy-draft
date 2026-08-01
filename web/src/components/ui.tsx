import type { ReactNode } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

export function Button({
  children, onClick, disabled, variant = "primary", size = "md", className, title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}) {
  return (
    <motion.button
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        "font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        variant === "primary" && "bg-accent text-[#20160a] hover:brightness-110",
        variant === "ghost" && "bg-transparent border border-line text-ink hover:border-accent2",
        variant === "danger" && "bg-loss/20 text-loss border border-loss/50 hover:bg-loss/30",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4.5 py-2.5 text-[15px]",
        size === "lg" && "px-7 py-3.5 text-lg",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

export function OptionCard({
  title, subtitle, desc, selected, onClick, extra,
}: {
  title: string;
  subtitle?: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
  extra?: ReactNode;
}) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -2 }}
      className={clsx(
        "bg-panel2 border-[1.5px] rounded-xl p-3.5 cursor-pointer transition-colors",
        selected ? "border-accent shadow-[0_0_0_3px_rgba(255,122,26,0.18)]" : "border-line hover:border-accent2"
      )}
    >
      <h3 className="text-[16px] font-bold m-0 mb-1">{title}</h3>
      {subtitle && <div className="text-[13px] text-accent font-bold mb-1.5">{subtitle}</div>}
      <p className="text-[12.5px] text-slate-400 m-0">{desc}</p>
      {extra}
    </motion.div>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full border border-line bg-panel2 px-3 py-0.5 text-[13px] font-bold",
        tone === "accent" && "text-accent"
      )}
    >
      {children}
    </span>
  );
}

export function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-[74px] text-slate-400">{label}</span>
      <span className="flex-1 h-2 bg-panel2 rounded-full overflow-hidden">
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="block h-full bg-gradient-to-r from-accent2 to-accent"
        />
      </span>
      <span className="w-8 text-right font-bold">{Math.round(value)}</span>
    </div>
  );
}

export function CricketBallGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="currentColor" />
      <path
        d="M50 2 Q 30 30 30 50 Q 30 70 50 98 M50 2 Q 70 30 70 50 Q 70 70 50 98"
        stroke="#fff" strokeWidth="2.4" fill="none" opacity="0.75"
      />
      <path d="M32 12 Q42 26 40 46" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.5" strokeDasharray="2 3" />
      <path d="M68 12 Q58 26 60 46" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.5" strokeDasharray="2 3" />
      <path d="M32 88 Q42 74 40 54" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.5" strokeDasharray="2 3" />
      <path d="M68 88 Q58 74 60 54" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.5" strokeDasharray="2 3" />
    </svg>
  );
}

export function AwardBadge({ award }: { award: "golden_bat" | "golden_ball" | null }) {
  if (!award) return null;
  const isBat = award === "golden_bat";
  return (
    <span
      className={clsx(
        "text-[9.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded",
        isBat ? "bg-orangecap/20 text-orangecap border border-orangecap/50" : "bg-purplecap/20 text-purplecap border border-purplecap/50"
      )}
      title={isBat ? "Golden Bat — most runs at that World Cup" : "Golden Ball — most wickets at that World Cup"}
    >
      {isBat ? "🏏 Golden Bat" : "🔴 Golden Ball"}
    </span>
  );
}
