import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { Shuffle, CalendarDays, Dices, Wallet } from "lucide-react";
import { useGameStore, isMarketDead } from "../store/useGameStore";
import {
  overseasCount, filledCount, switchCandidates, openPositions,
  eligibleRoleFor, eligibleRoleForAuction, eligiblePositionFor,
} from "../engine/draft";
import { teamRatings } from "../engine/ratings";
import { ROLE_LABEL, MAX_OVERSEAS, AUCTION_PURSE } from "../engine/constants";
import { finishLabel } from "../engine/format";
import { Button, Pill, RatingBar, CapBadge } from "./ui";
import type { Player, Role, Position, SignedPlayer } from "../engine/types";

function XIPanel() {
  const { slots, switchesLeft, mode, draftMode, purseLeft, goToStyle } = useGameStore();
  const flaggedRole: Partial<Record<Role, boolean>> = {};
  const players = slots.map((s) => s.player).filter((p): p is SignedPlayer => p !== null);
  const r = teamRatings(players);
  const done = filledCount(slots) === 11;
  const ovsUsed = overseasCount(slots);

  return (
    <aside className="bg-panel border border-line rounded-2xl p-4 shadow-xl flex flex-col">
      <div className="flex justify-between items-center mb-2.5">
        <h2 className="text-lg font-bold m-0">Your XI</h2>
        <div className="flex gap-2 flex-wrap justify-end">
          <Pill>{filledCount(slots)} / 11</Pill>
          <Pill tone="accent">Switches: {switchesLeft}</Pill>
        </div>
      </div>
      {draftMode.id === "auction" && (
        <div className="text-[12.5px] text-slate-400 mb-2 flex items-center gap-1.5">
          <Wallet size={13} />
          Purse: <b className={clsx(purseLeft < 5 ? "text-loss" : "text-accent")}>₹{purseLeft.toFixed(1)}cr</b>
          <span className="text-slate-500"> / ₹{AUCTION_PURSE}cr</span>
        </div>
      )}
      <div className="text-[12.5px] text-slate-400 mb-2">
        Overseas: <b className={clsx(ovsUsed >= MAX_OVERSEAS ? "text-loss" : "text-ink")}>{ovsUsed} / {MAX_OVERSEAS}</b>
      </div>

      <ol className="list-none m-0 p-0 flex flex-col gap-1.5 mb-3.5">
        {slots.map((slot, i) => {
          let needNow = false;
          if (!slot.player && !slot.position && !flaggedRole[slot.role]) { needNow = true; flaggedRole[slot.role] = true; }
          const tagLabel = slot.position ?? slot.role;
          return (
            <motion.li
              key={i}
              layout
              className={clsx(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm border",
                slot.player ? "border-accent2 bg-panel2" : "border-dashed border-line bg-panel2",
                needNow && !slot.player && "ring-1 ring-accent/40"
              )}
            >
              <span
                className={clsx(
                  "text-[10px] font-extrabold tracking-wide px-1.5 py-0.5 rounded text-center",
                  slot.position ? "min-w-[92px]" : "min-w-11",
                  needNow && !slot.player ? "bg-accent text-[#20160a]" : "bg-panel border border-line text-slate-400"
                )}
              >
                {tagLabel}
              </span>
              {slot.player ? (
                <span className="flex-1 truncate flex items-center gap-1.5">
                  {slot.player.name}
                  {slot.player.overseas && <span className="w-1.5 h-1.5 rounded-full bg-accent2 inline-block" title="Overseas" />}
                  <CapBadge cap={slot.player.cap} />
                  <span className="block text-[11px] text-slate-400">{slot.player._src}</span>
                </span>
              ) : (
                <span className="flex-1 text-slate-400">{slot.position ? "needed" : `${ROLE_LABEL[slot.role]} needed`}</span>
              )}
              {slot.player && draftMode.id === "auction" && <span className="text-[11px] text-slate-400">₹{slot.player.price}cr</span>}
              {slot.player && mode.id !== "almanac" && <span className="font-extrabold text-accent">{slot.player.overall}</span>}
            </motion.li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 mb-3">
        <RatingBar label="Batting" value={r.batting} />
        <RatingBar label="Bowling" value={r.bowling} />
        <RatingBar label="Balance" value={r.balance} />
        <RatingBar label="Overall" value={r.overall} />
      </div>

      <Button onClick={goToStyle} disabled={!done} className="w-full">
        Lock XI &amp; choose style →
      </Button>
    </aside>
  );
}

function MarketPanel() {
  const {
    data, currentSquad, slots, switchesLeft, lastMessage, mode, draftMode, purseLeft,
    drawNext, doSwitch, draftPlayer, usedPlayerNames, turnExcludedSquadIds,
  } = useGameStore();

  const done = filledCount(slots) === 11;
  const dead = currentSquad ? isMarketDead() : false;

  const fitFor = (p: Player): Role | Position | null => {
    if (draftMode.id === "positions") return eligiblePositionFor(p, slots, usedPlayerNames);
    if (draftMode.id === "auction") return eligibleRoleForAuction(p, slots, usedPlayerNames, purseLeft, data?.squads ?? []);
    return eligibleRoleFor(p, slots, usedPlayerNames);
  };

  let needHint: string;
  if (draftMode.id === "positions") {
    const counts = new Map<string, number>();
    openPositions(slots).forEach((pos) => counts.set(pos, (counts.get(pos) ?? 0) + 1));
    needHint = [...counts.entries()].map(([pos, n]) => (n > 1 ? `${n}× ${pos}` : pos)).join(" · ");
  } else {
    const open: Record<Role, number> = { BAT: 0, WK: 0, ALL: 0, BOWL: 0 };
    slots.forEach((s) => { if (!s.player) open[s.role]++; });
    needHint = (Object.entries(open) as [Role, number][]).filter(([, n]) => n > 0).map(([role, n]) => `${n}× ${ROLE_LABEL[role]}`).join(" · ");
  }

  const teamCands = currentSquad && data ? switchCandidates(data.squads, currentSquad, "team", turnExcludedSquadIds) : [];
  const seasonCands = currentSquad && data ? switchCandidates(data.squads, currentSquad, "season", turnExcludedSquadIds) : [];

  const players: Player[] = currentSquad
    ? [...currentSquad.players].sort((a, b) => {
        const ea = fitFor(a) ? 1 : 0;
        const eb = fitFor(b) ? 1 : 0;
        if (ea !== eb) return eb - ea;
        return b.overall - a.overall;
      })
    : [];

  return (
    <div className="bg-panel border border-line rounded-2xl p-4 shadow-xl">
      <div className="flex justify-between items-start gap-3 flex-wrap mb-2">
        <AnimatePresence mode="wait">
          {currentSquad ? (
            <motion.div
              key={currentSquad.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="border-l-4 pl-3"
              style={{ borderLeftColor: currentSquad.colour }}
            >
              <div className="text-xl font-extrabold" style={{ color: currentSquad.colour }}>
                {currentSquad.franchise_name}
              </div>
              <div className="text-[13px] text-slate-400 tracking-wide">
                SEASON {currentSquad.season} · {finishLabel(currentSquad)}
              </div>
            </motion.div>
          ) : (
            <div className="text-slate-400 border-l-4 border-line pl-3">Roll to draw a squad</div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            disabled={done || !currentSquad || switchesLeft <= 0 || teamCands.length === 0}
            onClick={() => doSwitch("team")}
            title={teamCands.length === 0 ? "No other team available for this season" : "Same season, a different franchise"}
          >
            <span className="inline-flex items-center gap-1.5"><Shuffle size={15} /> Same season · other team</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={done || !currentSquad || switchesLeft <= 0 || seasonCands.length === 0}
            onClick={() => doSwitch("season")}
            title={seasonCands.length === 0 ? "This franchise has no other season in the data" : "Same franchise, a different season"}
          >
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> Same team · other season</span>
          </Button>
          <Button
            size="sm"
            disabled={done || (!!currentSquad && !dead)}
            onClick={drawNext}
          >
            <span className="inline-flex items-center gap-1.5"><Dices size={15} /> {dead ? "Dead market — draw new squad (free)" : "Draw a squad"}</span>
          </Button>
        </div>
      </div>

      <p className="text-[13px] text-slate-400 mb-3">
        {done ? "XI complete!" : needHint ? <>Still needed: <b className="text-accent">{needHint}</b></> : ""}
      </p>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
        <AnimatePresence>
          {players.map((p) => {
            const fit = fitFor(p);
            const cantAfford = draftMode.id === "auction" && p.price > purseLeft;
            const overseasBlocked = p.overseas && overseasCount(slots) >= MAX_OVERSEAS && fit === null;
            return (
              <motion.div
                key={p.name}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={fit ? { y: -3 } : {}}
                onClick={() => fit && draftPlayer(p.name, fit)}
                className={clsx(
                  "relative bg-panel2 border-[1.5px] rounded-xl p-3 transition-colors",
                  fit ? "border-line hover:border-accent cursor-pointer" : "border-line opacity-40 grayscale-[0.5] cursor-not-allowed"
                )}
                title={overseasBlocked ? "Overseas quota (4) full" : cantAfford ? "Can't afford — not enough purse left" : undefined}
              >
                {p.captain && <span className="absolute top-2 right-11 text-[10px] font-extrabold bg-accent text-[#20160a] rounded px-1">C</span>}
                <div className="flex justify-between items-start gap-1.5">
                  <div>
                    <div className="font-extrabold text-[15px] leading-tight">{p.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {draftMode.id === "positions" ? p.positions.join(", ") : `${ROLE_LABEL[p.role]} · ${p.sub_role}`}
                    </div>
                  </div>
                  {mode.id === "almanac" ? (
                    <div className="text-base text-slate-400">?</div>
                  ) : (
                    <div className="text-[22px] font-black text-accent leading-none">{p.overall}</div>
                  )}
                </div>
                {mode.id !== "almanac" && (
                  <div className="flex gap-3 mt-2 text-xs text-slate-400">
                    <span>Bat <b className="text-ink">{p.bat}</b></span>
                    <span>Bowl <b className="text-ink">{p.bowl}</b></span>
                  </div>
                )}
                {draftMode.id === "auction" && (
                  <div className={clsx("mt-2 text-xs font-bold", cantAfford ? "text-loss" : "text-accent2")}>₹{p.price}cr</div>
                )}
                {p.cap && <div className="mt-2"><CapBadge cap={p.cap} /></div>}
                {p.overseas && <span className="absolute bottom-2.5 right-3 text-[10px] font-bold text-accent2">✈ OVERSEAS</span>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <p className="text-accent2 text-sm mt-3 min-h-5">{lastMessage}</p>
    </div>
  );
}

export default function DraftScreen() {
  return (
    <section className="max-w-6xl mx-auto px-5 py-6">
      <div className="grid gap-5" style={{ gridTemplateColumns: "340px 1fr" }}>
        <XIPanel />
        <MarketPanel />
      </div>
    </section>
  );
}
