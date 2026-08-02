import clsx from "clsx";
import { Swords, Trophy, Lock } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { FLAGS } from "../engine/constants";
import { Button, CricketBallGlyph } from "./ui";
import KnockoutMatchModal from "./KnockoutMatchModal";
import type { BracketMatch, BracketTeamRef } from "../engine/simulate";

function TeamRow({ team, score, won, hideScore }: { team: BracketTeamRef; score: number; won: boolean; hideScore: boolean }) {
  const flag = team.isYou ? "🏏" : (FLAGS[team.code] ?? "🏏");
  return (
    <div className={clsx("flex items-center gap-2 py-0.5", won && !hideScore && "font-extrabold")}>
      <span
        className="w-5 h-5 rounded flex items-center justify-center text-[10.5px] shrink-0"
        style={{ background: team.colour }}
      >
        {flag}
      </span>
      <span className={clsx("flex-1 min-w-0 truncate", team.isYou && "text-accent font-extrabold")}>
        {team.isYou ? "You" : team.name}
      </span>
      {!hideScore && <span className={clsx("shrink-0 text-[12px]", won ? "text-accent" : "text-slate-400")}>{score}</span>}
    </div>
  );
}

/** A round the player hasn't reached yet -- who's even IN it depends on
 *  matches that haven't been played from the player's perspective, so
 *  showing the real teams here would spoil the outcome of every earlier
 *  round that feeds into it. Stays a mystery until the player advances. */
function LockedCard() {
  return (
    <div className="bg-panel2 border border-dashed border-line rounded-xl px-3 py-2.5 text-[12.5px] opacity-60">
      <div className="flex items-center gap-2 py-0.5">
        <span className="w-5 h-5 rounded flex items-center justify-center bg-panel shrink-0"><Lock size={11} className="text-slate-400" /></span>
        <span className="flex-1 text-slate-400">To be decided</span>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="w-5 h-5 rounded flex items-center justify-center bg-panel shrink-0"><Lock size={11} className="text-slate-400" /></span>
        <span className="flex-1 text-slate-400">To be decided</span>
      </div>
    </div>
  );
}

function MatchCard({ match, pending, onPlay }: { match: BracketMatch; pending: boolean; onPlay: () => void }) {
  const involvesYou = match.teamA.isYou || match.teamB.isYou;
  return (
    <div
      onClick={pending ? onPlay : undefined}
      className={clsx(
        "bg-panel border rounded-xl px-3 py-2.5 text-[12.5px] transition-colors",
        involvesYou ? "border-accent shadow-[0_0_0_2px_rgba(255,122,26,0.15)]" : "border-line",
        pending && "cursor-pointer hover:border-accent2 hover:shadow-md"
      )}
    >
      <TeamRow team={match.teamA} score={match.scoreA} won={match.winnerIsA} hideScore={pending} />
      <TeamRow team={match.teamB} score={match.scoreB} won={!match.winnerIsA} hideScore={pending} />
      {pending && (
        <div className="text-center mt-1.5 pt-1.5 border-t border-line">
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-accent tracking-wide">
            <Swords size={12} /> PLAY MATCH
          </span>
        </div>
      )}
    </div>
  );
}

const ROUND_LABELS = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"];

export default function BracketScreen() {
  const { simMeta, knockoutIdx, openKnockoutModal, goToResult } = useGameStore();
  if (!simMeta) return null;

  const bracket = simMeta.bracket;
  const pendingMatch = knockoutIdx < bracket.length
    ? bracket[knockoutIdx].find((m) => m.teamA.isYou || m.teamB.isYou)
    : undefined;
  const yourRunOver = !pendingMatch;
  // Only the round you're currently on (and any you've already played) is
  // real -- rounds beyond it depend on matches you haven't reached yet, so
  // revealing them now would spoil who wins along the way. Once your run is
  // over (won it all or been eliminated), everything opens up to browse.
  const isRevealed = (ri: number) => yourRunOver || ri <= knockoutIdx;

  return (
    <section className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-5 py-5 flex flex-col">
      <div className="relative text-center mb-4 shrink-0">
        <CricketBallGlyph className="absolute w-24 h-24 text-accent/5 -top-4 left-0 -rotate-12 pointer-events-none" />
        <h2 className="text-xl font-bold m-0">The Knockout Bracket</h2>
        <p className="text-slate-400 text-[13px] mt-1">
          Top 2 from all 8 groups — your path is highlighted. Click your next match to play it.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, minmax(200px, 1fr))" }}>
          {ROUND_LABELS.map((label, ri) => (
            <div key={label} className="flex flex-col gap-2.5 min-w-0">
              <h3 className="text-center text-[11.5px] font-black tracking-wide uppercase text-slate-400 m-0">{label}</h3>
              <div className="flex flex-col gap-2.5 justify-around flex-1">
                {(bracket[ri] ?? []).map((m, mi) =>
                  isRevealed(ri) ? (
                    <MatchCard
                      key={mi}
                      match={m}
                      pending={ri === knockoutIdx && m === pendingMatch}
                      onPlay={openKnockoutModal}
                    />
                  ) : (
                    <LockedCard key={mi} />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-5 shrink-0">
        {yourRunOver ? (
          <Button size="lg" onClick={goToResult}>
            <span className="inline-flex items-center gap-2"><Trophy size={18} /> See Final Result →</span>
          </Button>
        ) : (
          <p className="text-slate-400 text-[12.5px]">Click your highlighted match above to play it.</p>
        )}
      </div>

      <KnockoutMatchModal />
    </section>
  );
}
