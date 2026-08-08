import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { Shuffle, CalendarDays, Dices, ArrowLeftRight, Check } from "lucide-react";
import { useGameStore, isMarketDead } from "../store/useGameStore";
import {
  filledCount, switchCandidates, openPositions, eligiblePositionsFor, validMoveTargets,
} from "../engine/draft";
import { teamRatings } from "../engine/ratings";
import { finishLabel } from "../engine/format";
import Flag from "../components/Flag";
import { BigButton, PillButton, BottomBar, Sheet, Meter, LiveMessage } from "./mui";
import type { Player, Position, SignedPlayer } from "../engine/types";

/**
 * The draft on a phone.
 *
 * The desktop layout puts the XI and the market side by side, which needs
 * ~900px. Here they're two tabs of one full-width column instead, so each
 * gets the whole screen and neither is squeezed into an unreadable strip.
 * The market is the default tab because picking is the actual loop; the XI
 * tab carries a live count so you always know what's still missing.
 */
export default function MDraft() {
  const {
    data, currentSquad, slots, switchesLeft, lastMessage, mode,
    drawNext, doSwitch, draftPlayer, movePlayer, usedPlayerNames, turnExcludedSquadIds, goToStyle,
  } = useGameStore();

  const [tab, setTab] = useState<"market" | "xi">("market");
  const [choosing, setChoosing] = useState<Player | null>(null);
  const [moveFrom, setMoveFrom] = useState<number | null>(null);

  const filled = filledCount(slots);
  const done = filled === 11;
  const dead = currentSquad ? isMarketDead() : false;
  const players = slots.map((s) => s.player).filter((p): p is SignedPlayer => p !== null);
  const r = teamRatings(players);

  // A new squad invalidates any half-finished pick.
  useEffect(() => setChoosing(null), [currentSquad?.id]);
  // Once the XI is full, surface it rather than leaving them on an idle market.
  useEffect(() => { if (done) setTab("xi"); }, [done]);

  const optionsFor = (p: Player): Position[] => eligiblePositionsFor(p, slots, usedPlayerNames);

  const needCounts = new Map<string, number>();
  openPositions(slots).forEach((pos) => needCounts.set(pos, (needCounts.get(pos) ?? 0) + 1));

  const teamCands = currentSquad && data ? switchCandidates(data.squads, currentSquad, "team", turnExcludedSquadIds) : [];
  const editionCands = currentSquad && data ? switchCandidates(data.squads, currentSquad, "edition", turnExcludedSquadIds) : [];

  const marketPlayers: Player[] = currentSquad
    ? [...currentSquad.players].sort((a, b) => {
        const ea = optionsFor(a).length > 0 ? 1 : 0;
        const eb = optionsFor(b).length > 0 ? 1 : 0;
        if (ea !== eb) return eb - ea;           // usable players first
        return b.overall - a.overall;            // then strongest, which is what you scan for
      })
    : [];

  const pick = (p: Player) => {
    const opts = optionsFor(p);
    if (!opts.length) return;
    if (opts.length === 1) { draftPlayer(p.name, opts[0]); return; }
    setChoosing(p);                              // more than one slot fits: let them choose
  };

  return (
    <div className="flex flex-col min-h-0 grow">
      {/* Tabs -------------------------------------------------------------- */}
      <div role="tablist" aria-label="Draft view" className="flex gap-2 px-4 pt-3 pb-2 shrink-0">
        {([
          ["market", "Squad market"],
          ["xi", `Your XI · ${filled}/11`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={clsx(
              "flex-1 min-h-[44px] rounded-xl text-[13.5px] font-extrabold border-2 transition-colors",
              tab === id ? "border-accent bg-accent/10 text-accent" : "border-line bg-panel text-slate-400"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grow overflow-y-auto px-4 pb-4 min-h-0">
        {tab === "market" ? (
          <>
            {/* Current squad ------------------------------------------------ */}
            <AnimatePresence mode="wait">
              {currentSquad ? (
                <motion.div
                  key={currentSquad.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl p-3 mb-3 flex items-center gap-3"
                  style={{
                    background: `linear-gradient(135deg, ${currentSquad.colour}1f 0%, transparent 70%)`,
                    border: `1.5px solid ${currentSquad.colour}55`,
                  }}
                >
                  <Flag
                    code={currentSquad.country}
                    title={currentSquad.country_name}
                    className="w-12 h-12 rounded-xl shrink-0 ring-1 ring-black/15 object-cover"
                  />
                  <div className="min-w-0">
                    <h2 className="text-[19px] font-black leading-tight truncate m-0" style={{ color: currentSquad.colour }}>
                      {currentSquad.country_name}
                    </h2>
                    <p className="text-[11.5px] text-slate-400 font-bold tracking-wide m-0">
                      WORLD CUP {currentSquad.edition} · {finishLabel(currentSquad)}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="border-2 border-dashed border-line rounded-2xl p-6 mb-3 text-center text-slate-400">
                  Draw a squad to open the market
                </div>
              )}
            </AnimatePresence>

            <p className="text-[12.5px] text-slate-400 mb-2.5 mt-0">
              {done ? "XI complete!" : (
                <>Still needed:{" "}
                  <b className="text-accent">
                    {[...needCounts.entries()].map(([pos, n]) => (n > 1 ? `${n}× ${pos}` : pos)).join(" · ")}
                  </b>
                </>
              )}
            </p>

            {/* Player list -------------------------------------------------- */}
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {marketPlayers.map((p) => {
                const opts = optionsFor(p);
                const fits = opts.length > 0;
                return (
                  <li key={p.name}>
                    <button
                      type="button"
                      onClick={() => pick(p)}
                      disabled={!fits}
                      aria-label={`Sign ${p.name}, ${p.positions.join(" or ")}, rated ${p.overall}`}
                      className={clsx(
                        "w-full text-left rounded-2xl border-2 px-3.5 py-3 min-h-[64px] flex items-center gap-3 transition-colors",
                        fits ? "bg-panel2 border-line active:border-accent active:bg-accent/5"
                             : "bg-panel2 border-line opacity-40 grayscale-[.5] cursor-not-allowed"
                      )}
                    >
                      {p.captain && (
                        <span className="text-[10px] font-black bg-accent text-[#20160a] rounded-md px-1.5 py-0.5 shrink-0">C</span>
                      )}
                      <span className="min-w-0 grow">
                        <span className="block font-extrabold text-[15px] leading-tight truncate">{p.name}</span>
                        <span className="block text-[11.5px] text-slate-400 mt-0.5">{p.positions.join(" · ")}</span>
                      </span>
                      {mode.id !== "almanac" && (
                        <span className="text-right shrink-0">
                          <span className="block text-[22px] font-black text-accent leading-none">{p.overall}</span>
                          <span className="block text-[10.5px] text-slate-400 mt-1 tabular-nums">
                            {p.bat}/{p.bowl}
                          </span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          /* Your XI ------------------------------------------------------- */
          <>
            <ol className="list-none m-0 p-0 flex flex-col gap-2">
              {slots.map((slot, i) => {
                const targets = slot.player ? validMoveTargets(i, slots) : [];
                return (
                  <li
                    key={i}
                    className={clsx(
                      "rounded-2xl border-2 px-3 py-2.5 min-h-[56px] flex items-center gap-2.5",
                      slot.player ? "border-accent2/60 bg-panel2" : "border-dashed border-line bg-panel2"
                    )}
                  >
                    <span className="text-[9.5px] font-black tracking-wide text-slate-400 bg-panel border border-line rounded px-1.5 py-1 w-[74px] text-center shrink-0">
                      {slot.position}
                    </span>
                    {slot.player ? (
                      <>
                        <Flag code={slot.player._srcCode} className="w-6 h-6 rounded shrink-0 ring-1 ring-black/10 object-cover" />
                        <span className="min-w-0 grow">
                          <span className="block text-[14px] font-bold truncate">{slot.player.name}</span>
                          <span className="block text-[11px] text-slate-400 truncate">{slot.player._src}</span>
                        </span>
                        {mode.id !== "almanac" && (
                          <b className="text-accent text-[15px] shrink-0">{slot.player.overall}</b>
                        )}
                        {targets.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setMoveFrom(i)}
                            aria-label={`Move ${slot.player.name} to a different position`}
                            className="w-11 h-11 -mr-1 grid place-items-center rounded-xl text-slate-400 active:bg-panel shrink-0"
                          >
                            <ArrowLeftRight size={16} />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 text-[13.5px]">Needed</span>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="bg-panel border border-line rounded-2xl p-3.5 mt-3 flex flex-col gap-2">
              <Meter label="Batting" value={r.batting} />
              <Meter label="Bowling" value={r.bowling} />
              <Meter label="Balance" value={r.balance} />
              <Meter label="Overall" value={r.overall} />
            </div>
          </>
        )}
      </div>

      {/* Actions ------------------------------------------------------------ */}
      <BottomBar>
        <div className="px-0 pb-2">
          <LiveMessage>{lastMessage}</LiveMessage>
        </div>
        {done ? (
          <BigButton onClick={goToStyle}>
            <Check size={18} aria-hidden="true" /> Lock XI &amp; choose style
          </BigButton>
        ) : tab === "market" ? (
          <div className="flex gap-2">
            <PillButton
              onClick={() => doSwitch("team")}
              disabled={!currentSquad || switchesLeft <= 0 || !teamCands.length}
              ariaLabel="Switch to another team from this same World Cup"
              className="grow"
            >
              <Shuffle size={15} aria-hidden="true" /> Team
            </PillButton>
            <PillButton
              onClick={() => doSwitch("edition")}
              disabled={!currentSquad || switchesLeft <= 0 || !editionCands.length}
              ariaLabel="Switch to this same team from another World Cup"
              className="grow"
            >
              <CalendarDays size={15} aria-hidden="true" /> Year
            </PillButton>
            <PillButton
              onClick={drawNext}
              disabled={!!currentSquad && !dead}
              ariaLabel={dead ? "Dead market, draw a new squad for free" : "Draw a squad"}
              className="grow"
              active={dead}
            >
              <Dices size={15} aria-hidden="true" /> {dead ? "Redraw" : "Draw"}
            </PillButton>
          </div>
        ) : (
          <BigButton tone="ghost" onClick={() => setTab("market")}>
            Back to the market
          </BigButton>
        )}
        {!done && tab === "market" && (
          <p className="text-[11.5px] text-slate-400 text-center m-0 mt-2">
            {switchesLeft} switch{switchesLeft === 1 ? "" : "es"} left this pick
          </p>
        )}
      </BottomBar>

      {/* Which slot should this player take? -------------------------------- */}
      <Sheet
        open={!!choosing}
        onClose={() => setChoosing(null)}
        title={choosing ? `Place ${choosing.name}` : ""}
      >
        <p className="text-[13px] text-slate-400 mt-0 mb-3">
          They can fill more than one open slot — pick where they play.
        </p>
        <div className="flex flex-col gap-2">
          {choosing && optionsFor(choosing).map((pos) => (
            <BigButton
              key={pos}
              tone="ghost"
              onClick={() => { draftPlayer(choosing.name, pos); setChoosing(null); }}
            >
              {pos}
            </BigButton>
          ))}
        </div>
      </Sheet>

      {/* Move a signed player ----------------------------------------------- */}
      <Sheet
        open={moveFrom !== null}
        onClose={() => setMoveFrom(null)}
        title={moveFrom !== null && slots[moveFrom]?.player ? `Move ${slots[moveFrom].player!.name}` : "Move player"}
      >
        <p className="text-[13px] text-slate-400 mt-0 mb-3">
          Only slots this player is tagged for are shown. Moving onto a filled slot swaps the two.
        </p>
        <div className="flex flex-col gap-2">
          {moveFrom !== null && validMoveTargets(moveFrom, slots).map((t) => (
            <BigButton
              key={t}
              tone="ghost"
              onClick={() => { movePlayer(moveFrom, t); setMoveFrom(null); }}
            >
              <span className="truncate">
                {slots[t].position}
                {slots[t].player ? ` — swap with ${slots[t].player!.name}` : " — empty"}
              </span>
            </BigButton>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
