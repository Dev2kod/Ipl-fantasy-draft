import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { Shuffle, CalendarDays, Dices, ArrowLeftRight } from "lucide-react";
import { useGameStore, isMarketDead } from "../store/useGameStore";
import { filledCount, switchCandidates, openPositions, eligiblePositionsFor, validMoveTargets } from "../engine/draft";
import { teamRatings } from "../engine/ratings";
import { POSITION_FORMATION, FLAGS } from "../engine/constants";
import { finishLabel } from "../engine/format";
import { Button, Pill, RatingBar, AwardBadge } from "./ui";
import type { Player, Position, SignedPlayer } from "../engine/types";

function XIPanel() {
  const { slots, switchesLeft, mode, movePlayer, goToStyle } = useGameStore();
  const [openMoveFor, setOpenMoveFor] = useState<number | null>(null);
  const players = slots.map((s) => s.player).filter((p): p is SignedPlayer => p !== null);
  const r = teamRatings(players);
  const done = filledCount(slots) === 11;

  return (
    <aside className="bg-panel border border-line rounded-2xl p-3 shadow-xl flex flex-col min-h-0 h-full">
      <div className="flex justify-between items-center mb-2 shrink-0">
        <h2 className="text-base font-bold m-0">Your XI</h2>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <Pill>{filledCount(slots)} / 11</Pill>
          <Pill tone="accent">Switches: {switchesLeft}</Pill>
        </div>
      </div>

      <ol className="list-none m-0 p-0 flex flex-col gap-1 mb-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {slots.map((slot, i) => {
          const targets = slot.player ? validMoveTargets(i, slots) : [];
          return (
            <motion.li key={i} layout>
              <div
                className={clsx(
                  "flex items-center gap-2 px-2 py-1 rounded-lg text-[12.5px] border",
                  slot.player ? "border-accent2 bg-panel2" : "border-dashed border-line bg-panel2"
                )}
              >
                <span
                  className={clsx(
                    "text-[9.5px] font-extrabold tracking-wide px-1.5 py-0.5 rounded text-center min-w-[76px] shrink-0",
                    "bg-panel border border-line text-slate-400"
                  )}
                >
                  {slot.position}
                </span>
                {slot.player ? (
                  <span className="flex-1 min-w-0 truncate flex items-center gap-1.5">
                    {slot.player.name}
                    <AwardBadge award={slot.player.award} />
                    <span className="hidden lg:inline text-[10.5px] text-slate-400">{slot.player._src}</span>
                  </span>
                ) : (
                  <span className="flex-1 text-slate-400">needed</span>
                )}
                {slot.player && mode.id !== "almanac" && <span className="font-extrabold text-accent shrink-0">{slot.player.overall}</span>}
                {slot.player && targets.length > 0 && (
                  <button
                    type="button"
                    title="Move this player to another position they fit"
                    onClick={() => setOpenMoveFor(openMoveFor === i ? null : i)}
                    className={clsx(
                      "shrink-0 rounded p-0.5 border transition-colors cursor-pointer",
                      openMoveFor === i ? "border-accent text-accent bg-accent/10" : "border-line text-slate-400 hover:border-accent2 hover:text-accent2"
                    )}
                  >
                    <ArrowLeftRight size={12} />
                  </button>
                )}
              </div>
              {openMoveFor === i && (
                <div className="flex flex-wrap gap-1 mt-1 mb-0.5 pl-1">
                  {targets.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { movePlayer(i, t); setOpenMoveFor(null); }}
                      className="text-[10.5px] font-bold bg-panel border border-line rounded-full px-2 py-0.5 hover:border-accent hover:text-accent transition-colors cursor-pointer"
                    >
                      → {slots[t].position}{slots[t].player ? ` (swap ${slots[t].player!.name})` : ""}
                    </button>
                  ))}
                </div>
              )}
            </motion.li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-1.5 mb-2.5 shrink-0">
        <RatingBar label="Batting" value={r.batting} />
        <RatingBar label="Bowling" value={r.bowling} />
        <RatingBar label="Balance" value={r.balance} />
        <RatingBar label="Overall" value={r.overall} />
      </div>

      <Button onClick={goToStyle} disabled={!done} className="w-full shrink-0">
        Lock XI &amp; choose style →
      </Button>
    </aside>
  );
}

function MarketPanel() {
  const {
    data, currentSquad, slots, switchesLeft, lastMessage, mode,
    drawNext, doSwitch, draftPlayer, usedPlayerNames, turnExcludedSquadIds,
  } = useGameStore();
  const [choosingFor, setChoosingFor] = useState<string | null>(null);

  useEffect(() => setChoosingFor(null), [currentSquad?.id]);

  const done = filledCount(slots) === 11;
  const dead = currentSquad ? isMarketDead() : false;

  const optionsFor = (p: Player): Position[] => eligiblePositionsFor(p, slots, usedPlayerNames);

  const counts = new Map<string, number>();
  openPositions(slots).forEach((pos) => counts.set(pos, (counts.get(pos) ?? 0) + 1));
  const needHint = [...counts.entries()].map(([pos, n]) => (n > 1 ? `${n}× ${pos}` : pos)).join(" · ");

  const teamCands = currentSquad && data ? switchCandidates(data.squads, currentSquad, "team", turnExcludedSquadIds) : [];
  const editionCands = currentSquad && data ? switchCandidates(data.squads, currentSquad, "edition", turnExcludedSquadIds) : [];

  const positionOrder = POSITION_FORMATION.map((s) => s.position);
  const positionRank = (p: Player): number => {
    const idx = positionOrder.indexOf(p.positions[0]);
    return idx === -1 ? positionOrder.length : idx;
  };

  const players: Player[] = currentSquad
    ? [...currentSquad.players].sort((a, b) => {
        const ea = optionsFor(a).length > 0 ? 1 : 0;
        const eb = optionsFor(b).length > 0 ? 1 : 0;
        if (ea !== eb) return eb - ea;
        const pa = positionRank(a);
        const pb = positionRank(b);
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      })
    : [];

  const handlePick = (p: Player) => {
    const opts = optionsFor(p);
    if (opts.length === 0) return;
    if (opts.length === 1) { draftPlayer(p.name, opts[0]); return; }
    setChoosingFor(choosingFor === p.name ? null : p.name);
  };

  return (
    <div className="bg-panel border border-line rounded-2xl p-3 shadow-xl flex flex-col min-h-0 h-full">
      <AnimatePresence mode="wait">
        {currentSquad ? (
          <motion.div
            key={currentSquad.id}
            initial={{ opacity: 0, scale: 0.92, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative overflow-hidden rounded-2xl p-2.5 mb-2.5 shrink-0"
            style={{
              background: `linear-gradient(135deg, ${currentSquad.colour}22 0%, transparent 65%)`,
              border: `1.5px solid ${currentSquad.colour}55`,
            }}
          >
            <span
              className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20"
              style={{ background: currentSquad.colour }}
            />
            <div className="relative flex items-center gap-2.5">
              <span
                className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: currentSquad.colour }}
              >
                {FLAGS[currentSquad.country] ?? "🏏"}
              </span>
              <div className="min-w-0">
                <div className="text-xl font-black leading-tight truncate" style={{ color: currentSquad.colour }}>
                  {currentSquad.country_name}
                </div>
                <div className="text-[12px] text-slate-400 tracking-wide font-bold">
                  WORLD CUP {currentSquad.edition} · {finishLabel(currentSquad)}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="text-slate-400 border-2 border-dashed border-line rounded-2xl p-4 mb-2.5 text-center shrink-0">
            Draw a squad to open the market
          </div>
        )}
      </AnimatePresence>

      <div className="flex justify-end gap-2 flex-wrap mb-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          disabled={done || !currentSquad || switchesLeft <= 0 || teamCands.length === 0}
          onClick={() => doSwitch("team")}
          title={teamCands.length === 0 ? "No other team available for this World Cup" : "Same World Cup, a different team"}
        >
          <span className="inline-flex items-center gap-1.5"><Shuffle size={15} /> Same World Cup · other team</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={done || !currentSquad || switchesLeft <= 0 || editionCands.length === 0}
          onClick={() => doSwitch("edition")}
          title={editionCands.length === 0 ? "This team has no other World Cup in the data" : "Same team, a different World Cup"}
        >
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> Same team · other World Cup</span>
        </Button>
        <Button
          size="sm"
          disabled={done || (!!currentSquad && !dead)}
          onClick={drawNext}
        >
          <span className="inline-flex items-center gap-1.5"><Dices size={15} /> {dead ? "Dead market — draw new squad (free)" : "Draw a squad"}</span>
        </Button>
      </div>

      <p className="text-[12.5px] text-slate-400 mb-2 shrink-0">
        {done ? "XI complete!" : needHint ? <>Still needed: <b className="text-accent">{needHint}</b></> : ""}
      </p>

      <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-1.5">
        <AnimatePresence mode="popLayout">
          {players.map((p, i) => {
            const opts = optionsFor(p);
            const fit = opts.length > 0;
            const choosing = choosingFor === p.name;
            return (
              <motion.div
                key={`${currentSquad?.id}-${p.name}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: Math.min(i, 12) * 0.02, type: "spring", stiffness: 380, damping: 28 }}
                whileHover={fit ? { x: 3 } : {}}
                whileTap={fit ? { scale: 0.99 } : {}}
                className={clsx(
                  "relative bg-panel2 border-2 rounded-xl px-3.5 py-2 transition-colors shadow-sm",
                  fit ? "border-line" : "border-line opacity-40 grayscale-[0.5]",
                  choosing && "border-accent"
                )}
              >
                <div
                  onClick={() => handlePick(p)}
                  className={clsx("flex items-center gap-3", fit ? "cursor-pointer" : "cursor-not-allowed")}
                >
                  {p.captain && <span className="text-[10px] font-extrabold bg-accent text-[#20160a] rounded-md px-1.5 py-0.5 shrink-0">C</span>}
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-[14.5px] leading-tight truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-400">{p.positions.join(", ")}</div>
                  </div>
                  {p.award && <AwardBadge award={p.award} />}
                  {mode.id !== "almanac" && (
                    <div className="hidden sm:flex gap-3 text-[11px] text-slate-400 shrink-0">
                      <span>Bat <b className="text-ink">{p.bat}</b></span>
                      <span>Bowl <b className="text-ink">{p.bowl}</b></span>
                    </div>
                  )}
                  <div className="text-xl font-black text-accent leading-none w-9 text-right shrink-0">
                    {mode.id === "almanac" ? <span className="text-slate-400 text-base">?</span> : p.overall}
                  </div>
                </div>
                {choosing && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-line">
                    <span className="text-[11px] text-slate-400 self-center">Place as:</span>
                    {opts.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => { draftPlayer(p.name, opt); setChoosingFor(null); }}
                        className="text-[11.5px] font-bold bg-panel border border-accent2 text-accent2 rounded-full px-2.5 py-1 hover:bg-accent2 hover:text-white transition-colors cursor-pointer"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <p className="text-accent2 text-sm mt-2 min-h-5 shrink-0">{lastMessage}</p>
    </div>
  );
}

export default function DraftScreen() {
  return (
    <section className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-5 py-4 flex flex-col">
      <div className="grid gap-4 flex-1 min-h-0" style={{ gridTemplateColumns: "320px 1fr" }}>
        <XIPanel />
        <MarketPanel />
      </div>
    </section>
  );
}
