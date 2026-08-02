import type { Mode, Difficulty, Style, Role, PositionSlotDef } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  BAT: "Batter",
  WK: "Keeper",
  ALL: "All-rounder",
  BOWL: "Bowler",
};

export const MAX_SWITCHES_PER_PICK = 3;


/** The one fixed XI shape the whole game uses: 2 Openers, 4 Middle-order,
 *  1 Wicketkeeper, 4 Bowlers. A slot only accepts a player tagged for that
 *  exact real-life job. */
export const POSITION_FORMATION: PositionSlotDef[] = [
  { position: "Opener", role: "BAT" },
  { position: "Opener", role: "BAT" },
  { position: "Middle-order", role: "BAT" },
  { position: "Middle-order", role: "BAT" },
  { position: "Middle-order", role: "BAT" },
  { position: "Middle-order", role: "BAT" },
  { position: "Wicketkeeper", role: "WK" },
  { position: "Bowler", role: "BOWL" },
  { position: "Bowler", role: "BOWL" },
  { position: "Bowler", role: "BOWL" },
  { position: "Bowler", role: "BOWL" },
];

export const MODES: Mode[] = [
  { id: "classic", name: "Classic", desc: "Player ratings shown on every card. Draft with full information." },
  { id: "almanac", name: "Almanac", desc: "Ratings hidden — a pure memory test. Do you remember who was elite that World Cup?" },
];

/**
 * `opp` is the target overall strength (0-100) real historical squads are
 * weighted toward when the tournament draws the whole 32-team field;
 * `spread` is how tightly the pool is held to that target (a smaller spread
 * means a more consistently strong/weak field).
 *
 * For scale, the 143 real squads span roughly 59-89 with a median near 81,
 * so 70 sits around the weakest tenth, 80 lands on the median, and 90 is
 * just past the strongest squad in the dataset -- meaning Dynasty always
 * reaches for the very top of the era. The spreads tighten as difficulty
 * rises so the three tiers stay clearly distinguishable instead of all
 * blurring toward the median.
 */
export const DIFFICULTIES: Difficulty[] = [
  { id: "easy", name: "Warm-up", opp: 70, spread: 7, desc: "Weaker historical squads fill the World Cup. A gentle path to 7–0." },
  { id: "normal", name: "Contender", opp: 80, spread: 6, desc: "A realistic field of real World Cup squads. The intended challenge." },
  { id: "brutal", name: "Dynasty", opp: 90, spread: 5, desc: "Champion-calibre historical squads everywhere. Only the very best XI survives." },
];

export const STYLES: Style[] = [
  { id: "aggressive", name: "Aggressive", desc: "Bat first, go hard. Rewards batting power; risky if you misfire.", bat: 1.18, bowl: 0.92, variance: 1.25 },
  { id: "balanced", name: "Balanced", desc: "Read the game. No bias, steadiest odds across the run.", bat: 1.0, bowl: 1.0, variance: 1.0 },
  { id: "defensive", name: "Defensive", desc: "Squeeze with the ball, chase small. Rewards a deep attack.", bat: 0.9, bowl: 1.2, variance: 0.82 },
];

/** 8 groups of 4 (32 teams): 3 group matches, then Round of 16, Quarter-Final,
 *  Semi-Final, Final if you finish top 2 -- 7 matches for a perfect run. */
export const STAGES = [
  "Group Match 1", "Group Match 2", "Group Match 3",
  "Round of 16", "Quarter-Final", "Semi-Final", "Final",
];
