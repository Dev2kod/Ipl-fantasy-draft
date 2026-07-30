import type { SignedPlayer, Difficulty, Style, Squad } from "./types";
import { teamRatings } from "./ratings";
import { STAGES } from "./constants";
import { pickUniform } from "./draft";

const rint = (n: number) => Math.floor(Math.random() * n);

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
function clampRuns(v: number): number {
  return Math.max(70, Math.min(260, v));
}

export interface BatterLine {
  name: string;
  runs: number;
  balls: number;
  out: boolean;
}
export interface BowlerLine {
  name: string;
  overs: number;
  runsConceded: number;
  wickets: number;
}
export interface Innings {
  team: string;
  runs: number;
  wickets: number;
  overs: number;
  batters: BatterLine[];
  bowlers: BowlerLine[];
}

export interface MatchResult {
  stage: string;
  win: boolean;
  ourRuns: number;
  theirRuns: number;
  line: string;
  oppStrength: number;
  prob: number;
  tossYouWon: boolean;
  decision: "bat" | "bowl";
  oppName: string;
  oppColour: string;
  highlight: string | null;
  innings1: Innings;
  innings2: Innings;
}

export interface SimMeta {
  teamStrength: number;
  r: ReturnType<typeof teamRatings>;
  effBat: number;
  effBowl: number;
  won: number;
}

function weightedPick<T>(items: T[], weightFn: (x: T) => number): T {
  const weights = items.map((x) => Math.max(1, weightFn(x)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function fabricateHighlight(players: SignedPlayer[], ourRuns: number, win: boolean): string | null {
  const batPool = players.filter((p) => p.role !== "BOWL");
  const bowlPool = players.filter((p) => p.role === "BOWL" || p.role === "ALL");
  const wantBat = bowlPool.length === 0 || (batPool.length > 0 && Math.random() < 0.55);
  if (wantBat && batPool.length) {
    const p = weightedPick(batPool, (x) => x.bat);
    const runs = Math.max(8, Math.round(ourRuns * (0.22 + Math.random() * 0.22)));
    const balls = Math.max(6, Math.round(runs / (1.05 + Math.random() * 0.55)));
    return `${p.name} top-scored with ${runs} off ${balls} balls.`;
  }
  if (bowlPool.length) {
    const p = weightedPick(bowlPool, (x) => x.bowl);
    const wkts = Math.min(4, 1 + rint(3) + (win ? 1 : 0));
    const runsConceded = 18 + rint(20);
    return `${p.name} picked up ${wkts}/${runsConceded}.`;
  }
  return null;
}

/** Real cricket over notation: whole overs + 0-5 balls (never 17.7, only 17.0-17.5). */
function ballsToOvers(balls: number): number {
  const overs = Math.floor(balls / 6);
  const rem = balls % 6;
  return overs + rem / 10;
}

/** How many legal balls were bowled in this innings, given how it ended. */
function inningsBallsFaced(wicketsDown: number, isChaseWinner: boolean): number {
  if (wicketsDown >= 10) return 70 + rint(50); // all out: 11.4 to 19.5 overs
  if (isChaseWinner) return 78 + rint(42); // chase completed early: 13.0 to 19.5 overs
  return 120; // used the full 20-over quota
}

function randomWickets(chaseWinner: boolean): number {
  if (chaseWinner) return 2 + rint(6); // won the chase, doesn't need to lose everything
  return 4 + rint(7); // 4..10
}

/**
 * Distribute the balls of an innings across bowlers, respecting the real T20
 * rule that no bowler sends down more than 4 overs (24 balls) in a 20-over
 * innings. Round-robins one over at a time so nobody gets overloaded.
 */
function distributeBalls(totalBalls: number, nBowlers: number): number[] {
  const CAP = 24;
  const alloc = new Array(nBowlers).fill(0);
  let remaining = totalBalls;
  while (remaining > 0) {
    let progressed = false;
    for (let i = 0; i < nBowlers && remaining > 0; i++) {
      if (alloc[i] >= CAP) continue;
      const take = Math.min(6, CAP - alloc[i], remaining);
      alloc[i] += take;
      remaining -= take;
      progressed = true;
    }
    if (!progressed) break; // every bowler capped out (shouldn't happen with nBowlers>=5)
  }
  return alloc;
}

function makeBatters(names: string[], runs: number, wicketsDown: number): BatterLine[] {
  const battersShown = Math.min(names.length, wicketsDown + (wicketsDown >= 10 ? 1 : 2));
  const outCount = Math.min(wicketsDown, battersShown);

  const shares: number[] = [];
  let remaining = runs;
  for (let i = 0; i < battersShown; i++) {
    const isLast = i === battersShown - 1;
    const share = isLast ? remaining : Math.max(0, Math.round(remaining * (0.15 + Math.random() * 0.35)));
    shares.push(Math.max(0, share));
    remaining -= share;
  }
  shares.sort((a, b) => b - a); // top order scores more, in batting-order position

  return names.slice(0, battersShown).map((name, i) => {
    const r = shares[i] ?? 0;
    const balls = Math.max(r > 0 ? Math.round(r / (1.0 + Math.random() * 0.7)) : 1 + rint(4), 1);
    return { name, runs: r, balls, out: i < outCount };
  });
}

function makeBowlers(names: string[], wicketsTaken: number, totalBalls: number, runsConceded: number): BowlerLine[] {
  const nBowl = Math.max(5, Math.min(names.length, 6));
  const usableNames = names.length >= nBowl ? names.slice(0, nBowl) : [...names, ...names.slice(0, nBowl - names.length)];
  const ballAlloc = distributeBalls(totalBalls, nBowl);

  const bowledIdx = ballAlloc.map((b, i) => ({ b, i })).filter((x) => x.b > 0);
  let wktsLeft = wicketsTaken;
  let runsLeft = runsConceded;

  return bowledIdx.map(({ b, i }, k) => {
    const isLast = k === bowledIdx.length - 1;
    const share = b / totalBalls;
    const w = isLast ? wktsLeft : Math.min(wktsLeft, Math.round(wicketsTaken * share * (0.6 + Math.random() * 0.8)));
    wktsLeft -= w;
    const rc = isLast ? Math.max(0, runsLeft) : Math.max(0, Math.min(runsLeft, Math.round(runsConceded * share * (0.7 + Math.random() * 0.6))));
    runsLeft -= rc;
    return { name: usableNames[i], overs: ballsToOvers(b), runsConceded: Math.max(0, rc), wickets: Math.max(0, w) };
  });
}

function makeInnings(
  battingTeam: string,
  runs: number,
  isChaseWinner: boolean,
  battingNames: string[],
  bowlingNames: string[]
): Innings {
  const wickets = Math.min(10, randomWickets(isChaseWinner));
  const totalBalls = inningsBallsFaced(wickets, isChaseWinner);
  const overs = ballsToOvers(totalBalls);
  const batters = makeBatters(battingNames, runs, wickets);
  const bowlers = makeBowlers(bowlingNames, wickets, totalBalls, runs);
  return { team: battingTeam, runs, wickets, overs, batters, bowlers };
}

interface NamedRatings {
  name: string;
  bat: number;
  bowl: number;
}

function battingOrderOf(players: NamedRatings[]): string[] {
  return [...players].sort((a, b) => b.bat - a.bat).map((p) => p.name);
}
function bowlingOrderOf(players: NamedRatings[]): string[] {
  const bowlers = players.filter((p) => p.bowl >= 45).sort((a, b) => b.bowl - a.bowl);
  const pool = bowlers.length >= 5 ? bowlers : [...players].sort((a, b) => b.bowl - a.bowl);
  return pool.map((p) => p.name);
}

/** Pick a real squad from the dataset to be this match's opponent. */
function pickOpponentSquad(allSquads: Squad[], excludeIds: Set<number>, usedOppIds: Set<number>): Squad {
  const fresh = allSquads.filter((sq) => !excludeIds.has(sq.id) && !usedOppIds.has(sq.id));
  if (fresh.length) return pickUniform(fresh);
  const anyUnowned = allSquads.filter((sq) => !excludeIds.has(sq.id));
  if (anyUnowned.length) return pickUniform(anyUnowned);
  return pickUniform(allSquads);
}

export function simulateCupRun(
  players: SignedPlayer[],
  diff: Difficulty,
  style: Style,
  allSquads: Squad[],
  ownedSquadIds: Set<number>
): { results: MatchResult[]; meta: SimMeta } {
  const r = teamRatings(players);
  const effBat = clamp(r.batting * style.bat);
  const effBowl = clamp(r.bowling * style.bowl);
  const teamStrength = 0.45 * effBat + 0.45 * effBowl + 0.1 * r.balance;

  const battingOrder = battingOrderOf(players);
  const bowlingOrder = bowlingOrderOf(players);

  const results: MatchResult[] = [];
  const usedOppIds = new Set<number>();
  let won = 0;

  for (let i = 0; i < STAGES.length; i++) {
    const oppStrength = diff.opp + i * diff.spread;
    const gap = teamStrength - oppStrength;
    let p = 1 / (1 + Math.exp(-gap / 7));
    p = Math.max(0.05, Math.min(0.95, p));

    const win = Math.random() < p;
    const tossYouWon = Math.random() < 0.5;
    const decision: "bat" | "bowl" = Math.random() < 0.5 ? "bat" : "bowl";

    const oppSquad = pickOpponentSquad(allSquads, ownedSquadIds, usedOppIds);
    usedOppIds.add(oppSquad.id);
    const oppName = `${oppSquad.franchise_name} ${oppSquad.season}`;
    const oppBattingNames = battingOrderOf(oppSquad.players);
    const oppBowlingNames = bowlingOrderOf(oppSquad.players);

    const ourBase = 150 + Math.round((effBat - 70) * 1.6);
    const theirBase = 150 + Math.round((oppStrength - 70) * 1.6);
    const swing = 22 * style.variance;
    let ourRuns = clampRuns(ourBase + Math.round((Math.random() - 0.5) * 2 * swing));
    let theirRuns = clampRuns(theirBase + Math.round((Math.random() - 0.5) * 2 * swing));
    if (win && ourRuns <= theirRuns) {
      const t = theirRuns;
      theirRuns = Math.min(ourRuns - (1 + rint(9)), ourRuns - 1);
      if (theirRuns < 90) { theirRuns = t; ourRuns = theirRuns + 1 + rint(20); }
    }
    if (!win && ourRuns >= theirRuns) {
      ourRuns = Math.max(80, theirRuns - (1 + rint(14)));
    }

    const highlight = fabricateHighlight(players, ourRuns, win);

    // Who bats first: toss winner's decision drives it.
    const weBatFirst = tossYouWon ? decision === "bat" : decision === "bowl";
    const battingFirstRuns = weBatFirst ? ourRuns : theirRuns;
    const chasingRuns = weBatFirst ? theirRuns : ourRuns;
    const chaseWon = chasingRuns > battingFirstRuns; // consistent with `win` by construction above

    let innings1: Innings, innings2: Innings;
    if (weBatFirst) {
      innings1 = makeInnings("You", ourRuns, false, battingOrder, oppBowlingNames);
      innings2 = makeInnings(oppName, theirRuns, chaseWon, oppBattingNames, bowlingOrder);
    } else {
      innings1 = makeInnings(oppName, theirRuns, false, oppBattingNames, bowlingOrder);
      innings2 = makeInnings("You", ourRuns, chaseWon, battingOrder, oppBowlingNames);
    }

    // Derive the headline directly from the innings just generated, so it can
    // never disagree with the scorecard (runs margin when defending, wickets
    // in hand when chasing — never both).
    let line: string;
    if (win) {
      if (weBatFirst) {
        line = `Won by ${Math.max(1, ourRuns - theirRuns)} runs`;
      } else {
        const wicketsInHand = Math.max(1, 10 - innings2.wickets);
        line = `Won by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}`;
      }
    } else {
      if (weBatFirst) {
        const wicketsInHand = Math.max(1, 10 - innings2.wickets);
        line = `Lost by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}`;
      } else {
        line = `Lost by ${Math.max(1, theirRuns - ourRuns)} runs`;
      }
    }

    results.push({
      stage: STAGES[i], win, ourRuns, theirRuns, line,
      oppStrength: Math.round(oppStrength), prob: p,
      tossYouWon, decision, oppName, oppColour: oppSquad.colour, highlight,
      innings1, innings2,
    });
    if (win) won++;
    else break;
  }

  return { results, meta: { teamStrength, r, effBat, effBowl, won } };
}

export function tossText(m: MatchResult): string {
  const who = m.tossYouWon ? "You" : m.oppName;
  return `${who} won the toss and chose to ${m.decision} first.`;
}
