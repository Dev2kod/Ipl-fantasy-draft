import { create } from "zustand";
import type {
  GameData, Squad, Slot, SignedPlayer, Mode, Difficulty, Style, Position,
} from "../engine/types";
import {
  MODES, DIFFICULTIES, STYLES, MAX_SWITCHES_PER_PICK, POSITION_FORMATION,
} from "../engine/constants";
import {
  drawRandomSquad, switchCandidates, filledCount,
  isDeadMarketPositions, eligiblePositionFor, validMoveTargets,
} from "../engine/draft";
import { simulateCupRun, GROUP_MATCHES, type MatchResult, type SimMeta } from "../engine/simulate";
import { fetchGameData } from "../engine/data";

export type Screen = "setup" | "draft" | "style" | "knockout" | "result";
export type KnockoutPhase = "preview" | "simulating" | "result";

interface GameState {
  // data
  data: GameData | null;
  dataError: string | null;

  // screen
  screen: Screen;

  // setup choices
  mode: Mode;
  difficulty: Difficulty;
  style: Style;

  // draft state
  slots: Slot[];
  switchesLeft: number;
  currentSquad: Squad | null;
  usedPlayerNames: Set<string>;
  turnExcludedSquadIds: Set<number>;
  lastMessage: string;

  // sim state
  simResults: MatchResult[];
  simMeta: SimMeta | null;
  simRevealed: number;
  simExpanded: Set<number>;
  showScorecardFor: number | null;

  // knockout match-day state
  knockoutIdx: number; // index into the knockout slice of simResults (simResults[GROUP_MATCHES + knockoutIdx])
  knockoutPhase: KnockoutPhase;

  // actions
  loadData: () => Promise<void>;
  setMode: (m: Mode) => void;
  setDifficulty: (d: Difficulty) => void;
  setStyle: (s: Style) => void;
  startDraft: () => void;
  drawNext: () => void;
  doSwitch: (kind: "team" | "edition") => void;
  draftPlayer: (playerName: string, slotKey: Position) => void;
  movePlayer: (fromIdx: number, toIdx: number) => void;
  goToStyle: () => void;
  runSimulation: () => void;
  goToKnockout: () => void;
  playKnockoutMatch: () => void;
  continueKnockout: () => void;
  goToResult: () => void;
  toggleMatchExpand: (idx: number) => void;
  openScorecard: (idx: number) => void;
  closeScorecard: () => void;
  restart: () => void;
}

function buildPositionSlots(): Slot[] {
  return POSITION_FORMATION.map((def) => ({ role: def.role, position: def.position, player: null }));
}

export const useGameStore = create<GameState>((set, get) => ({
  data: null,
  dataError: null,
  screen: "setup",

  mode: MODES[0],
  difficulty: DIFFICULTIES[1],
  style: STYLES[1],

  slots: [],
  switchesLeft: MAX_SWITCHES_PER_PICK,
  currentSquad: null,
  usedPlayerNames: new Set(),
  turnExcludedSquadIds: new Set(),
  lastMessage: "",

  simResults: [],
  simMeta: null,
  simRevealed: 0,
  simExpanded: new Set(),
  showScorecardFor: null,

  knockoutIdx: 0,
  knockoutPhase: "preview",

  loadData: async () => {
    try {
      const data = await fetchGameData();
      set({ data });
    } catch (e) {
      set({ dataError: e instanceof Error ? e.message : "Failed to load data" });
    }
  },

  setMode: (m) => set({ mode: m }),
  setDifficulty: (d) => set({ difficulty: d }),
  setStyle: (s) => set({ style: s }),

  startDraft: () => {
    const { data } = get();
    if (!data) return;
    set({
      slots: buildPositionSlots(),
      switchesLeft: MAX_SWITCHES_PER_PICK,
      currentSquad: null,
      usedPlayerNames: new Set(),
      turnExcludedSquadIds: new Set(),
      screen: "draft",
      lastMessage: "",
    });
    get().drawNext();
  },

  drawNext: () => {
    const { data, turnExcludedSquadIds, slots } = get();
    if (!data || filledCount(slots) === 11) return;
    const sq = drawRandomSquad(data.squads, turnExcludedSquadIds);
    if (!sq) { set({ lastMessage: "No more squads available." }); return; }
    set({ currentSquad: sq });
  },

  doSwitch: (kind) => {
    const { switchesLeft, currentSquad, data, turnExcludedSquadIds } = get();
    if (switchesLeft <= 0 || !currentSquad || !data) return;
    const cands = switchCandidates(data.squads, currentSquad, kind, turnExcludedSquadIds);
    if (!cands.length) return;
    const nextExcluded = new Set(turnExcludedSquadIds);
    nextExcluded.add(currentSquad.id);
    const next = cands[Math.floor(Math.random() * cands.length)];
    const left = switchesLeft - 1;
    const kindMsg = kind === "team" ? "another team, same World Cup" : "same team, another World Cup";
    set({
      switchesLeft: left,
      turnExcludedSquadIds: nextExcluded,
      currentSquad: next,
      lastMessage: `Switched to ${kindMsg}. ${left} switch${left === 1 ? "" : "es"} left.`,
    });
  },

  draftPlayer: (playerName, slotKey) => {
    const { currentSquad, slots, usedPlayerNames } = get();
    if (!currentSquad) return;
    const player = currentSquad.players.find((p) => p.name === playerName);
    if (!player) return;
    const slotIdx = slots.findIndex((s) => !s.player && s.position === slotKey);
    if (slotIdx === -1) return;
    const signed: SignedPlayer = { ...player, _src: `${currentSquad.country_name} ${currentSquad.edition}`, _srcSquadId: currentSquad.id };
    const newSlots = slots.map((s, i) => (i === slotIdx ? { ...s, player: signed } : s));
    const newUsed = new Set(usedPlayerNames);
    newUsed.add(player.name);
    set({
      slots: newSlots,
      usedPlayerNames: newUsed,
      switchesLeft: MAX_SWITCHES_PER_PICK,
      turnExcludedSquadIds: new Set(),
      currentSquad: null,
      lastMessage: `✓ Signed ${player.name} (${currentSquad.country_name} ${currentSquad.edition}).`,
    });
    if (filledCount(newSlots) < 11) {
      setTimeout(() => get().drawNext(), 220);
    }
  },

  /** Move (or swap with) another slot -- lets the XI stay editable after the
   *  initial pick, as long as everyone involved still fits where they land. */
  movePlayer: (fromIdx, toIdx) => {
    const { slots } = get();
    if (!validMoveTargets(fromIdx, slots).includes(toIdx)) return;
    const from = slots[fromIdx];
    const to = slots[toIdx];
    const newSlots = slots.map((s, i) => {
      if (i === fromIdx) return { ...s, player: to.player };
      if (i === toIdx) return { ...s, player: from.player };
      return s;
    });
    set({ slots: newSlots });
  },

  goToStyle: () => set({ screen: "style" }),

  runSimulation: () => {
    const { slots, difficulty, style, data } = get();
    const players = slots.map((s) => s.player).filter((p): p is SignedPlayer => p !== null);
    const ownedSquadIds = new Set(players.map((p) => p._srcSquadId));
    const { results, meta } = simulateCupRun(players, difficulty, style, data?.squads ?? [], ownedSquadIds);
    set({
      simResults: results,
      simMeta: meta,
      simRevealed: results.length, // every played match renders immediately
      simExpanded: new Set(),
    });
  },

  goToKnockout: () => set({ screen: "knockout", knockoutIdx: 0, knockoutPhase: "preview" }),

  /** Kick off the currently-previewed knockout match: a brief "simulating"
   *  animation, then the result reveals -- one match at a time, FIFA-style. */
  playKnockoutMatch: () => {
    set({ knockoutPhase: "simulating" });
    setTimeout(() => set({ knockoutPhase: "result" }), 1600);
  },

  /** Move on from the just-revealed knockout result: to the next match's
   *  preview if there is one, otherwise to the final Result screen. */
  continueKnockout: () => {
    const { knockoutIdx, simResults } = get();
    const nextGlobalIdx = GROUP_MATCHES + knockoutIdx + 1;
    if (nextGlobalIdx < simResults.length) {
      set({ knockoutIdx: knockoutIdx + 1, knockoutPhase: "preview" });
    } else {
      set({ screen: "result" });
    }
  },

  goToResult: () => set({ screen: "result" }),

  toggleMatchExpand: (idx) => {
    const cur = new Set(get().simExpanded);
    if (cur.has(idx)) cur.delete(idx); else cur.add(idx);
    set({ simExpanded: cur });
  },

  openScorecard: (idx) => set({ showScorecardFor: idx }),
  closeScorecard: () => set({ showScorecardFor: null }),

  restart: () => set({
    screen: "setup",
    slots: [],
    currentSquad: null,
    usedPlayerNames: new Set(),
    turnExcludedSquadIds: new Set(),
    simResults: [],
    simMeta: null,
    simRevealed: 0,
    simExpanded: new Set(),
    showScorecardFor: null,
    knockoutIdx: 0,
    knockoutPhase: "preview",
  }),
}));

/** Is the current market entirely unusable? Triggers a free redraw. */
export function isMarketDead(): boolean {
  const { currentSquad, slots, usedPlayerNames } = useGameStore.getState();
  if (!currentSquad) return false;
  return isDeadMarketPositions(currentSquad, slots, usedPlayerNames);
}

/** What position slot a player from the current squad would fill, if any. */
export function eligibleSlotForCurrent(playerName: string): Position | null {
  const { currentSquad, slots, usedPlayerNames } = useGameStore.getState();
  if (!currentSquad) return null;
  const player = currentSquad.players.find((p) => p.name === playerName);
  if (!player) return null;
  return eligiblePositionFor(player, slots, usedPlayerNames);
}
