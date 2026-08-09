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
  code: string;
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
  teamCode: string;
  value: number;
}

/** A team reference for bracket display -- enough to render a badge/flag. */
export interface BracketTeamRef {
  name: string;
  colour: string;
  code: string;
  isYou: boolean;
}

/** One knockout match anywhere in the 32-team bracket -- yours or not. Every
 *  match in every round is simulated and recorded, so the whole bracket can
 *  be visualized (Round of 16 through Final), not just your own path. */
export interface BracketMatch {
  round: string;
  teamA: BracketTeamRef;
  teamB: BracketTeamRef;
  scoreA: number;
  scoreB: number;
  winnerIsA: boolean;
}

export interface SimMeta {
  teamStrength: number;
  r: ReturnType<typeof teamRatings>;
  effBat: number;
  effBowl: number;
  won: number;
  played: number;
  groupStandings: GroupStanding[];
  allGroupStandings: GroupStanding[][];
  groupRank: number;
  qualified: boolean;
  reachedFinal: boolean;
  champion: boolean;
  stageReached: StageReached;
  topRuns: LeaderboardRow[];
  topWickets: LeaderboardRow[];
  bracket: BracketMatch[][]; // bracket[0] = Round of 16 (8 matches) .. bracket[3] = Final (1 match); empty if not qualified
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

/** Split a total exactly across N shares, weighted, with every share at
 *  least `min` -- used so individual batter/bowler figures always sum back
 *  to the innings' real total instead of drifting from independent rounding. */
function splitExactly(weights: number[], total: number, min: number): number[] {
  const wSum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => Math.max(min, Math.round((w / wSum) * total)));
  let diff = total - parts.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 10000) {
    guard++;
    const step = diff > 0 ? 1 : -1;
    const idx = guard % parts.length;
    if (parts[idx] + step >= min) { parts[idx] += step; diff -= step; }
  }
  return parts;
}

function makeBatters(names: string[], runs: number, wicketsDown: number, totalBalls: number): BatterLine[] {
  const battersShown = Math.min(names.length, wicketsDown + (wicketsDown >= 10 ? 1 : 2));
  const outCount = Math.min(wicketsDown, battersShown);

  // Top order gets more of a *chance* at a big score (real batting-order
  // structure), but it's a soft bias, not a guarantee -- a wide per-batter
  // luck multiplier means any position can have the standout day, so the
  // opener isn't mechanically forced to be the innings' top scorer.
  const weights = Array.from({ length: battersShown }, (_, i) => {
    const positionBias = 1 / (1 + i * 0.22);
    const luck = 0.3 + Math.random() ** 1.6 * 2.4;
    return positionBias * luck;
  });
  const runShares = splitExactly(weights, runs, 0);

  // Every ball actually faced by this innings' batters must sum to exactly
  // totalBalls (the same figure the bowling card's overs are built from) --
  // weighted loosely by runs (a realistic strike-rate feel) but reconciled
  // to the real total instead of each batter's balls being fabricated alone.
  const ballShares = splitExactly(runShares.map((r) => r + 10 + Math.random() * 12), totalBalls, 1);

  return names.slice(0, battersShown).map((name, i) => ({
    name, runs: runShares[i] ?? 0, balls: ballShares[i] ?? 1, out: i < outCount,
  }));
}

function makeBowlers(names: string[], wicketsTaken: number, totalBalls: number, runsConceded: number): BowlerLine[] {
  const nBowl = Math.max(5, Math.min(names.length, 7));
  const usableNames = names.length >= nBowl ? names.slice(0, nBowl) : [...names, ...names.slice(0, nBowl - names.length)];
  const ballAlloc = distributeBalls(totalBalls, nBowl);

  const bowledIdx = ballAlloc.map((b, i) => ({ b, i })).filter((x) => x.b > 0);

  // Each bowler's overs are near-equal by design (the round-robin above), so
  // splitting wickets/runs proportionally to overs bowled just hands
  // everyone ~1 wicket in sequence -- no "strike bowler" spells. Instead,
  // give each bowler a fixed per-innings form factor (skewed so most days
  // are modest but a few are a standout spell) and run each wicket as its
  // own weighted lottery against that form -- realistic clumping instead of
  // a flat split, while still summing to exactly what actually fell.
  const form = bowledIdx.map(() => 0.35 + Math.random() ** 1.8 * 3);
  const wicketCounts = new Array(bowledIdx.length).fill(0);
  for (let w = 0; w < wicketsTaken; w++) {
    const k = weightedPick(bowledIdx.map((_, idx) => idx), (idx) => bowledIdx[idx].b * form[idx]);
    wicketCounts[k]++;
  }

  const runWeights = bowledIdx.map(({ b }, k) => b * (0.5 + Math.random() * 1.1) * (1 + wicketCounts[k] * 0.15));
  const runShares = splitExactly(runWeights, runsConceded, 0);

  return bowledIdx.map(({ b, i }, k) => ({
    name: usableNames[i], overs: ballsToOvers(b), runsConceded: runShares[k], wickets: wicketCounts[k],
  }));
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
  const batters = makeBatters(battingNames, runs, wickets, totalBalls);
  const bowlers = makeBowlers(bowlingNames, wickets, totalBalls, runs);
  return { team: battingTeam, runs, wickets, overs, batters, bowlers };
}

/** The actual highest scorer in an innings -- always read off the real
 *  batting card, never fabricated separately, so the highlight text and any
 *  leaderboard tally can never disagree with the scorecard shown on screen. */
function topBatterOf(innings: Innings): BatterLine | null {
  if (!innings.batters.length) return null;
  return innings.batters.reduce((best, b) => (b.runs > best.runs ? b : best), innings.batters[0]);
}

/** The actual best bowling figures in an innings -- most wickets, tie-broken
 *  by fewest runs conceded -- read off the real bowling card. */
function topBowlerOf(innings: Innings): BowlerLine | null {
  if (!innings.bowlers.length) return null;
  return innings.bowlers.reduce(
    (best, b) => (b.wickets > best.wickets || (b.wickets === best.wickets && b.runsConceded < best.runsConceded) ? b : best),
    innings.bowlers[0]
  );
}

/** A one-line highlight built strictly from the real scorecard just
 *  generated -- a strong bowling spell (3+ wickets) takes priority,
 *  otherwise the top score, so the text on screen always matches the
 *  full scorecard exactly. */
function highlightFrom(topBat: BatterLine | null, topBowl: BowlerLine | null): string | null {
  if (topBowl && topBowl.wickets >= 3) return `${topBowl.name} picked up ${topBowl.wickets}/${topBowl.runsConceded}.`;
  if (topBat) return `${topBat.name} top-scored with ${topBat.runs} off ${topBat.balls} balls.`;
  if (topBowl) return `${topBowl.name} picked up ${topBowl.wickets}/${topBowl.runsConceded}.`;
  return null;
}

function battingOrderOf(players: Player[]): string[] {
  return [...players].sort((a, b) => b.bat - a.bat).map((p) => p.name);
}
function bowlingOrderOf(players: Player[]): string[] {
  const bowlers = players.filter((p) => p.bowl >= 45).sort((a, b) => b.bowl - a.bowl);
  const pool = bowlers.length >= 5 ? bowlers : [...players].sort((a, b) => b.bowl - a.bowl);
  return pool.map((p) => p.name);
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
}

function youEntry(players: SignedPlayer[], strength: number): TeamEntry {
  return {
    name: "You", colour: "#ff7a1a", code: "", isYou: true, strength,
    battingNames: battingOrderOf(players), bowlingNames: bowlingOrderOf(players),
  };
}

function squadEntry(squad: Squad): TeamEntry {
  return {
    name: `${squad.country_name} ${squad.edition}`, colour: squad.colour, code: squad.country, isYou: false,
    strength: teamRatings(squad.players).overall,
    battingNames: battingOrderOf(squad.players), bowlingNames: bowlingOrderOf(squad.players),
  };
}

/** Builds both innings of a completed match given who batted first/second
 *  and each side's already-decided final score -- shared by "your" detailed
 *  matches and the full tournament-wide leaderboard tally below. */
function buildMatchInnings(
  firstName: string, firstBatNames: string[], firstBowlNames: string[], firstRuns: number,
  secondName: string, secondBatNames: string[], secondBowlNames: string[], secondRuns: number
): { innings1: Innings; innings2: Innings } {
  const chaseWon = secondRuns > firstRuns;
  const innings1 = makeInnings(firstName, firstRuns, false, firstBatNames, secondBowlNames);
  const innings2 = makeInnings(secondName, secondRuns, chaseWon, secondBatNames, firstBowlNames);
  return { innings1, innings2 };
}

/** Adds every batter's runs and every bowler's wickets from both innings of
 *  a completed match into the tournament-wide leaderboard maps -- a true
 *  aggregate across every player who actually played, not one fabricated
 *  standout per side. Used for every match in the whole 32-team field, so
 *  Most Runs/Most Wickets reflects the entire tournament the way a real
 *  World Cup's tables do, the same way a highlight or scorecard is always
 *  read off the real generated figures rather than invented separately. */
function tallyFullMatch(
  runsMap: Map<string, LeaderboardRow>,
  wktsMap: Map<string, LeaderboardRow>,
  innings1: Innings,
  innings2: Innings,
  codeOf: (teamName: string) => string
) {
  for (const inn of [innings1, innings2]) {
    const battingCode = codeOf(inn.team);
    for (const b of inn.batters) {
      const row = runsMap.get(b.name) ?? { name: b.name, team: inn.team, teamCode: battingCode, value: 0 };
      row.value += b.runs;
      row.team = inn.team;
      row.teamCode = battingCode;
      runsMap.set(b.name, row);
    }
    const bowlingTeam = inn.team === innings1.team ? innings2.team : innings1.team;
    const bowlingCode = codeOf(bowlingTeam);
    for (const bw of inn.bowlers) {
      const row = wktsMap.get(bw.name) ?? { name: bw.name, team: bowlingTeam, teamCode: bowlingCode, value: 0 };
      row.value += bw.wickets;
      row.team = bowlingTeam;
      row.teamCode = bowlingCode;
      wktsMap.set(bw.name, row);
    }
  }
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

/**
 * An AI-vs-AI result -- win/runs for standings, exactly as before, but also
 * builds a real innings pair (the toss is just a coin flip, since neither
 * side is "you") purely so every one of its batters' runs and bowlers'
 * wickets can feed the tournament-wide leaderboard. No scorecard from this
 * match is ever shown to the player, so nothing here needs to reconcile
 * with anything on screen -- but Most Runs/Most Wickets should still
 * reflect every player who actually played, not one fabricated standout
 * per side, so this generates the genuine article instead.
 */
function simulateLite(
  a: TeamEntry, b: TeamEntry,
  runsMap: Map<string, LeaderboardRow>, wktsMap: Map<string, LeaderboardRow>
): { aWin: boolean; runsA: number; runsB: number } {
  const { aWin, runsA, runsB } = playOutScore(a.strength, b.strength, 1.0);

  const aBatsFirst = Math.random() < 0.5;
  const { innings1, innings2 } = aBatsFirst
    ? buildMatchInnings(a.name, a.battingNames, a.bowlingNames, runsA, b.name, b.battingNames, b.bowlingNames, runsB)
    : buildMatchInnings(b.name, b.battingNames, b.bowlingNames, runsB, a.name, a.battingNames, a.bowlingNames, runsA);
  tallyFullMatch(runsMap, wktsMap, innings1, innings2, (name) => (name === a.name ? a.code : b.code));

  return { aWin, runsA, runsB };
}

/**
 * A toss-aware, cricket-accurate head-to-head: the team batting FIRST posts
 * an independent total; the team batting SECOND is then generated relative
 * to that target, not independently -- because in real limit-overs cricket
 * the chase ends the INSTANT the target is passed. A winning chase is always
 * just a small, realistic margin above the target (never a separately
 * fabricated score that happens to be higher), and a losing chase always
 * falls genuinely short.
 */
function playDetailedMatch(youStrength: number, oppStrength: number, variance: number) {
  const gap = youStrength - oppStrength;
  let prob = 1 / (1 + Math.exp(-gap / 7));
  prob = Math.max(0.05, Math.min(0.95, prob));
  const win = Math.random() < prob;

  const tossYouWon = Math.random() < 0.5;
  const decision: "bat" | "bowl" = Math.random() < 0.5 ? "bat" : "bowl";
  const weBatFirst = tossYouWon ? decision === "bat" : decision === "bowl";

  const batFirstStrength = weBatFirst ? youStrength : oppStrength;
  const secondBatsWins = weBatFirst ? !win : win; // does whoever bats second end up winning?

  const swing = 45 * variance;
  const battingFirstRuns = clampRuns(
    260 + Math.round((batFirstStrength - 70) * 2.3) + Math.round((Math.random() - 0.5) * 2 * swing)
  );

  let battingSecondRuns: number;
  if (secondBatsWins) {
    // The innings ends the moment the target is passed -- a small, realistic
    // margin over the target, never an independently-rolled blowout score.
    battingSecondRuns = Math.min(430, battingFirstRuns + 1 + rint(20));
  } else {
    // A failed chase falls genuinely short -- bowled out or ran out of overs.
    battingSecondRuns = Math.max(100, battingFirstRuns - (5 + rint(90)));
    if (battingSecondRuns >= battingFirstRuns) battingSecondRuns = battingFirstRuns - 1;
  }

  const ourRuns = weBatFirst ? battingFirstRuns : battingSecondRuns;
  const theirRuns = weBatFirst ? battingSecondRuns : battingFirstRuns;
  return { win, prob, tossYouWon, decision, weBatFirst, ourRuns, theirRuns };
}

/** A full match involving "You" -- toss, innings, scorecards, highlight. The
 *  highlight and leaderboard tally are always read straight off the real
 *  generated scorecard (never a separate fabrication), so what's shown under
 *  the score and what ends up in the tournament leaderboard can never
 *  disagree with the actual batting/bowling figures. */
function simulateDetailed(
  you: TeamEntry, opp: TeamEntry, style: Style, stage: string,
  runsMap: Map<string, LeaderboardRow>, wktsMap: Map<string, LeaderboardRow>
): MatchResult {
  const {
    win, prob, tossYouWon, decision, weBatFirst, ourRuns, theirRuns,
  } = playDetailedMatch(you.strength, opp.strength, style.variance);

  const { innings1, innings2 } = weBatFirst
    ? buildMatchInnings("You", you.battingNames, you.bowlingNames, ourRuns, opp.name, opp.battingNames, opp.bowlingNames, theirRuns)
    : buildMatchInnings(opp.name, opp.battingNames, opp.bowlingNames, theirRuns, "You", you.battingNames, you.bowlingNames, ourRuns);

  // innings.bowlers always belongs to whichever side did NOT bat that innings.
  const yourInnings = innings1.team === "You" ? innings1 : innings2;
  const oppInnings = innings1.team === "You" ? innings2 : innings1;
  const yourTopBat = topBatterOf(yourInnings);
  const yourTopBowl = topBowlerOf(oppInnings); // bowled while the opponent batted -- these are your bowlers

  const highlight = highlightFrom(yourTopBat, yourTopBowl);
  // The highlight line only needs your own top performer, but the
  // leaderboard tally is a full aggregate across every batter/bowler on
  // both sides -- same real scorecard, just credited to everyone in it.
  tallyFullMatch(runsMap, wktsMap, innings1, innings2, (name) => (name === "You" ? you.code : opp.code));

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
  return { entry, name: entry.name, colour: entry.colour, code: entry.code, isYou: entry.isYou, played: 0, won: 0, lost: 0, runsFor: 0, runsAgainst: 0, points: 0 };
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
        const m = simulateDetailed(you, opp, style, stage, runsMap, wktsMap);
        yourMatches.push(m);
        applyResult(rows.get(you)!, m.win, m.ourRuns, m.theirRuns);
        applyResult(rows.get(opp)!, !m.win, m.theirRuns, m.ourRuns);
      } else {
        const { aWin, runsA, runsB } = simulateLite(a, b, runsMap, wktsMap);
        applyResult(rows.get(a)!, aWin, runsA, runsB);
        applyResult(rows.get(b)!, !aWin, runsB, runsA);
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

function bracketTeamRef(e: TeamEntry): BracketTeamRef {
  return { name: e.name, colour: e.colour, code: e.code, isYou: e.isYou };
}

/**
 * Single-elimination bracket over any seed list -- pairs adjacent teams each
 * round, halving until one champion remains. Any match involving "You" gets
 * a full scorecard appended to `yourMatches`; every other match (including
 * the rest of the bracket after you're eliminated, or before you even reach
 * it) still simulates and feeds the leaderboard, so the whole tournament
 * resolves consistently regardless of how far you got. Every match at every
 * round -- not just yours -- is also recorded into `bracketRounds` so the
 * whole Round of 16 -> Final tree can be visualized.
 */
function runKnockoutBracket(
  seeds: TeamEntry[],
  style: Style,
  yourMatches: MatchResult[],
  runsMap: Map<string, LeaderboardRow>,
  wktsMap: Map<string, LeaderboardRow>
): { champion: TeamEntry; bracketRounds: BracketMatch[][] } {
  let round = seeds;
  const bracketRounds: BracketMatch[][] = [];
  while (round.length > 1) {
    const label = roundLabelFor(round.length);
    const winners: TeamEntry[] = [];
    const roundMatches: BracketMatch[] = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i], b = round[i + 1];
      if (a.isYou || b.isYou) {
        const you = a.isYou ? a : b;
        const opp = a.isYou ? b : a;
        const m = simulateDetailed(you, opp, style, label, runsMap, wktsMap);
        yourMatches.push(m);
        winners.push(m.win ? you : opp);
        roundMatches.push({
          round: label,
          teamA: bracketTeamRef(a), teamB: bracketTeamRef(b),
          scoreA: a.isYou ? m.ourRuns : m.theirRuns,
          scoreB: b.isYou ? m.ourRuns : m.theirRuns,
          winnerIsA: a.isYou ? m.win : !m.win,
        });
      } else {
        const { aWin, runsA, runsB } = simulateLite(a, b, runsMap, wktsMap);
        winners.push(aWin ? a : b);
        roundMatches.push({
          round: label, teamA: bracketTeamRef(a), teamB: bracketTeamRef(b),
          scoreA: runsA, scoreB: runsB, winnerIsA: aWin,
        });
      }
    }
    bracketRounds.push(roundMatches);
    round = winners;
  }
  return { champion: round[0], bracketRounds };
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

  // A drafted player can only ever be "You" this tournament -- excluding just
  // the exact squad-editions you drafted FROM (ownedSquadIds) isn't enough,
  // since the same real player often appears in more than one World Cup
  // squad (e.g. signing Sachin Tendulkar from India 1996 still leaves India
  // 1999 -- also Tendulkar -- free to be drawn as an opponent elsewhere).
  // The leaderboard keys by player name across the whole tournament, so
  // that reappearance would silently merge his stats there into "You"'s
  // row. Exclude every squad containing any drafted player's name, not
  // just the squads themselves, so nobody you signed can turn up twice.
  const draftedNames = new Set(players.map((p) => p.name));
  const eligibleSquads = allSquads.filter((sq) => !sq.players.some((p) => draftedNames.has(p.name)));

  // Group 0 is yours (you + 3 opponents); 7 more groups of 4 fill out the
  // rest of the 32-team World Cup, all drawn with the same difficulty
  // weighting so the whole field -- not just your group -- matches the
  // chosen difficulty.
  const usedIds = new Set(ownedSquadIds);
  const group0Squads = drawSquadPool(TEAM_PER_GROUP - 1, eligibleSquads, usedIds, diff.opp, diff.spread);
  group0Squads.forEach((sq) => usedIds.add(sq.id));
  const groups: TeamEntry[][] = [[you, ...group0Squads.map(squadEntry)]];

  for (let g = 1; g < GROUPS_TOTAL; g++) {
    const squads = drawSquadPool(TEAM_PER_GROUP, eligibleSquads, usedIds, diff.opp, diff.spread);
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
  const allGroupStandings: GroupStanding[][] = standingsPerGroup.map((st) =>
    st.map(({ entry: _e, ...rest }) => rest)
  );

  let won = yourRow.won;
  const qualified = groupRank <= 2;
  let reachedFinal = false;
  let champion = false;
  let stageReached: StageReached = "Group Stage";

  // The knockout bracket is the real 16-team field across all 8 groups, not
  // just "your" path -- it always runs, whether or not you personally
  // qualified, so the whole tournament stays visualizable (and its own
  // background matches still feed the leaderboard) regardless of how your
  // own group finished. "You" only ever appears in `seeds` if you actually
  // finished top 2 in your own group, so runKnockoutBracket naturally does
  // nothing "you"-specific when you didn't qualify.
  const winners = standingsPerGroup.map((st) => st[0].entry);
  const runnersUp = standingsPerGroup.map((st) => st[1].entry);
  const crossPairs: [number, number][] = [[0, 1], [2, 3], [4, 5], [6, 7]];
  const seeds: TeamEntry[] = [];
  for (const [x, y] of crossPairs) seeds.push(winners[x], runnersUp[y]);
  for (const [x, y] of crossPairs) seeds.push(winners[y], runnersUp[x]);

  const { champion: champEntry, bracketRounds } = runKnockoutBracket(seeds, style, results, runsMap, wktsMap);
  champion = champEntry === you;
  const bracket: BracketMatch[][] = bracketRounds;

  const knockoutResults = results.slice(TEAM_PER_GROUP - 1);
  won += knockoutResults.filter((m) => m.win).length;
  if (knockoutResults.length) {
    const last = knockoutResults[knockoutResults.length - 1];
    reachedFinal = knockoutResults.some((m) => m.stage === "Final");
    stageReached = champion ? "Champions" : (last.stage as StageReached);
  }

  const topRuns = [...runsMap.values()].sort((a, b) => b.value - a.value).slice(0, 10);
  const topWickets = [...wktsMap.values()].sort((a, b) => b.value - a.value).slice(0, 10);

  return {
    results,
    meta: {
      teamStrength, r, effBat, effBowl, won, played: results.length,
      groupStandings, allGroupStandings, groupRank, qualified, reachedFinal, champion, stageReached,
      topRuns, topWickets, bracket,
    },
  };
}

export function tossText(m: MatchResult): string {
  const who = m.tossYouWon ? "You" : m.oppName;
  return `${who} won the toss and chose to ${m.decision} first.`;
}
