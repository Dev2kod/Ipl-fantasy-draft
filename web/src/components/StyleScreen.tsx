import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { ChevronDown, FileText } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { STYLES, FLAGS } from "../engine/constants";
import { tossText, GROUP_MATCHES } from "../engine/simulate";
import { OptionCard, Button } from "./ui";
import ScorecardModal from "./ScorecardModal";

export default function StyleScreen() {
  const {
    style, setStyle, runSimulation, simResults, simMeta,
    simExpanded, toggleMatchExpand, goToResult, goToKnockout, openScorecard, showScorecardFor,
  } = useGameStore();

  const started = simResults.length > 0;
  const groupResults = simResults.slice(0, GROUP_MATCHES);

  return (
    <section className="max-w-4xl mx-auto px-5 py-6">
      {!started && (
        <>
          <h2 className="text-center text-2xl font-bold mb-5">Pick your match style</h2>
          <div className="grid md:grid-cols-3 gap-3.5 max-w-3xl mx-auto">
            {STYLES.map((s) => (
              <OptionCard key={s.id} title={s.name} desc={s.desc} selected={style.id === s.id} onClick={() => setStyle(s)} />
            ))}
          </div>
          <div className="text-center mt-7">
            <Button size="lg" onClick={runSimulation}>
              Simulate the Cup Run ⚡
            </Button>
          </div>
        </>
      )}

      {started && simMeta && (
        <div className="flex flex-col gap-2.5">
          <div className="text-center mb-2">
            <h3 className="text-xl font-bold m-0 mb-1">Group Stage</h3>
            <p className="text-slate-400 text-sm m-0">
              Team strength {Math.round(simMeta.teamStrength)} · {style.name} style · your group of 4, all 3
              matches played regardless of result — click any to see details
            </p>
          </div>

          <AnimatePresence>
            {groupResults.map((m, i) => {
              const expanded = simExpanded.has(i);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-xl overflow-hidden"
                >
                  <div
                    onClick={() => toggleMatchExpand(i)}
                    className="grid gap-2.5 items-center bg-panel border border-line rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-accent2 transition-colors"
                    style={{ gridTemplateColumns: "150px 1fr auto auto" }}
                  >
                    <span className="text-[13px] font-extrabold text-slate-400 uppercase tracking-wide">{m.stage}</span>
                    <span className="text-sm">
                      You <b>{m.ourRuns}</b> &nbsp;vs&nbsp; <b>{m.theirRuns}</b> {FLAGS[m.oppCode] ?? "🏏"} {m.oppName} · {m.line}
                    </span>
                    <span className={clsx("text-[12px] font-black px-3 py-0.5 rounded-full", m.win ? "bg-win/20 text-win" : "bg-loss/20 text-loss")}>
                      {m.win ? "WON" : "LOST"}
                    </span>
                    <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
                      <ChevronDown size={16} className="text-slate-400" />
                    </motion.span>
                  </div>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-panel2 border border-t-0 border-line rounded-b-xl px-4 overflow-hidden"
                      >
                        <div className="py-3 text-[13.5px] flex flex-col gap-1.5">
                          <p className="m-0">{tossText(m)}</p>
                          {m.highlight && <p className="m-0">{m.highlight}</p>}
                          <p className="m-0 text-slate-400">
                            Rival strength ≈ {m.oppStrength} · your win chance was {Math.round(m.prob * 100)}%
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); openScorecard(i); }}
                            className="self-start mt-1 inline-flex items-center gap-1.5 text-accent2 text-[13px] font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                          >
                            <FileText size={14} /> View full scorecard
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <div className="text-center mt-4">
            {simMeta.qualified ? (
              <>
                <p className="text-win font-bold text-sm mb-2">
                  Finished top 2 in your group — you're through to the knockouts!
                </p>
                <Button size="lg" onClick={goToKnockout}>
                  Continue to Knockouts →
                </Button>
              </>
            ) : (
              <>
                <p className="text-loss font-bold text-sm mb-2">Group Stage complete — not enough to reach the knockouts.</p>
                <Button size="lg" onClick={goToResult}>
                  See Final Result →
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {showScorecardFor !== null && simResults[showScorecardFor] && <ScorecardModal match={simResults[showScorecardFor]} />}
    </section>
  );
}
