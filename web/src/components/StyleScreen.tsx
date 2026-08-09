import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { ChevronDown, FileText, Shuffle, Users } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { STYLES } from "../engine/constants";
import { tossText, GROUP_MATCHES } from "../engine/simulate";
import { OptionCard, Button } from "./ui";
import Flag from "./Flag";
import ScorecardModal from "./ScorecardModal";

type RevealPhase = "teams" | "groups" | "done";

export default function StyleScreen() {
  const {
    style, setStyle, runSimulation, simResults, simMeta,
    simExpanded, toggleMatchExpand, goToKnockout, openScorecard, showScorecardFor,
  } = useGameStore();

  const started = simResults.length > 0;
  const groupResults = simResults.slice(0, GROUP_MATCHES);

  // A page reload while already past the draw shouldn't replay it -- only a
  // fresh "Simulate" click (which flips `started` false -> true this
  // session) should trigger the reveal sequence.
  const [phase, setPhase] = useState<RevealPhase>(() => (started ? "done" : "teams"));
  const [teamsRevealed, setTeamsRevealed] = useState(false);
  const [groupsRevealed, setGroupsRevealed] = useState(false);
  const [revealedMatches, setRevealedMatches] = useState(() => (started ? GROUP_MATCHES : 0));

  const allTeams = simMeta?.allGroupStandings.flat() ?? [];
  const groups = simMeta?.allGroupStandings ?? [];

  useEffect(() => {
    if (!started || phase !== "teams") return;
    setTeamsRevealed(false);
    const id = setTimeout(() => setTeamsRevealed(true), Math.min(allTeams.length * 30, 1200) + 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, phase]);

  useEffect(() => {
    if (phase !== "groups") return;
    setGroupsRevealed(false);
    const id = setTimeout(() => setGroupsRevealed(true), groups.length * 110 + 500);
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
            <Button size="lg" onClick={beginTournament}>
              Simulate the Cup Run ⚡
            </Button>
          </div>
        </>
      )}

      {started && phase === "teams" && (
        <>
          <h2 className="text-center text-2xl font-bold mb-1">Assembling the World Cup</h2>
          <p className="text-center text-slate-400 text-sm mb-6">
            32 teams, drawn from every World Cup, 1975–2023 — including yours.
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {allTeams.map((t, i) => (
              <motion.div
                key={`${t.code}-${t.name}-${i}`}
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 1), type: "spring", stiffness: 260, damping: 18 }}
                className={clsx(
                  "rounded-xl border-2 p-2 flex flex-col items-center gap-1 text-center",
                  t.isYou ? "border-accent bg-accent/10" : "border-line bg-panel"
                )}
              >
                <Flag code={t.code} isYou={t.isYou} className="w-8 h-8 rounded shrink-0 ring-1 ring-black/10 object-cover" />
                <span className="text-[10px] font-bold leading-tight truncate w-full">{t.isYou ? "You" : t.name}</span>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-7">
            {teamsRevealed ? (
              <Button size="lg" onClick={() => setPhase("groups")}>
                <span className="inline-flex items-center gap-1.5"><Shuffle size={16} /> Draw Groups</span>
              </Button>
            ) : (
              <p className="text-slate-400 text-sm animate-pulse">Drawing the field…</p>
            )}
          </div>
        </>
      )}

      {started && phase === "groups" && (
        <>
          <h2 className="text-center text-2xl font-bold mb-1">Drawing the Groups</h2>
          <p className="text-center text-slate-400 text-sm mb-6">
            8 groups of 4 — every team plays all 3 group matches, no matter the result.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {groups.map((g, gi) => (
              <motion.div
                key={gi}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.11 }}
                className={clsx(
                  "rounded-xl border-2 p-3.5",
                  g.some((t) => t.isYou) ? "border-accent bg-accent/8" : "border-line bg-panel"
                )}
              >
                <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 m-0 mb-2.5">
                  <Users size={12} /> Group {gi + 1}
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {g.map((t, ti) => (
                    <motion.div
                      key={t.code + ti}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: gi * 0.11 + ti * 0.05 + 0.1 }}
                      className="flex flex-col items-center gap-1 text-center"
                    >
                      <Flag code={t.code} isYou={t.isYou} className="w-8 h-8 rounded shrink-0 ring-1 ring-black/10 object-cover" />
                      <span className="text-[10px] font-bold leading-tight truncate w-full">{t.isYou ? "You" : t.name}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-7">
            {groupsRevealed ? (
              <Button size="lg" onClick={() => setPhase("done")}>
                Enter the Tournament →
              </Button>
            ) : (
              <p className="text-slate-400 text-sm animate-pulse">Forming the groups…</p>
            )}
          </div>
        </>
      )}

      {started && phase === "done" && simMeta && (
        <div className="flex flex-col gap-2.5">
          <div className="text-center mb-2">
            <h3 className="text-xl font-bold m-0 mb-1">Group Stage</h3>
            <p className="text-slate-400 text-sm m-0">
              Team strength {Math.round(simMeta.teamStrength)} · {style.name} style · your group of 4, all 3
              matches played regardless of result — click any to see details
            </p>
          </div>

          <AnimatePresence>
            {groupResults.slice(0, revealedMatches).map((m, i) => {
              const expanded = simExpanded.has(i);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className="rounded-xl overflow-hidden"
                >
                  <div
                    onClick={() => toggleMatchExpand(i)}
                    className="grid gap-2.5 items-center bg-panel border border-line rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-accent2 transition-colors"
                    style={{ gridTemplateColumns: "150px 1fr auto auto" }}
                  >
                    <span className="text-[13px] font-extrabold text-slate-400 uppercase tracking-wide">{m.stage}</span>
                    <span className="text-sm">
                      You <b>{m.ourRuns}</b> &nbsp;vs&nbsp; <b>{m.theirRuns}</b> <Flag code={m.oppCode} /> {m.oppName} · {m.line}
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
          {revealedMatches < groupResults.length && (
            <div className="rounded-xl border-2 border-dashed border-line bg-panel2 px-4 py-3 text-center text-sm text-slate-400 animate-pulse">
              Playing {groupResults[revealedMatches]?.stage}…
            </div>
          )}

          {revealedMatches >= groupResults.length && (
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
                  <p className="text-loss font-bold text-sm mb-2">
                    Group Stage complete — not enough to reach the knockouts, but the rest of the 32-team bracket still played out.
                  </p>
                  {/* The bracket always simulates, even for the 30 teams that
                      aren't you, so it's still worth browsing -- BracketScreen
                      shows it fully revealed and read-only when you're not
                      part of any tie. */}
                  <Button size="lg" onClick={goToKnockout}>
                    See the Knockout Bracket →
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showScorecardFor !== null && simResults[showScorecardFor] && <ScorecardModal match={simResults[showScorecardFor]} />}
    </section>
  );
}
