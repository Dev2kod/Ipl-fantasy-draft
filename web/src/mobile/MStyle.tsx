import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Zap, FileText, ChevronDown } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { STYLES } from "../engine/constants";
import { tossText, GROUP_MATCHES } from "../engine/simulate";
import Flag from "../components/Flag";
import ScorecardModal from "../components/ScorecardModal";
import { BigButton, ChoiceCard, BottomBar, SectionTitle } from "./mui";

export default function MStyle() {
  const {
    style, setStyle, runSimulation, simResults, simMeta,
    goToResult, goToKnockout, openScorecard, showScorecardFor,
  } = useGameStore();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const started = simResults.length > 0;
  const groupResults = simResults.slice(0, GROUP_MATCHES);

  if (!started) {
    return (
      <div className="flex flex-col min-h-0 grow">
        <div className="grow overflow-y-auto px-4 pb-4">
          <h1 className="text-[24px] font-black text-center mt-5 mb-1">Pick your match style</h1>
          <p className="text-[13.5px] text-slate-400 text-center mt-0 mb-4">
            This shapes how your XI plays every match of the tournament.
          </p>
          <div className="flex flex-col gap-2.5">
            {STYLES.map((s) => (
              <ChoiceCard
                key={s.id}
                title={s.name}
                desc={s.desc}
                selected={style.id === s.id}
                onClick={() => setStyle(s)}
              />
            ))}
          </div>
        </div>
        <BottomBar>
          <BigButton onClick={runSimulation}>
            <Zap size={18} aria-hidden="true" /> Simulate the Cup Run
          </BigButton>
        </BottomBar>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 grow">
      <div className="grow overflow-y-auto px-4 pb-4">
        <h1 className="text-[22px] font-black text-center mt-5 mb-1">Group Stage</h1>
        <p className="text-[13px] text-slate-400 text-center mt-0 mb-4">
          All 3 matches played — only the table decides who advances.
        </p>

        <SectionTitle>Your results</SectionTitle>
        <ul className="list-none m-0 p-0 flex flex-col gap-2">
          {groupResults.map((m, i) => (
            <li key={i}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="rounded-2xl border-2 border-line bg-panel overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  aria-expanded={openIdx === i}
                  className="w-full text-left px-3.5 py-3 min-h-[64px] flex items-center gap-3"
                >
                  <span className="min-w-0 grow">
                    <span className="block text-[10.5px] font-black tracking-wider uppercase text-slate-400">
                      {m.stage}
                    </span>
                    <span className="flex items-center gap-1.5 mt-1 text-[14px] font-bold">
                      <span className="tabular-nums">{m.ourRuns}</span>
                      <span className="text-slate-400 font-normal">v</span>
                      <span className="tabular-nums">{m.theirRuns}</span>
                      <Flag code={m.oppCode} className="w-4 h-4 rounded-[2px] ml-1 ring-1 ring-black/10 object-cover" />
                      <span className="truncate text-[13px] font-semibold">{m.oppName}</span>
                    </span>
                  </span>
                  <span
                    className={clsx(
                      "text-[11px] font-black px-2.5 py-1 rounded-full shrink-0",
                      m.win ? "bg-win/20 text-win" : "bg-loss/20 text-loss"
                    )}
                  >
                    {m.win ? "WON" : "LOST"}
                  </span>
                  <motion.span animate={{ rotate: openIdx === i ? 180 : 0 }} aria-hidden="true">
                    <ChevronDown size={16} className="text-slate-400" />
                  </motion.span>
                </button>
                {openIdx === i && (
                  <div className="px-3.5 pb-3 pt-1 border-t border-line bg-panel2 text-[13px] flex flex-col gap-1.5">
                    <p className="m-0">{m.line}</p>
                    <p className="m-0">{tossText(m)}</p>
                    {m.highlight && <p className="m-0">{m.highlight}</p>}
                    <button
                      type="button"
                      onClick={() => openScorecard(i)}
                      className="self-start mt-1 min-h-[44px] inline-flex items-center gap-1.5 text-accent2 font-bold"
                    >
                      <FileText size={15} aria-hidden="true" /> Full scorecard
                    </button>
                  </div>
                )}
              </motion.div>
            </li>
          ))}
        </ul>
      </div>

      <BottomBar>
        {simMeta?.qualified ? (
          <>
            <p className="text-win font-bold text-[13px] text-center m-0 mb-2">
              Top 2 — you're through to the knockouts.
            </p>
            <BigButton onClick={goToKnockout}>Continue to Knockouts</BigButton>
          </>
        ) : (
          <>
            <p className="text-loss font-bold text-[13px] text-center m-0 mb-2">
              Not enough to reach the Round of 16.
            </p>
            <BigButton onClick={goToResult}>See Final Result</BigButton>
          </>
        )}
      </BottomBar>

      {showScorecardFor !== null && simResults[showScorecardFor] && (
        <ScorecardModal match={simResults[showScorecardFor]} />
      )}
    </div>
  );
}
