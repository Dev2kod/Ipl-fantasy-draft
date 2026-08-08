import { useState } from "react";
import { Trophy, Flame, Eye, LayoutList, BookOpen, ChevronRight } from "lucide-react";
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
  const [howToPlay, setHowToPlay] = useState(false);
  const nSq = data?.squads.length ?? 0;
  const nPl = data ? data.squads.reduce((a, s) => a + s.players.length, 0) : 0;

  return (
    <div className="flex flex-col min-h-0 grow">
      <div className="grow overflow-y-auto px-4 pb-4">
        <header className="relative pt-5 pb-4 text-center overflow-hidden">
          <CricketBallGlyph className="absolute w-28 h-28 text-accent/10 -top-4 -left-8 -rotate-12 pointer-events-none" />
          <CricketBallGlyph className="absolute w-36 h-36 text-accent2/10 -bottom-6 -right-10 rotate-12 pointer-events-none" />

          <h1 className="relative text-[30px] leading-[1.15] font-black m-0">
            Build a Champion XI.
            <br />
            Chase the perfect <span className="text-accent">7–0</span>.
          </h1>
          <p className="relative text-[14px] text-slate-400 mt-3 mb-0">
            Draft one player at a time from real World Cup squads, then take your XI
            through a 32-team tournament.
          </p>
          <dl className="relative flex justify-center gap-5 mt-4 mb-0">
            {[
              ["13", "World Cups"],
              [String(nSq || 143), "Squads"],
              [nPl ? nPl.toLocaleString() : "2,050", "Players"],
            ].map(([v, k]) => (
              <div key={k} className="text-center">
                <dd className="text-[20px] font-black text-accent m-0 leading-none">{v}</dd>
                <dt className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold mt-1">{k}</dt>
              </div>
            ))}
          </dl>

          <button
            type="button"
            onClick={() => setHowToPlay(true)}
            className="relative inline-flex items-center gap-1.5 mt-4 min-h-[40px] px-4 rounded-full border-2 border-line bg-panel text-[13px] font-bold active:bg-panel2"
          >
            <BookOpen size={14} className="text-accent2" aria-hidden="true" /> How to play
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </header>

        <section aria-labelledby="m-see-it" className="mt-1">
          <SectionTitle>
            <span id="m-see-it" className="inline-flex items-center gap-1.5">
              <Eye size={13} aria-hidden="true" /> See it in action
            </span>
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-4 px-4 [scrollbar-width:none]">
            {SNAPSHOTS.map((snap) => (
              <div
                key={snap.src}
                className="shrink-0 w-[78%] max-w-[280px] snap-start bg-panel border border-line rounded-2xl overflow-hidden shadow-xl"
              >
                <div className="h-32 overflow-hidden border-b border-line">
                  <img
                    src={snap.src}
                    alt={snap.title}
                    loading="lazy"
                    className="w-full h-full object-cover object-top block"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-extrabold text-[13.5px] m-0 mb-1">{snap.title}</h3>
                  <p className="text-slate-400 text-[12px] m-0">{snap.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="m-shape" className="mt-5">
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

        <section aria-labelledby="m-ratings" className="mt-5">
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
      </div>

      <BottomBar>
        <BigButton onClick={startDraft} disabled={!data}>
          <Trophy size={18} aria-hidden="true" /> Start the Draft
        </BigButton>
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
