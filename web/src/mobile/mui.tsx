import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { X } from "lucide-react";

/**
 * Building blocks for the mobile layout.
 *
 * Rules these all follow, because they're what actually make a small-screen
 * UI usable rather than just narrow:
 *  - every tap target is at least 44x44 (the WCAG 2.5.5 / iOS HIG minimum)
 *  - real <button> elements, so keyboard and screen readers work for free
 *  - primary actions live at the BOTTOM, inside thumb reach, not the top
 *  - nothing relies on hover, which doesn't exist on touch
 */

/** Full-width primary action. Used for the one obvious next step per screen. */
export function BigButton({
  children, onClick, disabled, tone = "primary", className, ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "ghost" | "danger";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.975 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx(
        "w-full min-h-[52px] px-5 rounded-2xl font-extrabold text-[16px]",
        "inline-flex items-center justify-center gap-2 transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        tone === "primary" && "bg-accent text-[#20160a] active:brightness-95",
        tone === "ghost" && "bg-panel border-2 border-line text-ink active:bg-panel2",
        tone === "danger" && "bg-loss/15 text-loss border-2 border-loss/40 active:bg-loss/25",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

/** A compact secondary action that still meets the 44px target. */
export function PillButton({
  children, onClick, disabled, active, className, ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={clsx(
        "min-h-[44px] px-3.5 rounded-xl text-[13px] font-bold border-2 transition-colors",
        "inline-flex items-center justify-center gap-1.5 shrink-0",
        "disabled:opacity-35 disabled:cursor-not-allowed",
        active ? "border-accent bg-accent/10 text-accent" : "border-line bg-panel text-slate-400 active:bg-panel2",
        className
      )}
    >
      {children}
    </button>
  );
}

/** A tappable choice card (ratings mode, difficulty, match style). */
export function ChoiceCard({
  title, desc, extra, selected, onClick,
}: {
  title: string;
  desc: string;
  extra?: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "w-full text-left rounded-2xl p-4 border-2 transition-colors min-h-[44px]",
        selected
          ? "border-accent bg-accent/8 shadow-[0_0_0_3px_rgba(255,122,26,0.12)]"
          : "border-line bg-panel active:bg-panel2"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={clsx(
            "w-5 h-5 rounded-full border-2 shrink-0 grid place-items-center",
            selected ? "border-accent" : "border-line"
          )}
        >
          {selected && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}
        </span>
        <span className="font-extrabold text-[15.5px]">{title}</span>
      </div>
      <p className="text-[13px] text-slate-400 m-0 mt-1.5 pl-7">{desc}</p>
      {extra && <div className="pl-7 mt-1">{extra}</div>}
    </button>
  );
}

/** Sticky bottom action bar, clear of the iOS home indicator. */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 bg-bg/92 backdrop-blur-md border-t border-line px-4 pt-3 pb-3 pb-safe">
      {children}
    </div>
  );
}

/**
 * A bottom sheet. On mobile this beats a centred modal: it animates from the
 * thumb end of the screen, can be dismissed by tapping the backdrop, and
 * keeps its own scroll so long content never traps the page.
 */
export function Sheet({
  open, onClose, title, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-panel rounded-t-3xl border-t border-line max-h-[88vh] flex flex-col"
          >
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-line">
              {/* Grab handle: the standard affordance that says "this slides". */}
              <div aria-hidden="true" className="w-10 h-1.5 rounded-full bg-line mx-auto mb-3" />
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-extrabold m-0">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-11 h-11 -mr-2 grid place-items-center rounded-xl text-slate-400 active:bg-panel2"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 py-3 grow">{children}</div>
            {footer && <div className="shrink-0 px-4 pt-2 pb-3 pb-safe border-t border-line">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A labelled progress meter (batting/bowling/balance/overall). */
export function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.round(value);
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[68px] text-[12px] text-slate-400 shrink-0">{label}</span>
      <span
        role="meter"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="flex-1 h-2.5 bg-panel2 rounded-full overflow-hidden"
      >
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, v)}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="block h-full bg-gradient-to-r from-accent2 to-accent"
        />
      </span>
      <b className="w-8 text-right text-[13px] tabular-nums">{v}</b>
    </div>
  );
}

/** Section heading with consistent spacing. */
export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5 mt-1">
      <h2 className="text-[12px] font-black tracking-[2px] uppercase text-slate-400 m-0">{children}</h2>
      {hint && <p className="text-[12.5px] text-slate-400 m-0 mt-1">{hint}</p>}
    </div>
  );
}

/** Announces transient status (picks, switches) to screen readers. */
export function LiveMessage({ children }: { children: ReactNode }) {
  return (
    <p aria-live="polite" className="text-accent2 text-[13px] font-semibold m-0 min-h-[18px]">
      {children}
    </p>
  );
}
