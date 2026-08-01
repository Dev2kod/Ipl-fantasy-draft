import type { SignedPlayer, Player, Difficulty, Style, Squad } from "./types";
import { teamRatings } from "./ratings";
import { STAGES } from "./constants";

const rint = (n: number) => Math.floor(Math.random() * n);

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
/** ODI totals: a cheap all-out is possible, a big total can push past 400. */
function clampRuns(v: number): number {
  return Math.max(110, Math.min(430, v));
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
  oppCode: string;
  highlight: string | null;
  innings1: Innings;
  innings2: Innings;
}

export type StageReached =
  | "Group Stage" | "Round of 16" | "Quarter-Final" | "Semi-Final" | "Final" | "Champions";

export interface GroupStanding {
  name: string;
  colour: string;
  isYou: boolean;
  played: number;
  won: number;
  lost: number;
  runsFor: number;
  runsAgainst: number;
  points: number;
}

export interface LeaderboardRow {
  name: string;
  team: string;
  value: number;
}

export interface SimMeta {
  teamStrength: number;
  r: ReturnType<typeof teamRatings>;
  effBat: number;
  effBowl: number;
  won: number;
  played: number;
  groupStandings: GroupStanding[];
  groupRank: number;
  qualified: boolean;
  reachedFinal: boolean;
  champion: boolean;
  stageReached: StageReached;
  topRuns: LeaderboardRow[];
  topWickets: LeaderboardRow[];
}

const ODI_OVERS = 50;
const ODI_BALLS = ODI_OVERS * 6; // 300
const MAX_OVERS_PER_BOWLER = 10; // 60 balls, the real ODI rule

// 8 groups of 4 (32 teams total): you + 3 opponents in your group, 7 more
// groups of 4 real historical squads. Top 2 per group (16 teams) advance to
// a Round of 16 -> Quarter-Final -> Semi-Final -> Final knockout bracket --
// 3 group matches + up to 4 knockout matches = 7 for a perfect run.
const GROUPS_TOTAL = 8;
const TEAM_PER_GROUP = 4;
export const GROUP_MATCHES = TEAM_PER_GROUP - 1; // 3 group matches per team

function weightedPick<T>(items: T[], weightFn: (x: T) => number): T {
  const weights = items.map((x) => Math.max(0.001, weightFn(x)));
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
    const runs = Math.max(15, Math.round(ourRuns * (0.2 + Math.random() * 0.22)));
    // ODI strike rates: roughly 75-115
    const balls = Math.max(10, Math.round(runs / (0.75 + Math.random() * 0.4)));
    return `${p.name} top-scored with ${runs} off ${balls} balls.`;
  }
  if (bowlPool.length) {
    const p = weightedPick(bowlPool, (x) => x.bowl);
    const wkts = Math.min(5, 1 + rint(3) + (win ? 1 : 0));
    const runsConceded = 32 + rint(28); // a full 10-over ODI spell
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

/** How many legal balls were bowled in this innings, given how it ended (50-over ODI). */
function inningsBallsFaced(wicketsDown: number, isChaseWinner: boolean): number {
  if (wicketsDown >= 10) return 120 + rint(178); // all out: 20.0 to 49.5 overs
  if (isChaseWinner) return 180 + rint(119); // chase completed early: 30.0 to 49.5 overs
  return ODI_BALLS; // used the full 50-over quota
}

function randomWickets(chaseWinner: boolean): number {
  if (chaseWinner) return 2 + rint(6); // won the chase, doesn't need to lose everything
  return 4 + rint(7); // 4..10
}

/**
 * Distribute the balls of an innings across bowlers, respecting the real ODI
 * rule that no bowler sends down more than 10 overs (60 balls) in a 50-over
 * innings. Round-robins one over at a time so nobody gets overloaded.
 */
function distributeBalls(totalBalls: number, nBowlers: number): number[] {
  const alloc = new Array(nBowlers).fill(0);
  let remaining = totalBalls;
  while (remaining > 0) {
    let progressed = false;
    for (let i = 0; i < nBowlers && remaining > 0; i++) {
      if (alloc[i] >= MAX_OVERS_PER_BOWLER * 6) continue;
      const take = Math.min(6, MAX_OVERS_PER_BOWLER * 6 - alloc[i], remaining);
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
    // ODI strike rates: roughly 65-105 depending on situation
    const balls = Math.max(r > 0 ? Math.round(r / (0.65 + Math.random() * 0.4)) : 1 + rint(6), 1);
    return { name, runs: r, balls, out: i < outCount };
  });
}

function makeBowlers(names: string[], wicketsTaken: number, totalBalls: number, runsConceded: number): BowlerLine[] {
  const nBowl = Math.max(5, Math.min(names.length, 7));
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

function battingOrderOf(players: Player[]): string[] {
  return [...players].sort((a, b) => b.bat - a.bat).map((p) => p.name);
}
function bowlingOrderOf(players: Player[]): string[] {
  const bowlers = players.filter((p) => p.bowl >= 45).sort((a, b) => b.bowl - a.bowl);
  const pool = bowlers.length >= 5 ? bowlers : [...players].sort((a, b) => b.bowl - a.bowl);
  return pool.map((p) => p.name);
}

interface RosterPlayer {
  name: string;
  bat: number;
  bowl: number;
  role: string;
}

/** One team in the tournament -- either "You" (your drafted XI) or a real
 *  historical squad from the dataset, rated from its own players' ratings. */
interface TeamEntry {
  name: string;
  colour: string;
  code: string;
  isYou: boolean;
  strength: number;
  battingNames: string[];
  bowlingNames: string[];
  roster: RosterPlayer[]; // every team's full roster -- used for tournament-wide leaderboard stats
  highlightPool?: SignedPlayer[]; // only set for "You" -- used to fabricate a highlight
}

function toRoster(players: Player[]): RosterPlayer[] {
  return players.map((p) => ({ name: p.name, bat: p.bat, bowl: p.bowl, role: p.role }));
}

function youEntry(players: SignedPlayer[], strength: number): TeamEntry {
  return {
    name: "You", colour: "#ff7a1a", code: "", isYou: true, strength,
    battingNames: battingOrderOf(players), bowlingNames: bowlingOrderOf(players),
    roster: toRoster(players), highlightPool: players,
  };
}

function squadEntry(squad: Squad): TeamEntry {
  return {
    name: `${squad.country_name} ${squad.edition}`, colour: squad.colour, code: squad.country, isYou: false,
    strength: teamRatings(squad.players).overall,
    battingNames: battingOrderOf(squad.players), bowlingNames: bowlingOrderOf(squad.players),
    roster: toRoster(squad.players),
  };
}

/**
 * One standout batting + bowling performance for a team in a single match --
 * generated for EVERY match in the whole 32-team tournament (not just yours)
 * so the tournament stats leaderboard reflects the entire field, the way a
 * real World Cup's Most Runs / Most Wickets tables do.
 */
function fabricatePerformance(roster: RosterPlayer[], runsScored: number) {
  const batPool = roster.filter((p) => p.role !== "BOWL");
  const bowlPool = roster.filter((p) => p.role === "BOWL" || p.role === "ALL");
  const batter = weightedPick(batPool.length ? batPool : roster, (x) => x.bat);
  const bowler = weightedPick(bowlPool.length ? bowlPool : roster, (x) => x.bowl);
  const runs = Math.max(10, Math.round(runsScored * (0.15 + Math.random() * 0.25)));
  const wickets = Math.min(5, 1 + rint(3));
  return { batter: { name: batter.name, runs }, bowler: { name: bowler.name, wickets } };
}

/** Tally one team's standout performance from a match into the running
 *  tournament-wide leaderboard maps. */
function tally(
  runsMap: Map<string, LeaderboardRow>,
  wktsMap: Map<string, LeaderboardRow>,
  entry: TeamEntry,
  runsScored: number
) {
  const perf = fabricatePerformance(entry.roster, runsScored);
  const rRow = runsMap.get(perf.batter.name) ?? { name: perf.batter.name, team: entry.name, value: 0 };
  rRow.value += perf.batter.runs;
  rRow.team = entry.name;
  runsMap.set(perf.batter.name, rRow);

  const wRow = wktsMap.get(perf.bowler.name) ?? { name: perf.bowler.name, team: entry.name, value: 0 };
  wRow.value += perf.bowler.wickets;
  wRow.team = entry.name;
  wktsMap.set(perf.bowler.name, wRow);
}

/** Weight real historical squads toward the difficulty's target strength band
 *  (a Gaussian falloff), so "Warm-up" fills the World Cup with weaker
 *  historical sides and "Dynasty" with champion-calibre ones. */
function drawSquadPool(count: number, allSquads: Squad[], exclude: Set<number>, target: number, sigma: number): Squad[] {
  const excluded = new Set(exclude);
  const chosen: Squad[] = [];
  for (let i = 0; i < count; i++) {
    const pool = allSquads.filter((sq) => !excluded.has(sq.id));
    if (!pool.length) break;
    const sq = weightedPick(pool, (s) => {
      const d = teamRatings(s.players).overall - target;
      return Math.exp(-(d * d) / (2 * sigma * sigma));
    });
    excluded.add(sq.id);
    chosen.push(sq);
  }
  return chosen;
}

/** Simplified head-to-head: a logistic win probability from the strength
 *  gap, then ODI-realistic run totals for both sides consistent with who won. */
function playOutScore(strengthA: number, strengthB: number, variance: number): { aWin: boolean; prob: number; runsA: number; runsB: number } {
  const gap = strengthA - strengthB;
  let p = 1 / (1 + Math.exp(-gap / 7));
  p = Math.max(0.05, Math.min(0.95, p));
  const aWin = Math.random() < p;

  const baseA = 260 + Math.round((strengthA - 70) * 2.3);
  const baseB = 260 + Math.round((strengthB - 70) * 2.3);
  const swing = 45 * variance;
  let runsA = clampRuns(baseA + Math.round((Math.random() - 0.5) * 2 * swing));
  let runsB = clampRuns(baseB + Math.round((Math.random() - 0.5) * 2 * swing));
  if (aWin && runsA <= runsB) {
    const t = runsB;
    runsB = Math.min(runsA - (1 + rint(15)), runsA - 1);
    if (runsB < 140) { runsB = t; runsA = runsB + 1 + rint(30); }
  }
  if (!aWin && runsA >= runsB) {
    runsA = Math.max(130, runsB - (1 + rint(22)));
  }
  return { aWin, prob: p, runsA, runsB };
}

/** A lightweight AI-vs-AI result -- just enough for standings, no scorecard. */
function simulateLite(a: TeamEntry, b: TeamEntry): { aWin: boolean; runsA: number; runsB: number } {
  const { aWin, runsA, runsB } = playOutScore(a.strength, b.strength, 1.0);
  return { aWin, runsA, runsB };
}

/** A full match involving "You" -- toss, innings, scorecards, highlight. */
function simulateDetailed(you: TeamEntry, opp: TeamEntry, style: Style, stage: string): MatchResult {
  const { aWin: win, prob, runsA: ourRuns, runsB: theirRuns } = playOutScore(you.strength, opp.strength, style.variance);

  const tossYouWon = Math.random() < 0.5;
  const decision: "bat" | "bowl" = Math.random() < 0.5 ? "bat" : "bowl";
  const highlight = fabricateHighlight(you.highlightPool ?? [], ourRuns, win);

  const weBatFirst = tossYouWon ? decision === "bat" : decision === "bowl";
  const battingFirstRuns = weBatFirst ? ourRuns : theirRuns;
  const chasingRuns = weBatFirst ? theirRuns : ourRuns;
  const chaseWon = chasingRuns > battingFirstRuns;

  let innings1: Innings, innings2: Innings;
  if (weBatFirst) {
    innings1 = makeInnings("You", ourRuns, false, you.battingNames, opp.bowlingNames);
    innings2 = makeInnings(opp.name, theirRuns, chaseWon, opp.battingNames, you.bowlingNames);
  } else {
    innings1 = makeInnings(opp.name, theirRuns, false, opp.battingNames, you.bowlingNames);
    innings2 = makeInnings("You", ourRuns, chaseWon, you.battingNames, opp.bowlingNames);
  }

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

  return {
    stage, win, ourRuns, theirRuns, line,
    oppStrength: Math.round(opp.strength), prob,
    tossYouWon, decision, oppName: opp.name, oppColour: opp.colour, oppCode: opp.code, highlight,
    innings1, innings2,
  };
}

interface StandingRow extends GroupStanding {
  entry: TeamEntry;
}

function initStanding(entry: TeamEntry): StandingRow {
  return { entry, name: entry.name, colour: entry.colour, isYou: entry.isYou, played: 0, won: 0, lost: 0, runsFor: 0, runsAgainst: 0, points: 0 };
}

function applyResult(row: StandingRow, won: boolean, runsFor: number, runsAgainst: number) {
  row.played++;
  row.runsFor += runsFor;
  row.runsAgainst += runsAgainst;
  if (won) { row.won++; row.points += 2; } else { row.lost++; }
}

function rankStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (b.runsFor - b.runsAgainst) - (a.runsFor - a.runsAgainst);
  });
}

/**
 * Full round-robin within a group. Every match involving "You" is fully
 * simulated with a real scorecard and appended to `yourMatches` in stage
 * order; every AI-vs-AI match only updates the standings table. Every match,
 * detailed or lite, also feeds the tournament-wide leaderboard.
 */
function playGroup(
  teams: TeamEntry[],
  style: Style,
  yourMatches: MatchResult[],
  stageNames: string[],
  runsMap: Map<string, LeaderboardRow>,
  wktsMap: Map<string, LeaderboardRow>
): StandingRow[] {
  const rows = new Map<TeamEntry, StandingRow>(teams.map((t) => [t, initStanding(t)]));
  let yourMatchIdx = 0;

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i], b = teams[j];
      if (a.isYou || b.isYou) {
        const you = a.isYou ? a : b;
        const opp = a.isYou ? b : a;
        const stage = stageNames[yourMatchIdx++];
        const m = simulateDetailed(you, opp, style, stage);
        yourMatches.push(m);
        applyResult(rows.get(you)!, m.win, m.ourRuns, m.theirRuns);
        applyResult(rows.get(opp)!, !m.win, m.theirRuns, m.ourRuns);
        tally(runsMap, wktsMap, you, m.ourRuns);
        tally(runsMap, wktsMap, opp, m.theirRuns);
      } else {
        const { aWin, runsA, runsB } = simulateLite(a, b);
        applyResult(rows.get(a)!, aWin, runsA, runsB);
        applyResult(rows.get(b)!, !aWin, runsB, runsA);
        tally(runsMap, wktsMap, a, runsA);
        tally(runsMap, wktsMap, b, runsB);
      }
    }
  }

  return rankStandings([...rows.values()]);
}

function roundLabelFor(nTeams: number): string {
  if (nTeams === 16) return "Round of 16";
  if (nTeams === 8) return "Quarter-Final";
  if (nTeams === 4) return "Semi-Final";
  if (nTeams === 2) return "Final";
  return `Round of ${nTeams}`;
}

/**
 * Single-elimination bracket over any seed list -- pairs adjacent teams each
 * round, halving until one champion remains. Any match involving "You" gets
 * a full scorecard appended to `yourMatches`; every other match (including
 * the rest of the bracket after you're eliminated, or before you even reach
 * it) still simulates and feeds the leaderboard, so the whole tournament
 * resolves consistently regardless of how far you got.
 */
function runKnockoutBracket(
  seeds: TeamEntry[],
  style: Style,
  yourMatches: MatchResult[],
  runsMap: Map<string, LeaderboardRow>,
  wktsMap: Map<string, LeaderboardRow>
): TeamEntry {
  let round = seeds;
  while (round.length > 1) {
    const label = roundLabelFor(round.length);
    const winners: TeamEntry[] = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i], b = round[i + 1];
      if (a.isYou || b.isYou) {
        const you = a.isYou ? a : b;
        const opp = a.isYou ? b : a;
        const m = simulateDetailed(you, opp, style, label);
        yourMatches.push(m);
        tally(runsMap, wktsMap, you, m.ourRuns);
        tally(runsMap, wktsMap, opp, m.theirRuns);
        winners.push(m.win ? you : opp);
      } else {
        const { aWin, runsA, runsB } = simulateLite(a, b);
        tally(runsMap, wktsMap, a, runsA);
        tally(runsMap, wktsMap, b, runsB);
        winners.push(aWin ? a : b);
      }
    }
    round = winners;
  }
  return round[0];
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
  const teamStrength = 0.4 * effBat + 0.4 * Math.max(20, effBowl) + 0.2 * r.balance;

  const you = youEntry(players, teamStrength);

  // Group 0 is yours (you + 3 opponents); 7 more groups of 4 fill out the
  // rest of the 32-team World Cup, all drawn with the same difficulty
  // weighting so the whole field -- not just your group -- matches the
  // chosen difficulty.
  const usedIds = new Set(ownedSquadIds);
  const group0Squads = drawSquadPool(TEAM_PER_GROUP - 1, allSquads, usedIds, diff.opp, diff.spread);
  group0Squads.forEach((sq) => usedIds.add(sq.id));
  const groups: TeamEntry[][] = [[you, ...group0Squads.map(squadEntry)]];

  for (let g = 1; g < GROUPS_TOTAL; g++) {
    const squads = drawSquadPool(TEAM_PER_GROUP, allSquads, usedIds, diff.opp, diff.spread);
    squads.forEach((sq) => usedIds.add(sq.id));
    groups.push(squads.map(squadEntry));
  }

  const runsMap = new Map<string, LeaderboardRow>();
  const wktsMap = new Map<string, LeaderboardRow>();
  const groupStageNames = STAGES.slice(0, TEAM_PER_GROUP - 1); // "Group Match 1".."Group Match 3"

  const results: MatchResult[] = [];
  const standingsPerGroup = groups.map((g, gi) =>
    playGroup(g, style, gi === 0 ? results : [], groupStageNames, runsMap, wktsMap)
  );

  const yourStandings = standingsPerGroup[0];
  const yourRow = yourStandings.find((row) => row.isYou)!;
  const groupRank = yourStandings.indexOf(yourRow) + 1;
  const groupStandings: GroupStanding[] = yourStandings.map(({ entry: _e, ...rest }) => rest);

  let won = yourRow.won;
  const qualified = groupRank <= 2;
  let reachedFinal = false;
  let champion = false;
  let stageReached: StageReached = "Group Stage";

  if (qualified) {
    // Standard crossover Round of 16 draw: group winners face a runner-up
    // from a different group, e.g. 1A v 2B, 1C v 2D, ... 1B v 2A, 1D v 2C...
    const winners = standingsPerGroup.map((st) => st[0].entry);
    const runnersUp = standingsPerGroup.map((st) => st[1].entry);
    const crossPairs: [number, number][] = [[0, 1], [2, 3], [4, 5], [6, 7]];
    const seeds: TeamEntry[] = [];
    for (const [x, y] of crossPairs) seeds.push(winners[x], runnersUp[y]);
    for (const [x, y] of crossPairs) seeds.push(winners[y], runnersUp[x]);

    const champEntry = runKnockoutBracket(seeds, style, results, runsMap, wktsMap);
    champion = champEntry === you;

    const knockoutResults = results.slice(TEAM_PER_GROUP - 1);
    won += knockoutResults.filter((m) => m.win).length;
    if (knockoutResults.length) {
      const last = knockoutResults[knockoutResults.length - 1];
      reachedFinal = knockoutResults.some((m) => m.stage === "Final");
      stageReached = champion ? "Champions" : (last.stage as StageReached);
    }
  }

  const topRuns = [...runsMap.values()].sort((a, b) => b.value - a.value).slice(0, 10);
  const topWickets = [...wktsMap.values()].sort((a, b) => b.value - a.value).slice(0, 10);

  return {
    results,
    meta: {
      teamStrength, r, effBat, effBowl, won, played: results.length,
      groupStandings, groupRank, qualified, reachedFinal, champion, stageReached,
      topRuns, topWickets,
    },
  };
}

export function tossText(m: MatchResult): string {
  const who = m.tossYouWon ? "You" : m.oppName;
  return `${who} won the toss and chose to ${m.decision} first.`;
}
