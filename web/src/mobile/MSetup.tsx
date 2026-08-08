import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, Flame, Eye, LayoutList, BookOpen, ChevronRight, Play, ArrowLeft, Sparkles } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { MODES, DIFFICULTIES, POSITION_FORMATION } from "../engine/constants";
import { CricketBallGlyph } from "../components/ui";
import { BigButton, ChoiceCard, BottomBar, SectionTitle, Sheet } from "./mui";

const SHAPE_COUNTS = POSITION_FORMATION.reduce<Record<string, number>>((acc, s) => {
  acc[s.position] = (acc[s.position] ?? 0) + 1;
  return acc;
}, {});

const SNAPSHOTS = [
  {
    src: "/screenshots/draft.png",
    title: "Draft real historical squads",
    desc: "Every market is a genuine World Cup squad. Pick a player who fits an open real-life job.",
  },
  {
    src: "/screenshots/result.png",
    title: "A real 32-team World Cup",
    desc: "8 groups of 4, then Round of 16 → Quarter-Final → Semi-Final → Final, plus a stats leaderboard.",
  },
];

const TRIVIA = [
  "The first Cricket World Cup was held in England in 1975 — West Indies, led by Clive Lloyd, won it.",
  "Kapil Dev's India shocked the cricket world by winning the 1983 World Cup, beating the mighty West Indies in the final at Lord's.",
  "The 1992 World Cup was the first to use coloured kits, white balls, and day-night matches.",
  "The 1996 World Cup was jointly hosted by India, Pakistan, and Sri Lanka — Sri Lanka won their only title that year.",
  "Australia have won the trophy six times — 1987, 1999, 2003, 2007, 2015, and 2023 — more than any other side.",
  "The 2019 final between England and New Zealand finished tied after 50 overs, then tied again after a Super Over — England won only on a boundary-count countback.",
  "In the 1999 semi-final, Allan Donald's run-out off the last ball sent Australia through over South Africa in one of the game's most agonising finishes.",
  "A bowler can send down a maximum of 10 overs in a 50-over ODI innings, no matter how well they're bowling.",
  "Sachin Tendulkar is cricket's all-time leading run-scorer at the World Cup, across a record six tournaments.",
  "Associate nations like Kenya, Netherlands, Canada, and even one-off entrants like East Africa have all played in a Cricket World Cup.",
  "The Duckworth-Lewis method (now DLS) recalculates a target when rain interrupts an innings — first used in international cricket in 1997.",
  "Zimbabwe's 1983 upset over Australia, led by captain Duncan Fletcher's 4 wickets and 69 runs, remains one of the great World Cup shocks.",
];

const HOW_TO_PLAY = [
  {
    title: "Choose your settings",
    desc: "Classic shows ratings; Almanac hides them for a memory test. Then pick a difficulty — it sets how strong the 31 other real squads in your World Cup are.",
  },
  {
    title: "Draft your XI",
    desc: "Each turn draws one random nation & World Cup year as your market. Pick one player who fits an open slot — a player can be signed only once. Every pick gives you 3 switches to a different market.",
  },
  {
    title: "Lock in & choose a style",
    desc: "Once your XI is full, edit positions if you like, then pick Aggressive, Balanced, or Defensive as your match style.",
  },
  {
    title: "Play the tournament",
    desc: "You're drawn into a group of 4 and play all 3 group matches — one loss doesn't end your run. Finish top 2 and advance through the Round of 16, Quarter-Final, Semi-Final, and Final.",
  },
  {
    title: "Chase the 7-0",
    desc: "Win every match you play — up to seven — and lift the trophy completely unbeaten.",
  },
];

export default function MSetup() {
  const { data, mode, difficulty, setMode, setDifficulty, startDraft } = useGameStore();
  const [view, setView] = useState<"home" | "settings">("home");
  const [howToPlay, setHowToPlay] = useState(false);
  const [triviaIdx, setTriviaIdx] = useState(0);
  const nSq = data?.squads.length ?? 0;
  const nPl = data ? data.squads.reduce((a, s) => a + s.players.length, 0) : 0;

  useEffect(() => {
    if (view !== "home") return;
    const id = setInterval(() => setTriviaIdx((i) => (i + 1) % TRIVIA.length), 5000);
    return () => clearInterval(id);
  }, [view]);

  return (
    <div className="flex flex-col min-h-0 grow">
      <div className="grow overflow-y-auto px-4 pb-4">
        <AnimatePresence mode="wait">
          {view === "home" ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <header className="relative pt-7 pb-3 text-center overflow-hidden">
                <CricketBallGlyph className="absolute w-32 h-32 text-accent/10 -top-4 -left-8 -rotate-12 pointer-events-none" />
                <CricketBallGlyph className="absolute w-40 h-40 text-accent2/10 -bottom-6 -right-10 rotate-12 pointer-events-none" />

                <h1 className="relative text-[34px] leading-[1.12] font-black m-0">
                  Build a Champion XI.
                  <br />
                  Chase the perfect <span className="text-accent">7–0</span>.
                </h1>
                <p className="relative text-[14.5px] text-slate-400 mt-3 mb-0 max-w-[320px] mx-auto">
                  Each turn draws a real nation and World Cup year as your market. Draft one
                  player at a time, then take your XI through a genuine 32-team tournament —
                  win every match, up to seven, completely unbeaten.
                </p>
                <dl className="relative flex justify-center gap-6 mt-5 mb-0">
                  {[
                    ["13", "World Cups"],
                    [String(nSq || 143), "Squads"],
                    [nPl ? nPl.toLocaleString() : "2,050", "Players"],
                  ].map(([v, k]) => (
                    <div key={k} className="text-center">
                      <dd className="text-[22px] font-black text-accent m-0 leading-none">{v}</dd>
                      <dt className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold mt-1">{k}</dt>
                    </div>
                  ))}
                </dl>

                <button
                  type="button"
                  onClick={() => setHowToPlay(true)}
                  className="relative inline-flex items-center gap-1.5 mt-5 min-h-[40px] px-4 rounded-full border-2 border-line bg-panel text-[13px] font-bold active:bg-panel2"
                >
                  <BookOpen size={14} className="text-accent2" aria-hidden="true" /> How to play
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </header>

              <section aria-labelledby="m-see-it" className="mt-6">
                <SectionTitle>
                  <span id="m-see-it" className="inline-flex items-center gap-1.5">
                    <Eye size={13} aria-hidden="true" /> See it in action
                  </span>
                </SectionTitle>
                <div className="flex flex-col gap-4">
                  {SNAPSHOTS.map((snap) => (
                    <div
                      key={snap.src}
                      className="bg-panel border border-line rounded-2xl overflow-hidden shadow-xl"
                    >
                      <div className="h-44 overflow-hidden border-b border-line">
                        <img
                          src={snap.src}
                          alt={snap.title}
                          loading="lazy"
                          className="w-full h-full object-cover object-top block"
                        />
                      </div>
                      <div className="p-3.5">
                        <h3 className="font-extrabold text-[14.5px] m-0 mb-1">{snap.title}</h3>
                        <p className="text-slate-400 text-[12.5px] m-0">{snap.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-labelledby="m-trivia" className="mt-6">
                <SectionTitle>
                  <span id="m-trivia" className="inline-flex items-center gap-1.5">
                    <Sparkles size={13} aria-hidden="true" /> Did you know?
                  </span>
                </SectionTitle>
                <div className="relative bg-panel border border-line rounded-2xl p-4 min-h-[92px] overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={triviaIdx}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.35 }}
                      className="text-[13.5px] text-ink leading-relaxed m-0"
                    >
                      {TRIVIA[triviaIdx]}
                    </motion.p>
                  </AnimatePresence>
                  <div className="flex justify-center gap-1.5 mt-3">
                    {TRIVIA.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setTriviaIdx(i)}
                        aria-label={`Trivia ${i + 1} of ${TRIVIA.length}`}
                        aria-current={i === triviaIdx}
                        className={i === triviaIdx ? "w-4 h-1.5 rounded-full bg-accent" : "w-1.5 h-1.5 rounded-full bg-line"}
                      />
                    ))}
                  </div>
                </div>
              </section>

              <section aria-labelledby="m-shape" className="mt-6">
                <SectionTitle>
                  <span id="m-shape" className="inline-flex items-center gap-1.5">
                    <LayoutList size={13} aria-hidden="true" /> Your XI shape
                  </span>
                </SectionTitle>
                <div className="bg-panel border border-line rounded-2xl p-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(SHAPE_COUNTS).map(([pos, n]) => (
                      <span key={pos} className="bg-panel2 border border-line rounded-full px-3 py-1.5 text-[12px] font-bold">
                        {n}× {pos}
                      </span>
                    ))}
                  </div>
                  <p className="text-[12.5px] text-slate-400 m-0 mt-2.5">
                    A player only fits a slot matching a job they'd really do. You can move
                    them between slots later.
                  </p>
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center gap-2 pt-4 pb-1">
                <button
                  type="button"
                  onClick={() => setView("home")}
                  aria-label="Back"
                  className="w-11 h-11 -ml-2 grid place-items-center rounded-xl text-slate-400 active:bg-panel2"
                >
                  <ArrowLeft size={19} aria-hidden="true" />
                </button>
                <h2 className="text-[17px] font-extrabold m-0">Set up your draft</h2>
              </div>

              <section aria-labelledby="m-ratings" className="mt-4">
                <SectionTitle>
                  <span id="m-ratings" className="inline-flex items-center gap-1.5">
                    <Eye size={13} aria-hidden="true" /> Ratings mode
                  </span>
                </SectionTitle>
                <div className="flex flex-col gap-2.5">
                  {MODES.map((m) => (
                    <ChoiceCard
                      key={m.id}
                      title={m.name}
                      desc={m.desc}
                      selected={mode.id === m.id}
                      onClick={() => setMode(m)}
                    />
                  ))}
                </div>
              </section>

              <section aria-labelledby="m-diff" className="mt-5">
                <SectionTitle>
                  <span id="m-diff" className="inline-flex items-center gap-1.5">
                    <Flame size={13} aria-hidden="true" /> Difficulty
                  </span>
                </SectionTitle>
                <div className="flex flex-col gap-2.5">
                  {DIFFICULTIES.map((d) => (
                    <ChoiceCard
                      key={d.id}
                      title={d.name}
                      desc={d.desc}
                      selected={difficulty.id === d.id}
                      onClick={() => setDifficulty(d)}
                      extra={<span className="text-[12px] text-slate-400">Rival strength ≈ {d.opp}</span>}
                    />
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomBar>
        {view === "home" ? (
          <BigButton onClick={() => setView("settings")} disabled={!data}>
            <Play size={18} aria-hidden="true" /> Play
          </BigButton>
        ) : (
          <BigButton onClick={startDraft} disabled={!data}>
            <Trophy size={18} aria-hidden="true" /> Start the Draft
          </BigButton>
        )}
      </BottomBar>

      <Sheet open={howToPlay} onClose={() => setHowToPlay(false)} title="How to play">
        <ol className="flex flex-col gap-4 m-0 p-0 list-none">
          {HOW_TO_PLAY.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent/15 text-accent grid place-items-center text-[13px] font-black">
                {i + 1}
              </span>
              <div>
                <h3 className="font-extrabold text-[14px] m-0 mb-0.5">{step.title}</h3>
                <p className="text-slate-400 text-[13px] m-0">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  );
}
