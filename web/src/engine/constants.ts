import type { Mode, Difficulty, Style, Role, PositionSlotDef } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  BAT: "Batter",
  WK: "Keeper",
  ALL: "All-rounder",
  BOWL: "Bowler",
};

export const MAX_SWITCHES_PER_PICK = 3;

/** Flag emoji per country code, for the squad card in the draft market.
 *  WI and EAF are historical multi-nation composite sides with no single
 *  national flag, so they get a cricket-themed placeholder instead. */
export const FLAGS: Record<string, string> = {
  IND: "🇮🇳", AUS: "🇦🇺", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", PAK: "🇵🇰",
  WI: "🏏", SL: "🇱🇰", NZ: "🇳🇿", SA: "🇿🇦",
  ZIM: "🇿🇼", BAN: "🇧🇩", AFG: "🇦🇫", KEN: "🇰🇪",
  NED: "🇳🇱", IRE: "🇮🇪", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", CAN: "🇨🇦",
  NAM: "🇳🇦", UAE: "🇦🇪", BER: "🇧🇲", EAF: "🌍",
};

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

/** `opp` is the target overall strength (0-100) real historical squads are
 *  weighted toward when the tournament draws your group and knockout
 *  opponents; `spread` is how tightly that pool is held to the target (a
 *  smaller spread means a more consistently strong/weak field). */
export const DIFFICULTIES: Difficulty[] = [
  { id: "easy", name: "Warm-up", opp: 58, spread: 14, desc: "Weaker historical squads fill the World Cup. A gentle path to 7–0." },
  { id: "normal", name: "Contender", opp: 72, spread: 11, desc: "A realistic field of real World Cup squads. The intended challenge." },
  { id: "brutal", name: "Dynasty", opp: 85, spread: 8, desc: "Champion-calibre historical squads everywhere. Only the very best XI survives." },
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
