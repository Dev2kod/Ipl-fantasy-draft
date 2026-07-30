import type { Formation, Mode, Difficulty, Style, Role, DraftModeOption, PositionSlotDef } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  BAT: "Batter",
  WK: "Keeper",
  ALL: "All-rounder",
  BOWL: "Bowler",
};

export const MAX_OVERSEAS = 4;
export const MAX_SWITCHES_PER_PICK = 3;
export const AUCTION_PURSE = 100; // crores

export const DRAFT_MODES: DraftModeOption[] = [
  {
    id: "free", name: "Free Draft",
    desc: "No budget, no position restrictions. Pick any player who fits an open role.",
  },
  {
    id: "auction", name: "Auction Purse",
    desc: `A ₹${AUCTION_PURSE}cr purse for the whole XI. Every player has a price — spend wisely.`,
  },
  {
    id: "positions", name: "Real Positions",
    desc: "Fill 11 specific real-life roles (opener, finisher, death bowler...). A player only fits the job(s) they'd actually do.",
  },
];

/** The fixed XI shape for Real Positions mode — one slot per real cricketing job. */
export const POSITION_FORMATION: PositionSlotDef[] = [
  { position: "Opener", role: "BAT" },
  { position: "Opener", role: "BAT" },
  { position: "Top-order", role: "BAT" },
  { position: "Middle-order", role: "BAT" },
  { position: "Finisher", role: "BAT" },
  { position: "Wicketkeeper", role: "WK" },
  { position: "Batting All-rounder", role: "ALL" },
  { position: "Bowling All-rounder", role: "ALL" },
  { position: "Powerplay Bowler", role: "BOWL" },
  { position: "Middle-overs Bowler", role: "BOWL" },
  { position: "Death Bowler", role: "BOWL" },
];

export const FORMATIONS: Formation[] = [
  {
    id: "balanced", name: "Balanced XI", shape: "4 BAT · 1 WK · 2 ALL · 4 BOWL",
    need: { BAT: 4, WK: 1, ALL: 2, BOWL: 4 },
    desc: "The classic template. Solid batting, two all-rounders for depth, four frontline bowlers.",
  },
  {
    id: "batbeast", name: "Batting Beast", shape: "5 BAT · 1 WK · 1 ALL · 4 BOWL",
    need: { BAT: 5, WK: 1, ALL: 1, BOWL: 4 },
    desc: "Stack the top order and bat deep. Thin bowling — you'd better post huge totals.",
  },
  {
    id: "allarmy", name: "All-Rounder Army", shape: "3 BAT · 1 WK · 3 ALL · 4 BOWL",
    need: { BAT: 3, WK: 1, ALL: 3, BOWL: 4 },
    desc: "Flexibility everywhere. Great balance, but you need genuine all-rounders to appear.",
  },
  {
    id: "fortress", name: "Bowling Fortress", shape: "3 BAT · 1 WK · 2 ALL · 5 BOWL",
    need: { BAT: 3, WK: 1, ALL: 2, BOWL: 5 },
    desc: "Strangle every chase. Five specialist bowlers; you'll defend more than you attack.",
  },
];

export const MODES: Mode[] = [
  { id: "classic", name: "Classic", desc: "FIFA-style ratings shown on every card. Draft with full information." },
  { id: "almanac", name: "Almanac", desc: "Ratings hidden — a pure memory test. Do you remember who was elite that season?" },
];

export const DIFFICULTIES: Difficulty[] = [
  { id: "easy", name: "Warm-up", opp: 62, spread: 2.8, desc: "Kinder opponents. A gentle path to 7–0." },
  { id: "normal", name: "Contender", opp: 71, spread: 3.25, desc: "A realistic gauntlet. The intended challenge." },
  { id: "brutal", name: "Dynasty", opp: 80, spread: 3.6, desc: "Every rival is stacked. Only the very best XI survives." },
];

export const STYLES: Style[] = [
  { id: "aggressive", name: "Aggressive", desc: "Bat first, go hard. Rewards batting power; risky if you misfire.", bat: 1.18, bowl: 0.92, variance: 1.25 },
  { id: "balanced", name: "Balanced", desc: "Read the game. No bias, steadiest odds across the run.", bat: 1.0, bowl: 1.0, variance: 1.0 },
  { id: "defensive", name: "Defensive", desc: "Squeeze with the ball, chase small. Rewards a deep attack.", bat: 0.9, bowl: 1.2, variance: 0.82 },
];

export const STAGES = [
  "League Match 1", "League Match 2", "League Match 3", "League Match 4",
  "Eliminator", "Qualifier", "FINAL",
];
