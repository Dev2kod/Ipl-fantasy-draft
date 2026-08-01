import type { Player, Slot, Squad, Position } from "./types";

/** Uniform random pick — no weighting, no preference. */
export function pickUniform<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function filledCount(slots: Slot[]): number {
  return slots.filter((s) => s.player).length;
}

/**
 * Every distinct real-life job (Opener, Middle-order, Wicketkeeper, Bowler)
 * this player could fill right now -- i.e. one of their tagged positions AND
 * a still-open slot exists for it. A player can be signed only once, even if
 * they played in multiple World Cups. When a player carries more than one
 * tag with an open slot (a flexible batter, or a genuine all-rounder), this
 * returns every option so the draft can offer a real choice instead of
 * silently picking the first match.
 */
export function eligiblePositionsFor(
  player: Player,
  slots: Slot[],
  usedPlayerNames: Set<string>
): Position[] {
  if (usedPlayerNames.has(player.name)) return [];
  const open = new Set(slots.filter((s) => !s.player).map((s) => s.position));
  return player.positions.filter((pos) => open.has(pos));
}

/** The first eligible position, for call sites that only need a yes/no fit check. */
export function eligiblePositionFor(
  player: Player,
  slots: Slot[],
  usedPlayerNames: Set<string>
): Position | null {
  return eligiblePositionsFor(player, slots, usedPlayerNames)[0] ?? null;
}

/**
 * Every other slot a currently-signed player could move into: an empty slot
 * matching one of their tags, or a filled slot whose occupant could swap
 * back into the player's current slot. Used to let the XI stay editable
 * after the initial pick.
 */
export function validMoveTargets(fromIdx: number, slots: Slot[]): number[] {
  const from = slots[fromIdx];
  if (!from.player) return [];
  const targets: number[] = [];
  slots.forEach((s, i) => {
    if (i === fromIdx) return;
    if (!from.player!.positions.includes(s.position)) return;
    if (!s.player) { targets.push(i); return; }
    if (s.player.positions.includes(from.position)) targets.push(i);
  });
  return targets;
}

/** A market with zero usable players — the player should get a free redraw. */
export function isDeadMarketPositions(squad: Squad, slots: Slot[], usedPlayerNames: Set<string>): boolean {
  return !squad.players.some((p) => eligiblePositionFor(p, slots, usedPlayerNames));
}

/** The specific open positions still needed, in slot order (for UI hints). */
export function openPositions(slots: Slot[]): Position[] {
  return slots.filter((s) => !s.player).map((s) => s.position);
}

/**
 * Draw a squad completely at random from every squad not excluded this turn.
 * Deliberately has NO preference for "squads with an eligible player" — that
 * kind of pre-filtering skews draws toward lower-table teams over a draft
 * (podium finishes are a small minority of all squads). True fairness comes
 * from picking uniformly and handling an occasional dead market with a free,
 * uncosted redraw instead.
 */
export function drawRandomSquad(allSquads: Squad[], excludedIds: Set<number>): Squad | null {
  const pool = allSquads.filter((sq) => !excludedIds.has(sq.id));
  if (pool.length === 0) return null;
  return pickUniform(pool);
}

/** Candidates for a targeted switch — unrestricted aside from turn-scoped exclusions. */
export function switchCandidates(
  allSquads: Squad[],
  current: Squad,
  kind: "team" | "edition",
  excludedIds: Set<number>
): Squad[] {
  return allSquads.filter((sq) => {
    if (excludedIds.has(sq.id) || sq.id === current.id) return false;
    if (kind === "team") return sq.edition === current.edition && sq.country !== current.country;
    return sq.country === current.country && sq.edition !== current.edition;
  });
}
