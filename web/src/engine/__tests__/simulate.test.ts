import { describe, it, expect } from "vitest";
import { simulateCupRun, tossText, GROUP_MATCHES } from "../simulate";
import { DIFFICULTIES, STYLES } from "../constants";
import { DATA, draftXI, makeRng, withSeed, ballsOf } from "./helpers";
import type { MatchResult, SimMeta, Innings } from "../simulate";

const MAX_OVERS_PER_BOWLER = 10;
const ODI_BALLS = 300;

/** Run one full tournament deterministically for a given seed. */
function runTournament(seed: number): { results: MatchResult[]; meta: SimMeta } {
  return withSeed(seed, () => {
    const players = draftXI(makeRng(seed))!;
    const owned = new Set(players.map((p) => p._srcSquadId));
    return simulateCupRun(players, DIFFICULTIES[seed % 3], STYLES[seed % 3], DATA.squads, owned);
  });
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const RUNS = SEEDS.map(runTournament);
const ALL_MATCHES = RUNS.flatMap((r) => r.results);
const ALL_INNINGS: Innings[] = ALL_MATCHES.flatMap((m) => [m.innings1, m.innings2]);

describe("scorecard arithmetic", () => {
  it("batter runs sum exactly to the innings total", () => {
    for (const inn of ALL_INNINGS) {
      const sum = inn.batters.reduce((a, b) => a + b.runs, 0);
      expect(sum).toBe(inn.runs);
    }
  });

  it("batter balls faced sum exactly to the innings' real ball count", () => {
    for (const inn of ALL_INNINGS) {
      const sum = inn.batters.reduce((a, b) => a + b.balls, 0);
      expect(sum).toBe(ballsOf(inn.overs));
    }
  });

  it("bowler wickets sum exactly to the innings wickets", () => {
    for (const inn of ALL_INNINGS) {
      const sum = inn.bowlers.reduce((a, b) => a + b.wickets, 0);
      expect(sum).toBe(inn.wickets);
    }
  });

  it("bowler runs conceded sum to the innings total", () => {
    for (const inn of ALL_INNINGS) {
      const sum = inn.bowlers.reduce((a, b) => a + b.runsConceded, 0);
      expect(sum).toBe(inn.runs);
    }
  });

  it("bowler overs sum to the innings' real ball count", () => {
    for (const inn of ALL_INNINGS) {
      const sum = inn.bowlers.reduce((a, b) => a + ballsOf(b.overs), 0);
      expect(sum).toBe(ballsOf(inn.overs));
    }
  });
});

describe("ODI laws", () => {
  it("no bowler exceeds the 10-over limit", () => {
    for (const inn of ALL_INNINGS) {
      for (const b of inn.bowlers) {
        expect(ballsOf(b.overs)).toBeLessThanOrEqual(MAX_OVERS_PER_BOWLER * 6);
      }
    }
  });

  it("no innings exceeds 50 overs", () => {
    for (const inn of ALL_INNINGS) {
      expect(ballsOf(inn.overs)).toBeLessThanOrEqual(ODI_BALLS);
    }
  });

  it("overs are valid cricket notation (never x.6 through x.9)", () => {
    for (const inn of ALL_INNINGS) {
      const frac = Math.round((inn.overs - Math.floor(inn.overs + 1e-9)) * 10);
      expect(frac).toBeLessThanOrEqual(5);
      for (const b of inn.bowlers) {
        const bf = Math.round((b.overs - Math.floor(b.overs + 1e-9)) * 10);
        expect(bf).toBeLessThanOrEqual(5);
      }
    }
  });

  it("never loses more than 10 wickets", () => {
    for (const inn of ALL_INNINGS) {
      expect(inn.wickets).toBeGreaterThanOrEqual(0);
      expect(inn.wickets).toBeLessThanOrEqual(10);
    }
  });

  it("shows at least as many batters as wickets that fell", () => {
    for (const inn of ALL_INNINGS) {
      const outCount = inn.batters.filter((b) => b.out).length;
      expect(outCount).toBe(Math.min(inn.wickets, inn.batters.length));
    }
  });
});

describe("chasing follows real cricket rules", () => {
  it("a won chase only ever edges past the target (the innings stops there)", () => {
    for (const m of ALL_MATCHES) {
      const target = m.innings1.runs;
      const chased = m.innings2.runs;
      if (chased > target) {
        const margin = chased - target;
        expect(margin, `chase margin ${margin} is not a realistic finish`).toBeGreaterThanOrEqual(1);
        expect(margin, `chase margin ${margin} implies batting on after winning`).toBeLessThanOrEqual(30);
      }
    }
  });

  it("a lost chase always finishes genuinely short (never a tie-as-win)", () => {
    for (const m of ALL_MATCHES) {
      expect(m.innings1.runs).not.toBe(m.innings2.runs); // no unresolved ties
    }
  });

  it("the reported result matches who actually scored more", () => {
    for (const m of ALL_MATCHES) {
      const youBattedFirst = m.innings1.team === "You";
      const yourRuns = youBattedFirst ? m.innings1.runs : m.innings2.runs;
      const theirRuns = youBattedFirst ? m.innings2.runs : m.innings1.runs;
      expect(yourRuns).toBe(m.ourRuns);
      expect(theirRuns).toBe(m.theirRuns);
      expect(m.win).toBe(yourRuns > theirRuns);
    }
  });

  it("describes the margin the way cricket does (runs defending, wickets chasing)", () => {
    for (const m of ALL_MATCHES) {
      const youBattedFirst = m.innings1.team === "You";
      // The side batting second wins by wickets; the side batting first wins by runs.
      if (m.win) {
        expect(m.line).toMatch(youBattedFirst ? /^Won by \d+ runs$/ : /^Won by \d+ wickets?$/);
      } else {
        expect(m.line).toMatch(youBattedFirst ? /^Lost by \d+ wickets?$/ : /^Lost by \d+ runs$/);
      }
    }
  });

  it("a runs margin in the headline equals the real difference on the card", () => {
    for (const m of ALL_MATCHES) {
      const runsMatch = m.line.match(/by (\d+) runs$/);
      if (runsMatch) {
        expect(Number(runsMatch[1])).toBe(Math.abs(m.ourRuns - m.theirRuns));
      }
    }
  });
});

describe("highlight text is read off the real scorecard", () => {
  it("every highlight names a player with those exact figures", () => {
    let checked = 0;
    for (const m of ALL_MATCHES) {
      if (!m.highlight) continue;
      checked++;
      const yourInn = m.innings1.team === "You" ? m.innings1 : m.innings2;
      const oppInn = m.innings1.team === "You" ? m.innings2 : m.innings1;

      const bat = m.highlight.match(/^(.+) top-scored with (\d+) off (\d+) balls\.$/);
      const bowl = m.highlight.match(/^(.+) picked up (\d+)\/(\d+)\.$/);
      expect(bat || bowl, `unparseable highlight: ${m.highlight}`).toBeTruthy();

      if (bat) {
        const line = yourInn.batters.find((b) => b.name === bat[1]);
        expect(line, `${bat[1]} not in your batting card`).toBeTruthy();
        expect(line!.runs).toBe(Number(bat[2]));
        expect(line!.balls).toBe(Number(bat[3]));
      } else if (bowl) {
        // your bowlers appear in the innings the opposition batted
        const line = oppInn.bowlers.find((b) => b.name === bowl[1]);
        expect(line, `${bowl[1]} not in your bowling card`).toBeTruthy();
        expect(line!.wickets).toBe(Number(bowl[2]));
        expect(line!.runsConceded).toBe(Number(bowl[3]));
      }
    }
    expect(checked).toBeGreaterThan(50); // the assertion above actually ran
  });

  it("only quotes a player who appears in that match", () => {
    for (const m of ALL_MATCHES) {
      if (!m.highlight) continue;
      const named = m.highlight.split(" top-scored")[0].split(" picked up")[0];
      const everyone = [...m.innings1.batters, ...m.innings1.bowlers, ...m.innings2.batters, ...m.innings2.bowlers]
        .map((x) => x.name);
      expect(everyone).toContain(named);
    }
  });
});

describe("tournament structure", () => {
  it("always plays all 3 group matches regardless of results", () => {
    for (const { results } of RUNS) {
      const group = results.slice(0, GROUP_MATCHES);
      expect(group).toHaveLength(3);
      for (let i = 0; i < 3; i++) expect(group[i].stage).toBe(`Group Match ${i + 1}`);
    }
  });

  it("fields 8 groups of 4 with the player in exactly one of them", () => {
    for (const { meta } of RUNS) {
      expect(meta.allGroupStandings).toHaveLength(8);
      for (const g of meta.allGroupStandings) expect(g).toHaveLength(4);
      const yous = meta.allGroupStandings.flat().filter((r) => r.isYou);
      expect(yous).toHaveLength(1);
    }
  });

  it("orders every group table by points, then run difference", () => {
    for (const { meta } of RUNS) {
      for (const g of meta.allGroupStandings) {
        for (let i = 1; i < g.length; i++) {
          const a = g[i - 1], b = g[i];
          const aDiff = a.runsFor - a.runsAgainst, bDiff = b.runsFor - b.runsAgainst;
          expect(a.points > b.points || (a.points === b.points && aDiff >= bDiff)).toBe(true);
        }
      }
    }
  });

  it("keeps each group internally consistent (3 games each, W+L=P, points=2W)", () => {
    for (const { meta } of RUNS) {
      for (const g of meta.allGroupStandings) {
        let wins = 0;
        for (const row of g) {
          expect(row.played).toBe(3);
          expect(row.won + row.lost).toBe(3);
          expect(row.points).toBe(row.won * 2);
          wins += row.won;
        }
        expect(wins).toBe(6); // 6 matches in a 4-team round robin, one winner each
      }
    }
  });

  it("qualifies exactly when the player finishes top 2", () => {
    for (const { meta } of RUNS) {
      expect(meta.qualified).toBe(meta.groupRank <= 2);
    }
  });

  it("records none of your own knockout matches when not qualified, but the bracket still resolves", () => {
    for (const { results, meta } of RUNS) {
      if (!meta.qualified) {
        expect(results).toHaveLength(GROUP_MATCHES);
        expect(meta.stageReached).toBe("Group Stage");
      }
    }
  });

  it("runs a full 16/8/4/2 bracket for every tournament, whether or not you qualified", () => {
    expect(RUNS.length).toBeGreaterThan(0);
    for (const { meta } of RUNS) {
      expect(meta.bracket.map((r) => r.length)).toEqual([8, 4, 2, 1]);
      expect(meta.bracket[0][0].round).toBe("Round of 16");
      expect(meta.bracket[3][0].round).toBe("Final");
    }
  });

  it("never seeds you into the bracket unless you actually finished top 2 in your group", () => {
    for (const { meta } of RUNS) {
      const inBracket = meta.bracket.some((round) => round.some((m) => m.teamA.isYou || m.teamB.isYou));
      expect(inBracket).toBe(meta.qualified);
    }
  });

  it("only advances real winners from round to round", () => {
    for (const { meta } of RUNS.filter((r) => r.meta.qualified)) {
      for (let ri = 0; ri < meta.bracket.length - 1; ri++) {
        const winners = new Set(meta.bracket[ri].map((m) => (m.winnerIsA ? m.teamA.name : m.teamB.name)));
        for (const m of meta.bracket[ri + 1]) {
          expect(winners).toContain(m.teamA.name);
          expect(winners).toContain(m.teamB.name);
        }
      }
    }
  });

  it("never puts the same team on both sides of a tie", () => {
    for (const { meta } of RUNS.filter((r) => r.meta.qualified)) {
      for (const round of meta.bracket) {
        for (const m of round) expect(m.teamA.name).not.toBe(m.teamB.name);
      }
    }
  });

  it("ends the player's run at their first knockout defeat", () => {
    for (const { results, meta } of RUNS.filter((r) => r.meta.qualified)) {
      const knockouts = results.slice(GROUP_MATCHES);
      const firstLoss = knockouts.findIndex((m) => !m.win);
      if (firstLoss !== -1) {
        expect(firstLoss).toBe(knockouts.length - 1); // nothing recorded after it
        expect(meta.champion).toBe(false);
      }
    }
  });

  it("declares champion only after actually winning the Final", () => {
    for (const { results, meta } of RUNS) {
      if (meta.champion) {
        const last = results[results.length - 1];
        expect(last.stage).toBe("Final");
        expect(last.win).toBe(true);
        expect(meta.reachedFinal).toBe(true);
        expect(meta.stageReached).toBe("Champions");
      }
    }
  });

  it("caps a perfect run at 7 matches", () => {
    for (const { results, meta } of RUNS) {
      expect(results.length).toBeLessThanOrEqual(7);
      expect(meta.played).toBe(results.length);
      expect(meta.won).toBeLessThanOrEqual(meta.played);
      expect(meta.won).toBe(results.filter((m) => m.win).length);
    }
  });

  it("names knockout rounds in the right order", () => {
    for (const { results } of RUNS.filter((r) => r.meta.qualified)) {
      const expected = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"];
      const got = results.slice(GROUP_MATCHES).map((m) => m.stage);
      expect(got).toEqual(expected.slice(0, got.length));
    }
  });
});

describe("tournament leaderboard", () => {
  it("is sorted descending and non-empty", () => {
    for (const { meta } of RUNS) {
      expect(meta.topRuns.length).toBeGreaterThan(0);
      expect(meta.topWickets.length).toBeGreaterThan(0);
      for (let i = 1; i < meta.topRuns.length; i++) {
        expect(meta.topRuns[i - 1].value).toBeGreaterThanOrEqual(meta.topRuns[i].value);
      }
      for (let i = 1; i < meta.topWickets.length; i++) {
        expect(meta.topWickets[i - 1].value).toBeGreaterThanOrEqual(meta.topWickets[i].value);
      }
    }
  });

  it("lists each player once, with a team attached", () => {
    for (const { meta } of RUNS) {
      for (const board of [meta.topRuns, meta.topWickets]) {
        const names = board.map((r) => r.name);
        expect(new Set(names).size).toBe(names.length);
        for (const row of board) {
          expect(row.team).toBeTruthy();
          expect(row.value).toBeGreaterThan(0);
        }
      }
    }
  });

  it("credits your own players to 'You'", () => {
    for (const { meta } of RUNS) {
      const yours = [...meta.topRuns, ...meta.topWickets].filter((r) => r.team === "You");
      for (const row of yours) expect(row.teamCode).toBe("");
    }
  });

  it("breaks every total down into the real matches it came from", () => {
    for (const { meta } of RUNS) {
      for (const row of [...meta.topRuns, ...meta.topWickets]) {
        expect(row.contributions.length).toBeGreaterThan(0);
        const sum = row.contributions.reduce((a, c) => a + c.value, 0);
        expect(sum).toBe(row.value);
        for (const c of row.contributions) {
          expect(c.stage).toBeTruthy();
          expect(c.opponent).toBeTruthy();
          expect(c.value).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("opponents", () => {
  it("never draws a squad the player drafted from", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      withSeed(seed, () => {
        const players = draftXI(makeRng(seed))!;
        const owned = new Set(players.map((p) => p._srcSquadId));
        const ownedNames = new Set(
          DATA.squads.filter((s) => owned.has(s.id)).map((s) => `${s.country_name} ${s.edition}`)
        );
        const { results } = simulateCupRun(players, DIFFICULTIES[1], STYLES[1], DATA.squads, owned);
        for (const m of results) expect(ownedNames).not.toContain(m.oppName);
      });
    }
  });

  it("is always a real squad from the dataset, with a flag code", () => {
    const real = new Set(DATA.squads.map((s) => `${s.country_name} ${s.edition}`));
    for (const m of ALL_MATCHES) {
      expect(real).toContain(m.oppName);
      expect(m.oppCode).toBeTruthy();
    }
  });

  it("never draws ANY squad containing a drafted player, even from a different World Cup edition", () => {
    const squadByName = new Map(DATA.squads.map((s) => [`${s.country_name} ${s.edition}`, s]));
    for (const seed of SEEDS.slice(0, 20)) {
      withSeed(seed, () => {
        const players = draftXI(makeRng(seed))!;
        const draftedNames = new Set(players.map((p) => p.name));
        const owned = new Set(players.map((p) => p._srcSquadId));
        const { meta } = simulateCupRun(players, DIFFICULTIES[1], STYLES[1], DATA.squads, owned);
        for (const row of meta.allGroupStandings.flat()) {
          if (row.isYou) continue;
          const squad = squadByName.get(row.name);
          expect(squad, `${row.name} not found in dataset`).toBeTruthy();
          for (const p of squad!.players) {
            expect(draftedNames, `${p.name} (drafted by you) reappeared via ${row.name}`).not.toContain(p.name);
          }
        }
      });
    }
  });
});

describe("tossText", () => {
  it("names the toss winner and their choice", () => {
    for (const m of ALL_MATCHES.slice(0, 40)) {
      const t = tossText(m);
      expect(t).toContain(m.tossYouWon ? "You won the toss" : `${m.oppName} won the toss`);
      expect(t).toContain(`chose to ${m.decision} first`);
    }
  });

  it("agrees with who actually batted first", () => {
    for (const m of ALL_MATCHES) {
      const youBattedFirst = m.innings1.team === "You";
      const expected = m.tossYouWon ? m.decision === "bat" : m.decision === "bowl";
      expect(youBattedFirst).toBe(expected);
    }
  });
});

describe("determinism", () => {
  it("produces identical tournaments for the same seed", () => {
    const a = runTournament(4242);
    const b = runTournament(4242);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
