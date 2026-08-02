import datasetJson from "./fixtures/dataset.json";
import { POSITION_FORMATION } from "../constants";
import { eligiblePositionsFor } from "../draft";
import type { GameData, Slot, SignedPlayer } from "../types";

/**
 * The real 143-squad / 2050-player dataset, snapshotted from `/api/data`.
 * Tests run against genuine data (not synthetic squads) because several
 * invariants -- deadlock-freedom especially -- depend on the real
 * distribution of position tags across historical squads.
 *
 * Regenerate after changing build_db.py:  npm run fixture
 */
export const DATA = datasetJson as unknown as GameData;

export function emptySlots(): Slot[] {
  return POSITION_FORMATION.map((def) => ({ role: def.role, position: def.position, player: null }));
}

/**
 * A deterministic pseudo-random generator so a failing test can be replayed
 * exactly. Math.random() would make flaky failures impossible to reproduce.
 */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

/** Swap in a seeded RNG for the duration of `fn`, then restore Math.random. */
export function withSeed<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = makeRng(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

/** Draft a complete legal XI the way the UI does, returning null if it stalls. */
export function draftXI(rand: () => number = Math.random): SignedPlayer[] | null {
  const slots = emptySlots();
  const used = new Set<string>();
  for (let guard = 0; guard < 5000; guard++) {
    if (slots.every((s) => s.player)) break;
    const sq = DATA.squads[Math.floor(rand() * DATA.squads.length)];
    const eligible = sq.players.filter((p) => eligiblePositionsFor(p, slots, used).length > 0);
    if (!eligible.length) continue;
    const pick = eligible[Math.floor(rand() * eligible.length)];
    const opts = eligiblePositionsFor(pick, slots, used);
    const fit = opts[Math.floor(rand() * opts.length)];
    const idx = slots.findIndex((s) => !s.player && s.position === fit);
    slots[idx] = {
      ...slots[idx],
      player: { ...pick, _src: `${sq.country_name} ${sq.edition}`, _srcSquadId: sq.id, _srcCode: sq.country },
    };
    used.add(pick.name);
  }
  const players = slots.map((s) => s.player).filter((p): p is SignedPlayer => p !== null);
  return players.length === 11 ? players : null;
}

/** Total legal balls in an innings, decoded from cricket's O.B overs notation. */
export function ballsOf(overs: number): number {
  const whole = Math.floor(overs + 1e-9);
  const rem = Math.round((overs - whole) * 10);
  return whole * 6 + rem;
}
