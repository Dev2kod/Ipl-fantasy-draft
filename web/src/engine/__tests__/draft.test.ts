import { describe, it, expect } from "vitest";
import {
  eligiblePositionsFor, eligiblePositionFor, validMoveTargets,
  isDeadMarketPositions, openPositions, filledCount, switchCandidates,
} from "../draft";
import { POSITION_FORMATION } from "../constants";
import { DATA, emptySlots, draftXI, makeRng, withSeed } from "./helpers";
import type { Slot, SignedPlayer, Player } from "../types";

const anyPlayer = (): Player => DATA.squads[0].players[0];

function sign(p: Player, squadIdx = 0): SignedPlayer {
  const sq = DATA.squads[squadIdx];
  return { ...p, _src: `${sq.country_name} ${sq.edition}`, _srcSquadId: sq.id, _srcCode: sq.country };
}

describe("formation", () => {
  it("is exactly 2 Openers, 4 Middle-order, 1 Wicketkeeper, 4 Bowlers", () => {
    const counts: Record<string, number> = {};
    for (const s of POSITION_FORMATION) counts[s.position] = (counts[s.position] ?? 0) + 1;
    expect(counts).toEqual({ Opener: 2, "Middle-order": 4, Wicketkeeper: 1, Bowler: 4 });
    expect(POSITION_FORMATION).toHaveLength(11);
  });
});

describe("eligibility", () => {
  it("only offers positions the player is actually tagged for", () => {
    const slots = emptySlots();
    for (const sq of DATA.squads.slice(0, 20)) {
      for (const p of sq.players) {
        for (const pos of eligiblePositionsFor(p, slots, new Set())) {
          expect(p.positions).toContain(pos);
        }
      }
    }
  });

  it("never offers a position whose slots are all filled", () => {
    const slots = emptySlots();
    // fill the single Wicketkeeper slot
    const wk = DATA.squads.flatMap((s) => s.players).find((p) => p.positions.includes("Wicketkeeper"))!;
    const wkIdx = slots.findIndex((s) => s.position === "Wicketkeeper");
    slots[wkIdx] = { ...slots[wkIdx], player: sign(wk) };

    const otherWk = DATA.squads.flatMap((s) => s.players)
      .find((p) => p.positions.includes("Wicketkeeper") && p.name !== wk.name)!;
    expect(eligiblePositionsFor(otherWk, slots, new Set())).not.toContain("Wicketkeeper");
  });

  it("refuses a player who is already signed", () => {
    const p = anyPlayer();
    expect(eligiblePositionsFor(p, emptySlots(), new Set([p.name]))).toEqual([]);
    expect(eligiblePositionFor(p, emptySlots(), new Set([p.name]))).toBeNull();
  });

  it("eligiblePositionFor agrees with the first entry of eligiblePositionsFor", () => {
    const slots = emptySlots();
    for (const p of DATA.squads[3].players) {
      const all = eligiblePositionsFor(p, slots, new Set());
      expect(eligiblePositionFor(p, slots, new Set())).toBe(all[0] ?? null);
    }
  });
});

describe("openPositions / filledCount", () => {
  it("agree with each other as slots fill up", () => {
    const slots = emptySlots();
    expect(filledCount(slots)).toBe(0);
    expect(openPositions(slots)).toHaveLength(11);
    slots[0] = { ...slots[0], player: sign(anyPlayer()) };
    expect(filledCount(slots)).toBe(1);
    expect(openPositions(slots)).toHaveLength(10);
  });
});

describe("validMoveTargets", () => {
  it("only targets slots the mover is tagged for", () => {
    const players = withSeed(11, () => draftXI(makeRng(11)));
    expect(players).not.toBeNull();
    const slots: Slot[] = emptySlots().map((s, i) => ({ ...s, player: players![i] }));
    for (let i = 0; i < slots.length; i++) {
      for (const t of validMoveTargets(i, slots)) {
        expect(slots[i].player!.positions).toContain(slots[t].position);
      }
    }
  });

  it("only swaps when the occupant can take the vacated slot back", () => {
    const players = withSeed(12, () => draftXI(makeRng(12)));
    const slots: Slot[] = emptySlots().map((s, i) => ({ ...s, player: players![i] }));
    for (let i = 0; i < slots.length; i++) {
      for (const t of validMoveTargets(i, slots)) {
        const occupant = slots[t].player;
        if (occupant) expect(occupant.positions).toContain(slots[i].position);
      }
    }
  });

  it("never lists the source slot itself", () => {
    const players = withSeed(13, () => draftXI(makeRng(13)));
    const slots: Slot[] = emptySlots().map((s, i) => ({ ...s, player: players![i] }));
    for (let i = 0; i < slots.length; i++) {
      expect(validMoveTargets(i, slots)).not.toContain(i);
    }
  });

  it("returns nothing for an empty slot", () => {
    expect(validMoveTargets(0, emptySlots())).toEqual([]);
  });

  it("keeps every slot legally occupied after applying a move", () => {
    const players = withSeed(14, () => draftXI(makeRng(14)));
    let slots: Slot[] = emptySlots().map((s, i) => ({ ...s, player: players![i] }));
    const rand = makeRng(99);
    for (let step = 0; step < 200; step++) {
      const from = Math.floor(rand() * slots.length);
      const targets = validMoveTargets(from, slots);
      if (!targets.length) continue;
      const to = targets[Math.floor(rand() * targets.length)];
      const a = slots[from].player, b = slots[to].player;
      slots = slots.map((s, i) => (i === from ? { ...s, player: b } : i === to ? { ...s, player: a } : s));

      for (const s of slots) {
        if (s.player) expect(s.player.positions).toContain(s.position);
      }
      const names = slots.filter((s) => s.player).map((s) => s.player!.name);
      expect(new Set(names).size).toBe(names.length); // no duplication via swapping
      expect(filledCount(slots)).toBe(11); // no player lost
    }
  });
});

describe("switchCandidates", () => {
  it("'team' keeps the edition and changes the country", () => {
    const cur = DATA.squads[40];
    for (const sq of switchCandidates(DATA.squads, cur, "team", new Set())) {
      expect(sq.edition).toBe(cur.edition);
      expect(sq.country).not.toBe(cur.country);
    }
  });

  it("'edition' keeps the country and changes the edition", () => {
    const cur = DATA.squads.find((s) => s.country === "IND")!;
    for (const sq of switchCandidates(DATA.squads, cur, "edition", new Set())) {
      expect(sq.country).toBe(cur.country);
      expect(sq.edition).not.toBe(cur.edition);
    }
  });

  it("honours turn-scoped exclusions and never returns the current squad", () => {
    const cur = DATA.squads[40];
    const excluded = new Set([DATA.squads[41].id, DATA.squads[42].id]);
    const got = switchCandidates(DATA.squads, cur, "team", excluded);
    expect(got.map((s) => s.id)).not.toContain(cur.id);
    for (const id of excluded) expect(got.map((s) => s.id)).not.toContain(id);
  });
});

describe("draft completion (deadlock-freedom)", () => {
  it("completes a legal XI from the real dataset across many seeds", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const players = draftXI(makeRng(seed));
      expect(players, `seed ${seed} failed to complete an XI`).not.toBeNull();
      expect(players!).toHaveLength(11);
      const names = players!.map((p) => p.name);
      expect(new Set(names).size, `seed ${seed} produced a duplicate player`).toBe(11);
    }
  });

  it("assigns every drafted player to a slot they are tagged for", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const slots = emptySlots();
      const used = new Set<string>();
      const rand = makeRng(seed);
      for (let guard = 0; guard < 5000 && slots.some((s) => !s.player); guard++) {
        const sq = DATA.squads[Math.floor(rand() * DATA.squads.length)];
        const eligible = sq.players.filter((p) => eligiblePositionsFor(p, slots, used).length > 0);
        if (!eligible.length) continue;
        const pick = eligible[Math.floor(rand() * eligible.length)];
        const opts = eligiblePositionsFor(pick, slots, used);
        const fit = opts[Math.floor(rand() * opts.length)];
        const idx = slots.findIndex((s) => !s.player && s.position === fit);
        slots[idx] = { ...slots[idx], player: sign(pick) };
        used.add(pick.name);
      }
      for (const s of slots) {
        expect(s.player!.positions).toContain(s.position);
      }
    }
  });
});

describe("dead market detection", () => {
  it("reports dead exactly when no player in the squad is eligible", () => {
    const slots = emptySlots();
    for (const sq of DATA.squads.slice(0, 30)) {
      const anyEligible = sq.players.some((p) => eligiblePositionsFor(p, slots, new Set()).length > 0);
      expect(isDeadMarketPositions(sq, slots, new Set())).toBe(!anyEligible);
    }
  });

  it("is dead once every player in that squad is already signed", () => {
    const sq = DATA.squads[7];
    const used = new Set(sq.players.map((p) => p.name));
    expect(isDeadMarketPositions(sq, emptySlots(), used)).toBe(true);
  });
});
