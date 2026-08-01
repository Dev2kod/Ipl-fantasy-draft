import type { Player } from "./types";

export interface TeamRatings {
  batting: number;
  bowling: number;
  balance: number;
  overall: number;
  bowlOptions: number;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Turn an XI (or any player roster, e.g. a whole drafted squad) into strength
 *  numbers (0-100-ish). Used live, in the sim for your XI, and to rate every
 *  AI opponent squad from its own real player ratings. */
export function teamRatings(players: Player[]): TeamRatings {
  if (players.length === 0) return { batting: 0, bowling: 0, balance: 0, overall: 0, bowlOptions: 0 };

  // Batting: best 7 batting contributions, top order weighted more.
  const batScores = players.map((p) => p.bat).sort((a, b) => b - a).slice(0, 7);
  const batW = [1.4, 1.3, 1.2, 1.1, 1.0, 0.8, 0.6];
  let bnum = 0, bden = 0;
  batScores.forEach((v, i) => { bnum += v * batW[i]; bden += batW[i]; });
  const batting = bnum / bden;

  // Bowling: need 5 who can bowl 4 overs (bowl >= 55). Best 5 bowling scores.
  const bowlers = players.filter((p) => p.bowl >= 55).map((p) => p.bowl).sort((a, b) => b - a);
  const bowlOptions = bowlers.length;
  const best5 = bowlers.slice(0, 5);
  const avgBowl = best5.length ? best5.reduce((a, b) => a + b, 0) / best5.length : 30;
  let bowling = avgBowl;
  if (bowlOptions < 5) bowling -= (5 - bowlOptions) * 7;

  // Balance: reward all-rounders, keeper, and having enough bowling options.
  const nAll = players.filter((p) => p.role === "ALL").length;
  const nWk = players.filter((p) => p.role === "WK").length;
  let balance = 60 + nAll * 8 + (nWk >= 1 ? 8 : -10) + (bowlOptions >= 5 ? 10 : -12);
  balance = Math.max(20, Math.min(100, balance));

  const overall = 0.4 * batting + 0.4 * Math.max(20, bowling) + 0.2 * balance;
  return {
    batting: clamp(batting),
    bowling: clamp(Math.max(20, bowling)),
    balance: clamp(balance),
    overall: clamp(overall),
    bowlOptions,
  };
}
