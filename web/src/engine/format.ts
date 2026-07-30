import type { Squad } from "./types";

export function finishLabel(sq: Squad): string {
  const f = sq.finish;
  if (sq.champion || f === 1) return "🏆 Champions";
  if (sq.runner_up || f === 2) return "🥈 Runners-up";
  if (!f) return "";
  const o = f % 10, t = Math.floor(f / 10) % 10;
  const suf = t === 1 ? "th" : o === 1 ? "st" : o === 2 ? "nd" : o === 3 ? "rd" : "th";
  return `Finished ${f}${suf}`;
}
