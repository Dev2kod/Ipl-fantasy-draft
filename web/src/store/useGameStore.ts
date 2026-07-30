import { create } from "zustand";
import type {
  GameData, Squad, Slot, SignedPlayer, Formation, Mode, Difficulty, Style, Role,
  DraftModeOption, Position,
} from "../engine/types";
import {
  FORMATIONS, MODES, DIFFICULTIES, STYLES, MAX_SWITCHES_PER_PICK,
  DRAFT_MODES, AUCTION_PURSE, POSITION_FORMATION,
} from "../engine/constants";
import {
  drawRandomSquad, switchCandidates, filledCount,
  isDeadMarket, eligibleRoleFor,
  isDeadMarketAuction, eligibleRoleForAuction,
  isDeadMarketPositions, eligiblePositionFor,
} from "../engine/draft";
import { simulateCupRun, type MatchResult, type SimMeta } from "../engine/simulate";
import { fetchGameData } from "../engine/data";

export type Screen = "setup" | "draft" | "style" | "result";

interface GameState {
  // data
  data: GameData | null;
  dataError: string | null;

  // screen
  screen: Screen;

  // setup choices
  draftMode: DraftModeOption;
  formation: Formation;
  mode: Mode;
  difficulty: Difficulty;
  style: Style;

  // draft state
  slots: Slot[];
  switchesLeft: number;
  purseLeft: number;
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

  // actions
  loadData: () => Promise<void>;
  setDraftMode: (m: DraftModeOption) => void;
  setFormation: (f: Formation) => void;
  setMode: (m: Mode) => void;
  setDifficulty: (d: Difficulty) => void;
  setStyle: (s: Style) => void;
  startDraft: () => void;
  drawNext: () => void;
  doSwitch: (kind: "team" | "season") => void;
  draftPlayer: (playerName: string, slotKey: Role | Position) => void;
  goToStyle: () => void;
  runSimulation: () => void;
  goToResult: () => void;
  toggleMatchExpand: (idx: number) => void;
  openScorecard: (idx: number) => void;
  closeScorecard: () => void;
  restart: () => void;
}

function buildRoleSlots(formation: Formation): Slot[] {
  const slots: Slot[] = [];
  (["BAT", "WK", "ALL", "BOWL"] as Role[]).forEach((role) => {
    for (let i = 0; i < (formation.need[role] || 0); i++) slots.push({ role, position: null, player: null });
  });
  return slots;
}

function buildPositionSlots(): Slot[] {
  return POSITION_FORMATION.map((def) => ({ role: def.role, position: def.position, player: null }));
}

export const useGameStore = create<GameState>((set, get) => ({
  data: null,
  dataError: null,
  screen: "setup",

  draftMode: DRAFT_MODES[0],
  formation: FORMATIONS[0],
  mode: MODES[0],
  difficulty: DIFFICULTIES[1],
  style: STYLES[1],

  slots: [],
  switchesLeft: MAX_SWITCHES_PER_PICK,
  purseLeft: AUCTION_PURSE,
  currentSquad: null,
  usedPlayerNames: new Set(),
  turnExcludedSquadIds: new Set(),
  lastMessage: "",

  simResults: [],
  simMeta: null,
  simRevealed: 0,
  simExpanded: new Set(),
  showScorecardFor: null,

  loadData: async () => {
    try {
      const data = await fetchGameData();
      set({ data });
    } catch (e) {
      set({ dataError: e instanceof Error ? e.message : "Failed to load data" });
    }
  },

  setDraftMode: (m) => set({ draftMode: m }),
  setFormation: (f) => set({ formation: f }),
  setMode: (m) => set({ mode: m }),
  setDifficulty: (d) => set({ difficulty: d }),
  setStyle: (s) => set({ style: s }),

  startDraft: () => {
    const { formation, data, draftMode } = get();
    if (!data) return;
    const slots = draftMode.id === "positions" ? buildPositionSlots() : buildRoleSlots(formation);
    set({
      slots,
      switchesLeft: MAX_SWITCHES_PER_PICK,
      purseLeft: AUCTION_PURSE,
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
    const kindMsg = kind === "team" ? "another team, same season" : "same team, another season";
    set({
      switchesLeft: left,
      turnExcludedSquadIds: nextExcluded,
      currentSquad: next,
      lastMessage: `Switched to ${kindMsg}. ${left} switch${left === 1 ? "" : "es"} left.`,
    });
  },

  draftPlayer: (playerName, slotKey) => {
    const { currentSquad, slots, usedPlayerNames, draftMode, purseLeft } = get();
    if (!currentSquad) return;
    const player = currentSquad.players.find((p) => p.name === playerName);
    if (!player) return;
    if (draftMode.id === "auction" && player.price > purseLeft) return;
    const slotIdx = slots.findIndex((s) => !s.player && (s.position ? s.position === slotKey : s.role === slotKey));
    if (slotIdx === -1) return;
    const signed: SignedPlayer = { ...player, _src: `${currentSquad.franchise} ${currentSquad.season}`, _srcSquadId: currentSquad.id };
    const newSlots = slots.map((s, i) => (i === slotIdx ? { ...s, player: signed } : s));
    const newUsed = new Set(usedPlayerNames);
    newUsed.add(player.name);
    set({
      slots: newSlots,
      usedPlayerNames: newUsed,
      purseLeft: draftMode.id === "auction" ? Math.round((purseLeft - player.price) * 10) / 10 : purseLeft,
      switchesLeft: MAX_SWITCHES_PER_PICK,
      turnExcludedSquadIds: new Set(),
      currentSquad: null,
      lastMessage: `✓ Signed ${player.name} (${currentSquad.franchise} ${currentSquad.season}).`,
    });
    if (filledCount(newSlots) < 11) {
      setTimeout(() => get().drawNext(), 220);
    }
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
    purseLeft: AUCTION_PURSE,
    simResults: [],
    simMeta: null,
    simRevealed: 0,
    simExpanded: new Set(),
    showScorecardFor: null,
  }),
}));

/** Is the current market entirely unusable, mode-aware — triggers a free redraw. */
export function isMarketDead(): boolean {
  const { currentSquad, slots, usedPlayerNames, draftMode, purseLeft, data } = useGameStore.getState();
  if (!currentSquad) return false;
  if (draftMode.id === "positions") return isDeadMarketPositions(currentSquad, slots, usedPlayerNames);
  if (draftMode.id === "auction") return isDeadMarketAuction(currentSquad, slots, usedPlayerNames, purseLeft, data?.squads ?? []);
  return isDeadMarket(currentSquad, slots, usedPlayerNames);
}

/** What slot (role or specific position) a player from the current squad would fill, mode-aware. */
export function eligibleSlotForCurrent(playerName: string): Role | Position | null {
  const { currentSquad, slots, usedPlayerNames, draftMode, purseLeft, data } = useGameStore.getState();
  if (!currentSquad) return null;
  const player = currentSquad.players.find((p) => p.name === playerName);
  if (!player) return null;
  if (draftMode.id === "positions") return eligiblePositionFor(player, slots, usedPlayerNames);
  if (draftMode.id === "auction") return eligibleRoleForAuction(player, slots, usedPlayerNames, purseLeft, data?.squads ?? []);
  return eligibleRoleFor(player, slots, usedPlayerNames);
}
