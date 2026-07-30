import type { Player, Role, Slot, Squad, Position } from "./types";
import { MAX_OVERSEAS } from "./constants";

/** Uniform random pick — no weighting, no preference. */
export function pickUniform<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function openRoleCounts(slots: Slot[]): Record<Role, number> {
  const c: Record<Role, number> = { BAT: 0, WK: 0, ALL: 0, BOWL: 0 };
  slots.forEach((s) => { if (!s.player) c[s.role]++; });
  return c;
}

export function filledCount(slots: Slot[]): number {
  return slots.filter((s) => s.player).length;
}

export function overseasCount(slots: Slot[]): number {
  return slots.filter((s) => s.player?.overseas).length;
}

/**
 * Can this player fit any still-open slot, given global player-uniqueness and
 * the real IPL max-4-overseas-players rule? All-rounders are flexible: they
 * can fill a BAT or BOWL slot when no ALL slot is open.
 */
export function eligibleRoleFor(
  player: Player,
  slots: Slot[],
  usedPlayerNames: Set<string>
): Role | null {
  if (usedPlayerNames.has(player.name)) return null;
  if (player.overseas && overseasCount(slots) >= MAX_OVERSEAS) return null;
  const open = openRoleCounts(slots);
  if (open[player.role] > 0) return player.role;
  if (player.role === "ALL") {
    if (open.BAT > 0) return "BAT";
    if (open.BOWL > 0) return "BOWL";
  }
  return null;
}

/** A market with zero usable players — the player should get a free redraw. */
export function isDeadMarket(squad: Squad, slots: Slot[], usedPlayerNames: Set<string>): boolean {
  return !squad.players.some((p) => eligibleRoleFor(p, slots, usedPlayerNames));
}

/**
 * The cheapest total price to fill every still-open role, given who's already
 * used up — real auctions reserve exactly this so a team can never spend
 * itself into a corner where the purse can no longer complete the squad.
 * All-rounders are conservatively excluded from filling a plain BAT/BOWL
 * deficit here (they're pooled separately), which makes this an upper-bound
 * estimate — safe to over-reserve, never safe to under-reserve.
 */
function minCostToComplete(
  neededByRole: Record<Role, number>,
  allSquads: Squad[],
  usedPlayerNames: Set<string>,
  excludeName: string
): number {
  const cheapestByName = new Map<string, { role: Role; price: number }>();
  for (const sq of allSquads) {
    for (const p of sq.players) {
      if (usedPlayerNames.has(p.name) || p.name === excludeName) continue;
      const cur = cheapestByName.get(p.name);
      if (!cur || p.price < cur.price) cheapestByName.set(p.name, { role: p.role, price: p.price });
    }
  }
  const byRole: Record<Role, number[]> = { BAT: [], WK: [], ALL: [], BOWL: [] };
  for (const { role, price } of cheapestByName.values()) byRole[role].push(price);
  (Object.keys(byRole) as Role[]).forEach((r) => byRole[r].sort((a, b) => a - b));

  let total = 0;
  for (const role of ["WK", "BAT", "BOWL", "ALL"] as Role[]) {
    const need = neededByRole[role] ?? 0;
    const arr = byRole[role];
    if (arr.length < need) return Infinity; // not enough distinct players left at all — shouldn't happen
    for (let i = 0; i < need; i++) total += arr[i];
  }
  return total;
}

/**
 * Auction mode: same role eligibility, plus (a) the player must fit under the
 * purse left, and (b) buying them must still leave enough purse to complete
 * every other still-open role at its cheapest possible price — the reserve
 * check that keeps the auction from ever becoming unwinnable.
 */
export function eligibleRoleForAuction(
  player: Player,
  slots: Slot[],
  usedPlayerNames: Set<string>,
  purseLeft: number,
  allSquads: Squad[]
): Role | null {
  if (player.price > purseLeft) return null;
  const role = eligibleRoleFor(player, slots, usedPlayerNames);
  if (!role) return null;

  const neededAfter = openRoleCounts(slots);
  neededAfter[role]--;
  const reserve = minCostToComplete(neededAfter, allSquads, usedPlayerNames, player.name);
  if (purseLeft - player.price < reserve) return null;
  return role;
}

export function isDeadMarketAuction(
  squad: Squad,
  slots: Slot[],
  usedPlayerNames: Set<string>,
  purseLeft: number,
  allSquads: Squad[]
): boolean {
  return !squad.players.some((p) => eligibleRoleForAuction(p, slots, usedPlayerNames, purseLeft, allSquads));
}

/**
 * Real Positions mode: a player fills a still-open slot only if the slot's
 * specific real-life job (Opener, Death Bowler, ...) is one of the player's
 * tagged positions. Still respects the global overseas cap and player
 * uniqueness rules shared by every mode.
 */
export function eligiblePositionFor(
  player: Player,
  slots: Slot[],
  usedPlayerNames: Set<string>
): Position | null {
  if (usedPlayerNames.has(player.name)) return null;
  if (player.overseas && overseasCount(slots) >= MAX_OVERSEAS) return null;
  for (const slot of slots) {
    if (slot.player || !slot.position) continue;
    if (player.positions.includes(slot.position)) return slot.position;
  }
  return null;
}

export function isDeadMarketPositions(squad: Squad, slots: Slot[], usedPlayerNames: Set<string>): boolean {
  return !squad.players.some((p) => eligiblePositionFor(p, slots, usedPlayerNames));
}

/** The specific open positions still needed, in slot order (for UI hints). */
export function openPositions(slots: Slot[]): Position[] {
  return slots.filter((s) => !s.player && s.position).map((s) => s.position!);
}

/**
 * Draw a squad completely at random from every squad not excluded this turn.
 * Deliberately has NO preference for "squads with an eligible player" — that
 * kind of pre-filtering is what caused draws to visibly drift toward
 * lower-table teams as the draft went on (podium finishes are a small
 * minority of the 166 squads, so filtering-then-picking skews the pool
 * composition over time). True fairness comes from picking uniformly and
 * handling an occasional dead market with a free, uncosted redraw instead.
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
  kind: "team" | "season",
  excludedIds: Set<number>
): Squad[] {
  return allSquads.filter((sq) => {
    if (excludedIds.has(sq.id) || sq.id === current.id) return false;
    if (kind === "team") return sq.season === current.season && sq.franchise !== current.franchise;
    return sq.franchise === current.franchise && sq.season !== current.season;
  });
}
