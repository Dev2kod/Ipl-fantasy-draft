import { Monitor, Smartphone } from "lucide-react";
import clsx from "clsx";
import { useGameStore } from "../store/useGameStore";
import type { UiMode } from "../store/useGameStore";

const OPTIONS: { id: UiMode; label: string; icon: typeof Monitor }[] = [
  { id: "classic", label: "Desktop layout", icon: Monitor },
  { id: "mobile", label: "Mobile layout", icon: Smartphone },
];

/**
 * Switches between the two presentation layers. Both drive the same store,
 * so flipping mid-draft keeps your XI, your switches and your results.
 *
 * Built as a radiogroup rather than a checkbox/switch because there are two
 * named destinations, not an on/off state -- that's what screen readers will
 * announce, and it stays correct if a third layout is ever added.
 */
export default function UiModeToggle({ compact }: { compact?: boolean }) {
  const { uiMode, setUiMode } = useGameStore();

  return (
    <div
      role="radiogroup"
      aria-label="Interface layout"
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-xl border border-line bg-panel p-0.5 shrink-0",
        compact ? "h-12" : "h-11"
      )}
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = uiMode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setUiMode(id)}
            className={clsx(
              "grid place-items-center rounded-lg transition-colors",
              compact ? "w-11 h-11" : "w-10 h-10",
              active ? "bg-accent text-[#20160a]" : "text-slate-400 hover:text-accent active:bg-panel2"
            )}
          >
            <Icon size={compact ? 17 : 16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
