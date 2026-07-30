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

export function CapBadge({ cap }: { cap: "orange" | "purple" | null }) {
  if (!cap) return null;
  const isOrange = cap === "orange";
  return (
    <span
      className={clsx(
        "text-[9.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded",
        isOrange ? "bg-orangecap/20 text-orangecap border border-orangecap/50" : "bg-purplecap/20 text-purplecap border border-purplecap/50"
      )}
      title={isOrange ? "Orange Cap — most runs that season" : "Purple Cap — most wickets that season"}
    >
      {isOrange ? "🟠 Orange Cap" : "🟣 Purple Cap"}
    </span>
  );
}
