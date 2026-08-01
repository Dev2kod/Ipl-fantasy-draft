export type Role = "BAT" | "WK" | "ALL" | "BOWL";
export type Award = "golden_bat" | "golden_ball" | null;

/** Real-life-plausible job tags a player can fill in the XI. A player can carry
 *  more than one (e.g. a flexible batter tagged both Opener and Middle-order),
 *  and a slot only accepts a player who has that exact tag. */
export type Position = "Opener" | "Middle-order" | "Wicketkeeper" | "Bowler";

export interface Player {
  name: string;
  role: Role;
  sub_role: string;
  bat: number;
  bowl: number;
  overall: number;
  captain: boolean;
  award: Award;
  positions: Position[];
}

export interface Squad {
  id: number;
  country: string;
  country_name: string;
  colour: string;
  edition: number;
  host: string;
  finish: number | null;
  champion: boolean;
  runner_up: boolean;
  players: Player[];
}

export interface EditionMeta {
  host: string;
  champion: string | null;
  runner_up: string | null;
  golden_bat: { player: string; team: string } | null;
  golden_ball: { player: string; team: string } | null;
}

export interface Country {
  code: string;
  name: string;
  colour: string;
}

export interface GameData {
  countries: Record<string, Country>;
  editions: Record<string, EditionMeta>;
  squads: Squad[];
}

/** A player signed to the XI, tagged with where they were drafted from. */
export interface SignedPlayer extends Player {
  _src: string; // e.g. "India 1983"
  _srcSquadId: number;
}

export interface Slot {
  role: Role;
  position: Position;
  player: SignedPlayer | null;
}

/** One slot of the fixed XI: a specific real-life job, with the Role it
 *  counts as for team-rating purposes. */
export interface PositionSlotDef {
  position: Position;
  role: Role;
}

export interface Mode {
  id: "classic" | "almanac";
  name: string;
  desc: string;
}

export interface Difficulty {
  id: "easy" | "normal" | "brutal";
  name: string;
  opp: number;
  spread: number;
  desc: string;
}

export interface Style {
  id: "aggressive" | "balanced" | "defensive";
  name: string;
  desc: string;
  bat: number;
  bowl: number;
  variance: number;
}
