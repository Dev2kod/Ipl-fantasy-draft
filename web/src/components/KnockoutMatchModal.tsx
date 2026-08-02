import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { FileText, Swords, X } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { GROUP_MATCHES, tossText } from "../engine/simulate";
import { FLAGS } from "../engine/constants";
import { Button, CricketBallGlyph } from "./ui";
import ScorecardModal from "./ScorecardModal";

function TeamBadge({ name, colour, flag }: { name: string; colour: string; flag: string }) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <span
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl shadow-lg shrink-0"
        style={{ background: colour }}
      >
        {flag}
      </span>
      <span className="font-extrabold text-[12.5px] sm:text-sm text-center max-w-[130px] leading-tight truncate">{name}</span>
    </div>
  );
}

function VsRow({ oppName, oppColour, oppFlag, dim }: { oppName: string; oppColour: string; oppFlag: string; dim?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-center gap-5 sm:gap-10 transition-opacity", dim && "opacity-70")}>
      <TeamBadge name="You" colour="#ff7a1a" flag="🏏" />
      <span className="text-xl sm:text-2xl font-black text-slate-400 shrink-0">VS</span>
      <TeamBadge name={oppName} colour={oppColour} flag={oppFlag} />
    </div>
  );
}

/**
 * The FIFA-inspired pre-match / simulating / result popup for the current
 * knockout match -- rendered as an overlay ON TOP of the bracket screen
 * (which stays visible, dimmed, behind it) rather than replacing it, so the
 * tournament path is always the "home" view and this is just the match-day
 * moment layered over it.
 */
export default function KnockoutMatchModal() {
  const {
    simResults, simMeta, knockoutIdx, knockoutPhase, knockoutModalOpen,
    playKnockoutMatch, continueKnockout, openScorecard, showScorecardFor,
  } = useGameStore();

  const globalIdx = GROUP_MATCHES + knockoutIdx;
  const match = simResults[globalIdx];
  if (!knockoutModalOpen || !simMeta || !match) return null;

  const oppFlag = FLAGS[match.oppCode] ?? "🏏";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-panel border border-line rounded-3xl shadow-2xl overflow-hidden"
        >
          <CricketBallGlyph className="absolute w-48 h-48 text-accent/5 -top-10 -right-14 rotate-12 pointer-events-none" />
          <CricketBallGlyph className="absolute w-32 h-32 text-accent2/5 -bottom-10 -left-10 -rotate-12 pointer-events-none" />

          <div className="relative flex items-center justify-center pt-6 pb-1 px-8">
            <span className="text-[12px] font-black tracking-[3px] uppercase text-accent bg-accent/10 border border-accent/30 rounded-full px-4 py-1.5">
              {match.stage}
            </span>
            {knockoutPhase === "result" && (
              <button
                onClick={continueKnockout}
                title="Close"
                className="absolute right-5 top-5 text-slate-400 hover:text-ink cursor-pointer bg-transparent border-none p-1"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {knockoutPhase === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative px-8 pb-9 pt-5"
              >
                <VsRow oppName={match.oppName} oppColour={match.oppColour} oppFlag={oppFlag} />
                <p className="text-center text-slate-400 text-[12.5px] mt-4">Rival strength ≈ {match.oppStrength} · your win chance ≈ {Math.round(match.prob * 100)}%</p>
                <div className="text-center mt-6">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
                    <Button size="lg" onClick={playKnockoutMatch}>
                      <span className="inline-flex items-center gap-2"><Swords size={18} /> Kick Off ▶</span>
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {knockoutPhase === "simulating" && (
              <motion.div
                key="sim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative px-8 pb-10 pt-5 text-center"
              >
                <VsRow oppName={match.oppName} oppColour={match.oppColour} oppFlag={oppFlag} dim />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-14 h-14 mx-auto mt-7 text-accent"
                >
                  <CricketBallGlyph className="w-full h-full" />
                </motion.div>
                <p className="text-slate-400 font-bold mt-3 tracking-[2px] text-[13px]">SIMULATING…</p>
              </motion.div>
            )}

            {knockoutPhase === "result" && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative px-6 sm:px-8 pb-8 pt-4"
              >
                <div className="flex items-center justify-center gap-4 sm:gap-8">
                  <TeamBadge name="You" colour="#ff7a1a" flag="🏏" />
                  <div className="text-center shrink-0">
                    <div className="text-[38px] sm:text-[54px] font-black leading-none tracking-tight">
                      {match.ourRuns} <span className="text-slate-400 text-2xl">–</span> {match.theirRuns}
                    </div>
                    <span className={clsx("inline-block mt-2 text-[11.5px] font-black px-3 py-1 rounded-full tracking-wide", match.win ? "bg-win/20 text-win" : "bg-loss/20 text-loss")}>
                      FULL TIME · {match.win ? "WON" : "LOST"}
                    </span>
                  </div>
                  <TeamBadge name={match.oppName} colour={match.oppColour} flag={oppFlag} />
                </div>

                <div className="text-center mt-5 text-[13.5px] flex flex-col gap-1.5">
                  <p className="m-0">{tossText(match)}</p>
                  {match.highlight && <p className="m-0">{match.highlight}</p>}
                  <p className="m-0 text-slate-400">{match.line}</p>
                  <button
                    onClick={() => openScorecard(globalIdx)}
                    className="self-center mt-1 inline-flex items-center gap-1.5 text-accent2 text-[13px] font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                  >
                    <FileText size={14} /> View full scorecard
                  </button>
                </div>

                <div className="text-center mt-6">
                  <Button size="lg" onClick={continueKnockout}>
                    Back to Bracket →
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {showScorecardFor !== null && simResults[showScorecardFor] && <ScorecardModal match={simResults[showScorecardFor]} />}
    </AnimatePresence>
  );
}
