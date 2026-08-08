import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Zap, FileText, ChevronDown, Shuffle, Users } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { STYLES } from "../engine/constants";
import { tossText, GROUP_MATCHES } from "../engine/simulate";
import Flag from "../components/Flag";
import ScorecardModal from "../components/ScorecardModal";
import { BigButton, ChoiceCard, BottomBar, SectionTitle } from "./mui";

type RevealPhase = "teams" | "groups" | "done";

export default function MStyle() {
  const {
    style, setStyle, runSimulation, simResults, simMeta,
    goToResult, goToKnockout, openScorecard, showScorecardFor,
  } = useGameStore();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const started = simResults.length > 0;
  const groupResults = simResults.slice(0, GROUP_MATCHES);

  // A page reload while already past the draw shouldn't replay it -- only a
  // fresh "Simulate" click (which flips `started` false -> true this session)
  // should trigger the reveal sequence.
  const [phase, setPhase] = useState<RevealPhase>(() => (started ? "done" : "teams"));
  const [teamsRevealed, setTeamsRevealed] = useState(false);
  const [groupsRevealed, setGroupsRevealed] = useState(false);
  const [revealedMatches, setRevealedMatches] = useState(() => (started ? GROUP_MATCHES : 0));

  const allTeams = simMeta?.allGroupStandings.flat() ?? [];
  const groups = simMeta?.allGroupStandings ?? [];

  useEffect(() => {
    if (!started || phase !== "teams") return;
    setTeamsRevealed(false);
    const id = setTimeout(() => setTeamsRevealed(true), Math.min(allTeams.length * 35, 1400) + 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, phase]);

  useEffect(() => {
    if (phase !== "groups") return;
    setGroupsRevealed(false);
    const id = setTimeout(() => setGroupsRevealed(true), groups.length * 140 + 500);
    return () => clearTimeout(id);
  }, [phase, groups.length]);

  // One group match reveals at a time, on its own delay, rather than all
  // three landing on screen together -- each feels like its own result.
  useEffect(() => {
    if (phase !== "done") return;
    setRevealedMatches(1);
    const id = setInterval(() => {
      setRevealedMatches((n) => {
        if (n >= groupResults.length) { clearInterval(id); return n; }
        return n + 1;
      });
    }, 900);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const beginTournament = () => {
    runSimulation();
    setPhase("teams");
  };

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
          <BigButton onClick={beginTournament}>
            <Zap size={18} aria-hidden="true" /> Simulate the Cup Run
          </BigButton>
        </BottomBar>
      </div>
    );
  }

  if (phase === "teams") {
    return (
      <div className="flex flex-col min-h-0 grow">
        <div className="grow overflow-y-auto px-4 pb-4">
          <h1 className="text-[22px] font-black text-center mt-5 mb-1">Assembling the World Cup</h1>
          <p className="text-[13px] text-slate-400 text-center mt-0 mb-4">
            32 teams, drawn from every World Cup, 1975–2023 — including yours.
          </p>
          <div className="grid grid-cols-4 gap-2.5">
            {allTeams.map((t, i) => (
              <motion.div
                key={`${t.code}-${t.name}-${i}`}
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.035, 1.1), type: "spring", stiffness: 260, damping: 18 }}
                className={clsx(
                  "rounded-xl border-2 p-1.5 flex flex-col items-center gap-1 text-center",
                  t.isYou ? "border-accent bg-accent/10" : "border-line bg-panel"
                )}
              >
                <Flag code={t.code} isYou={t.isYou} className="w-7 h-7 rounded shrink-0 ring-1 ring-black/10 object-cover" />
                <span className="text-[9px] font-bold leading-tight truncate w-full">{t.isYou ? "You" : t.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <BottomBar>
          {teamsRevealed ? (
            <BigButton onClick={() => setPhase("groups")}>
              <Shuffle size={18} aria-hidden="true" /> Draw Groups
            </BigButton>
          ) : (
            <p className="text-center text-[13px] text-slate-400 animate-pulse m-0 py-3">Drawing the field…</p>
          )}
        </BottomBar>
      </div>
    );
  }

  if (phase === "groups") {
    return (
      <div className="flex flex-col min-h-0 grow">
        <div className="grow overflow-y-auto px-4 pb-4">
          <h1 className="text-[22px] font-black text-center mt-5 mb-1">Drawing the Groups</h1>
          <p className="text-[13px] text-slate-400 text-center mt-0 mb-4">
            8 groups of 4 — every team plays all 3 group matches, no matter the result.
          </p>
          <div className="flex flex-col gap-3">
            {groups.map((g, gi) => (
              <motion.div
                key={gi}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.14 }}
                className={clsx(
                  "rounded-2xl border-2 p-3",
                  g.some((t) => t.isYou) ? "border-accent bg-accent/8" : "border-line bg-panel"
                )}
              >
                <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 m-0 mb-2">
                  <Users size={12} aria-hidden="true" /> Group {gi + 1}
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {g.map((t, ti) => (
                    <motion.div
                      key={t.code + ti}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: gi * 0.14 + ti * 0.06 + 0.1 }}
                      className="flex flex-col items-center gap-1 text-center"
                    >
                      <Flag code={t.code} isYou={t.isYou} className="w-7 h-7 rounded shrink-0 ring-1 ring-black/10 object-cover" />
                      <span className="text-[9px] font-bold leading-tight truncate w-full">{t.isYou ? "You" : t.name}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <BottomBar>
          {groupsRevealed ? (
            <BigButton onClick={() => setPhase("done")}>Enter the Tournament</BigButton>
          ) : (
            <p className="text-center text-[13px] text-slate-400 animate-pulse m-0 py-3">Forming the groups…</p>
          )}
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
          {groupResults.slice(0, revealedMatches).map((m, i) => (
            <li key={i}>
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
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
          {revealedMatches < groupResults.length && (
            <li>
              <div className="rounded-2xl border-2 border-dashed border-line bg-panel2 px-3.5 py-4 text-center text-[13px] text-slate-400 animate-pulse">
                Playing {groupResults[revealedMatches]?.stage}…
              </div>
            </li>
          )}
        </ul>
      </div>

      {revealedMatches >= groupResults.length && (
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
      )}

      {showScorecardFor !== null && simResults[showScorecardFor] && (
        <ScorecardModal match={simResults[showScorecardFor]} />
      )}
    </div>
  );
}
