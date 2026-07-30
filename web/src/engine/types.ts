export type Role = "BAT" | "WK" | "ALL" | "BOWL";
export type Cap = "orange" | "purple" | null;

/** Real-life-plausible job tags a player can fill in the XI. A player can carry
 *  more than one (e.g. an opener who also bats top-order), and in Positions
 *  mode a slot only accepts a player who has that exact tag. */
export type Position =
  | "Opener" | "Top-order" | "Middle-order" | "Finisher"
  | "Wicketkeeper"
  | "Batting All-rounder" | "Bowling All-rounder"
  | "Powerplay Bowler" | "Middle-overs Bowler" | "Death Bowler";

export interface Player {
  name: string;
  role: Role;
  sub_role: string;
  bat: number;
  bowl: number;
  overall: number;
  overseas: boolean;
  captain: boolean;
  cap: Cap;
  positions: Position[];
  price: number; // auction price in crores
}

export interface Squad {
  id: number;
  franchise: string;
  franchise_name: string;
  colour: string;
  season: number;
  finish: number | null;
  champion: boolean;
  runner_up: boolean;
  players: Player[];
}

export interface SeasonMeta {
  champion: string | null;
  runner_up: string | null;
  orange_cap: { player: string; team: string } | null;
  purple_cap: { player: string; team: string } | null;
}

export interface Franchise {
  code: string;
  name: string;
  colour: string;
}

export interface GameData {
  franchises: Record<string, Franchise>;
  seasons: Record<string, SeasonMeta>;
  squads: Squad[];
}

/** A player signed to the XI, tagged with where they were drafted from. */
export interface SignedPlayer extends Player {
  _src: string; // e.g. "CSK 2011"
  _srcSquadId: number;
}

export interface Slot {
  role: Role;
  position: Position | null; // set only in "positions" draft mode
  player: SignedPlayer | null;
}

export interface Formation {
  id: string;
  name: string;
  shape: string;
  need: Partial<Record<Role, number>>;
  desc: string;
}

/** One slot of the fixed Positions-mode XI: a specific real-life job, with the
 *  Role it counts as for team-rating purposes. */
export interface PositionSlotDef {
  position: Position;
  role: Role;
}

export type DraftMode = "free" | "auction" | "positions";

export interface DraftModeOption {
  id: DraftMode;
  name: string;
  desc: string;
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
