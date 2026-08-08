import clsx from "clsx";
import { Swords, Trophy, Lock } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import Flag from "../components/Flag";
import KnockoutMatchModal from "../components/KnockoutMatchModal";
import { BigButton, BottomBar } from "./mui";
import type { BracketMatch, BracketTeamRef } from "../engine/simulate";

const ROUNDS = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"];

function Side({ team, score, won, hideScore }: { team: BracketTeamRef; score: number; won: boolean; hideScore: boolean }) {
  return (
    <div className={clsx("flex items-center gap-2 py-1", won && !hideScore && "font-extrabold")}>
      <Flag code={team.code} isYou={team.isYou} className="w-5 h-5 rounded-[3px] shrink-0 ring-1 ring-black/15 object-cover" />
      <span className={clsx("grow min-w-0 truncate text-[13px]", team.isYou && "text-accent font-extrabold")}>
        {team.isYou ? "You" : team.name}
      </span>
      {!hideScore && (
        <span className={clsx("text-[13px] tabular-nums shrink-0", won ? "text-accent font-bold" : "text-slate-400")}>
          {score}
        </span>
      )}
    </div>
  );
}

/**
 * The bracket on a phone.
 *
 * A 4-column tree needs ~800px, so instead of shrinking it into an
 * unreadable grid this stacks the rounds vertically as collapsible-feeling
 * sections. Your own tie is pulled to the top of its round and highlighted,
 * so the thing you actually act on is never buried.
 */
export default function MBracket() {
  const { simMeta, knockoutIdx, openKnockoutModal, goToResult } = useGameStore();
  if (!simMeta) return null;

  const bracket = simMeta.bracket;
  const pending = knockoutIdx < bracket.length
    ? bracket[knockoutIdx].find((m) => m.teamA.isYou || m.teamB.isYou)
    : undefined;
  const runOver = !pending;
  const revealed = (ri: number) => runOver || ri <= knockoutIdx;

  const sortYouFirst = (ms: BracketMatch[]) =>
    [...ms].sort((a, b) => {
      const ay = a.teamA.isYou || a.teamB.isYou ? 0 : 1;
      const by = b.teamA.isYou || b.teamB.isYou ? 0 : 1;
      return ay - by;
    });

  return (
    <div className="flex flex-col min-h-0 grow">
      <div className="grow overflow-y-auto px-4 pb-4">
        <h1 className="text-[22px] font-black text-center mt-5 mb-1">Knockout Bracket</h1>
        <p className="text-[13px] text-slate-400 text-center mt-0 mb-4">
          {pending ? "Tap your highlighted match to play it." : "Your run is over — browse the full bracket."}
        </p>

        {ROUNDS.map((label, ri) => (
          <section key={label} aria-labelledby={`rnd-${ri}`} className="mb-5">
            <h2
              id={`rnd-${ri}`}
              className="text-[11.5px] font-black tracking-[2px] uppercase text-slate-400 m-0 mb-2 flex items-center gap-2"
            >
              {label}
              {!revealed(ri) && <Lock size={12} aria-hidden="true" />}
            </h2>

            {!revealed(ri) ? (
              <p className="text-[12.5px] text-slate-400 border-2 border-dashed border-line rounded-2xl px-3.5 py-4 m-0 text-center">
                Decided once you get there
              </p>
            ) : (
              <ul className="list-none m-0 p-0 flex flex-col gap-2">
                {sortYouFirst(bracket[ri] ?? []).map((m, mi) => {
                  const yours = m.teamA.isYou || m.teamB.isYou;
                  const isPending = ri === knockoutIdx && m === pending;
                  const Card = (
                    <div
                      className={clsx(
                        "rounded-2xl border-2 px-3.5 py-2.5",
                        yours ? "border-accent bg-accent/5" : "border-line bg-panel"
                      )}
                    >
                      <Side team={m.teamA} score={m.scoreA} won={m.winnerIsA} hideScore={isPending} />
                      <Side team={m.teamB} score={m.scoreB} won={!m.winnerIsA} hideScore={isPending} />
                      {isPending && (
                        <span className="mt-2 pt-2 border-t border-accent/30 flex items-center justify-center gap-1.5 text-[12px] font-black text-accent">
                          <Swords size={13} aria-hidden="true" /> PLAY MATCH
                        </span>
                      )}
                    </div>
                  );
                  return (
                    <li key={mi}>
                      {isPending ? (
                        <button
                          type="button"
                          onClick={openKnockoutModal}
                          aria-label={`Play your ${label} against ${m.teamA.isYou ? m.teamB.name : m.teamA.name}`}
                          className="w-full text-left min-h-[44px]"
                        >
                          {Card}
                        </button>
                      ) : Card}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      {runOver && (
        <BottomBar>
          <BigButton onClick={goToResult}>
            <Trophy size={18} aria-hidden="true" /> See Final Result
          </BigButton>
        </BottomBar>
      )}

      <KnockoutMatchModal />
    </div>
  );
}
