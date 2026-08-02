import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import type { Innings, MatchResult } from "../engine/simulate";
import { tossText } from "../engine/simulate";
import { FLAGS } from "../engine/constants";

function InningsTable({ innings, flag }: { innings: Innings; flag: string }) {
  return (
    <div className="bg-panel2 border border-line rounded-xl p-3.5">
      <div className="flex justify-between items-baseline mb-2.5">
        <h4 className="font-extrabold text-[15px] m-0">{flag} {innings.team}</h4>
        <div className="text-lg font-black text-accent">
          {innings.runs}/{innings.wickets} <span className="text-slate-400 text-xs font-normal">({innings.overs.toFixed(1)} ov)</span>
        </div>
      </div>
      <table className="w-full text-[13px] border-collapse mb-3">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="font-medium pb-1">Batter</th>
            <th className="font-medium pb-1 text-right">R</th>
            <th className="font-medium pb-1 text-right">B</th>
          </tr>
        </thead>
        <tbody>
          {innings.batters.map((b, i) => (
            <tr key={i} className="border-t border-line/60">
              <td className="py-1">
                {b.name} {!b.out && <span className="text-accent2 text-[11px]">not out</span>}
              </td>
              <td className="py-1 text-right font-bold">{b.runs}</td>
              <td className="py-1 text-right text-slate-400">{b.balls}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="font-medium pb-1">Bowler</th>
            <th className="font-medium pb-1 text-right">O</th>
            <th className="font-medium pb-1 text-right">R</th>
            <th className="font-medium pb-1 text-right">W</th>
          </tr>
        </thead>
        <tbody>
          {innings.bowlers.map((b, i) => (
            <tr key={i} className="border-t border-line/60">
              <td className="py-1">{b.name}</td>
              <td className="py-1 text-right text-slate-400">{b.overs.toFixed(1)}</td>
              <td className="py-1 text-right text-slate-400">{b.runsConceded}</td>
              <td className="py-1 text-right font-bold text-accent">{b.wickets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScorecardModal({ match, onClose }: { match: MatchResult; onClose?: () => void }) {
  const closeScorecard = useGameStore((s) => s.closeScorecard);
  const close = onClose ?? closeScorecard;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-panel border border-line rounded-2xl p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto scrollbar-thin"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-bold m-0">{match.stage} — Full Scorecard</h3>
              <p className="text-slate-400 text-[13px] m-0 mt-1">{tossText(match)}</p>
            </div>
            <button onClick={close} className="bg-transparent border-none text-slate-400 hover:text-ink cursor-pointer p-1">
              <X size={20} />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3.5">
            <InningsTable innings={match.innings1} flag={match.innings1.team === "You" ? "🏏" : (FLAGS[match.oppCode] ?? "🏏")} />
            <InningsTable innings={match.innings2} flag={match.innings2.team === "You" ? "🏏" : (FLAGS[match.oppCode] ?? "🏏")} />
          </div>
          <p className="text-center mt-4 font-bold">
            {match.line} — <span className={match.win ? "text-win" : "text-loss"}>{match.win ? "You won" : "You lost"}</span>
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
