/**
 * Every country code the dataset can produce.
 *
 * Kept in a plain module (not the Flag component) for two reasons: exporting
 * constants from a component file breaks React Fast Refresh, and typing the
 * flag-art table as `Record<FlagCode, …>` makes TypeScript reject a missing
 * or misspelled flag at compile time instead of at runtime.
 */
export const FLAG_CODES = [
  "IND", "AUS", "ENG", "PAK", "WI", "SL", "NZ", "SA", "ZIM", "BAN",
  "AFG", "KEN", "NED", "IRE", "SCO", "CAN", "NAM", "UAE", "BER", "EAF",
] as const;

export type FlagCode = (typeof FLAG_CODES)[number];
