import { Trophy, Flame, Eye, LayoutList } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { MODES, DIFFICULTIES, POSITION_FORMATION } from "../engine/constants";
import { BigButton, ChoiceCard, BottomBar, SectionTitle } from "./mui";

const SHAPE_COUNTS = POSITION_FORMATION.reduce<Record<string, number>>((acc, s) => {
  acc[s.position] = (acc[s.position] ?? 0) + 1;
  return acc;
}, {});

export default function MSetup() {
  const { data, mode, difficulty, setMode, setDifficulty, startDraft } = useGameStore();
  const nSq = data?.squads.length ?? 0;
  const nPl = data ? data.squads.reduce((a, s) => a + s.players.length, 0) : 0;

  return (
    <div className="flex flex-col min-h-0 grow">
      <div className="grow overflow-y-auto px-4 pb-4">
        <header className="pt-5 pb-4 text-center">
          <h1 className="text-[30px] leading-[1.15] font-black m-0">
            Build a Champion XI.
            <br />
            Chase the perfect <span className="text-accent">7–0</span>.
          </h1>
          <p className="text-[14px] text-slate-400 mt-3 mb-0">
            Draft one player at a time from real World Cup squads, then take your XI
            through a 32-team tournament.
          </p>
          <dl className="flex justify-center gap-5 mt-4 mb-0">
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
        </header>

        <section aria-labelledby="m-shape">
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
    </div>
  );
}
