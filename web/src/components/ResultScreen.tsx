import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { FileText } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import type { SignedPlayer } from "../engine/types";
import { Button, CapBadge } from "./ui";
import ScorecardModal from "./ScorecardModal";

export default function ResultScreen() {
  const { simResults, simMeta, slots, formation, mode, difficulty, style, restart } = useGameStore();
  const [copied, setCopied] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!simMeta) return null;
  const won = simMeta.won;
  const perfect = won === 7;
  const players = slots.map((s) => s.player).filter((p): p is SignedPlayer => p !== null);

  let verdict: string, sub: string;
  if (perfect) {
    verdict = "🏆 CHAMPIONS — UNBEATEN";
    sub = "Seven wins from seven. You built the perfect XI and delivered the statement.";
  } else {
    const stage = simResults[simResults.length - 1]?.stage ?? "";
    if (won >= 5) { verdict = "So close — Runners-up"; sub = `Fell at the ${stage}. A brilliant run, but not the perfect 7–0.`; }
    else if (won >= 3) { verdict = "Playoffs, then out"; sub = `Knocked out at the ${stage}. Your XI had gaps under pressure.`; }
    else { verdict = "Early exit"; sub = `Undone at the ${stage}. Back to the drawing board.`; }
  }

  const copyResult = () => {
    const lines = [
      `7-0 IPL — ${verdict} (${won}/7)`,
      ...players.map((p) => `${p.role.padEnd(4)} ${p.name} — ${p._src} (${p.overall})`),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <section className="max-w-3xl mx-auto px-5 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={clsx(
          "rounded-[20px] p-7 text-center shadow-2xl bg-gradient-to-br from-panel2 to-panel border",
          perfect ? "border-accent shadow-[0_0_40px_rgba(255,122,26,0.35)]" : "border-line"
        )}
      >
        {perfect && (
          <div className="text-[64px] font-black text-accent tracking-tighter mb-1" style={{ textShadow: "0 0 30px rgba(255,122,26,0.4)" }}>
            7–0
          </div>
        )}
        <h2 className="text-[clamp(26px,5vw,40px)] font-black m-0 mb-1.5">{verdict}</h2>
        <p className="text-slate-400 mb-4.5">{sub}</p>

        <div className="flex justify-center gap-6 flex-wrap mb-3">
          <Stat label="Matches won" value={`${won}/7`} />
          <Stat label="Batting" value={Math.round(simMeta.r.batting)} />
          <Stat label="Bowling" value={Math.round(simMeta.r.bowling)} />
          <Stat label="Overall" value={Math.round(simMeta.r.overall)} />
        </div>

        <div className="grid gap-2 mt-5 text-left" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))" }}>
          {players.map((p, i) => (
            <div key={i} className="bg-panel border border-line rounded-lg px-2.5 py-2 text-[13px] flex justify-between gap-1.5">
              <span className="truncate">
                {p.name}
                <small className="block text-slate-400 text-[10.5px]">{p.role} · {p._src}</small>
                {p.cap && <span className="block mt-1"><CapBadge cap={p.cap} /></span>}
              </span>
              <span className="font-extrabold text-accent">{p.overall}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-400 text-sm mt-4">
          {formation.name} · {mode.name} · {difficulty.name} · {style.name} style
        </p>
      </motion.div>

      <div className="mt-6">
        <h3 className="text-center font-bold mb-3">Full Cup Run Scorecard</h3>
        <div className="flex flex-col gap-2">
          {simResults.map((m, i) => (
            <button
              key={i}
              onClick={() => setOpenIdx(i)}
              className="flex justify-between items-center gap-3 bg-panel border border-line rounded-xl px-4 py-2.5 hover:border-accent2 transition-colors cursor-pointer text-left"
            >
              <span className="text-[13px] font-extrabold text-slate-400 uppercase tracking-wide w-36">{m.stage}</span>
              <span className="flex-1 text-sm">
                You <b>{m.ourRuns}</b> vs <b>{m.theirRuns}</b> {m.oppName} · {m.line}
              </span>
              <span className={clsx("text-[12px] font-black px-3 py-0.5 rounded-full", m.win ? "bg-win/20 text-win" : "bg-loss/20 text-loss")}>
                {m.win ? "WON" : "LOST"}
              </span>
              <FileText size={16} className="text-accent2" />
            </button>
          ))}
        </div>
      </div>

      <div className="text-center mt-6 flex justify-center gap-3">
        <Button onClick={restart}>Draft again ↻</Button>
        <Button variant="ghost" onClick={copyResult}>{copied ? "Copied ✓" : "Copy result"}</Button>
      </div>

      {openIdx !== null && simResults[openIdx] && (
        <ScorecardModal match={simResults[openIdx]} onClose={() => setOpenIdx(null)} />
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-[13px] text-slate-400 text-center">
      <b className="block text-[22px] text-ink">{value}</b>
      {label}
    </div>
  );
}
