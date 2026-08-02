import { describe, it, expect } from "vitest";
import { FLAG_CODES } from "../countries";

// Codes with no real flag to source (composite cricket sides, drawn instead).
const DRAWN_ONLY = ["WI", "EAF"];
import { DATA } from "./helpers";

/**
 * Flags are drawn as SVG rather than emoji on purpose: Windows ships no
 * glyphs for regional-indicator pairs, so an emoji flag renders there as the
 * bare letters ("IN", "PK"). These tests stop that regressing and stop a new
 * nation shipping without art.
 */
describe("flags", () => {
  it("covers every country that appears in the dataset", () => {
    const inData = [...new Set(DATA.squads.map((s) => s.country))].sort();
    const missing = inData.filter((c) => !(FLAG_CODES as readonly string[]).includes(c));
    expect(missing, `no flag art drawn for: ${missing.join(", ")}`).toEqual([]);
  });

  it("covers every country the API declares", () => {
    const missing = Object.keys(DATA.countries).filter((c) => !(FLAG_CODES as readonly string[]).includes(c));
    expect(missing, `no flag art drawn for: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no art for codes that aren't in the dataset (no dead flags)", () => {
    const inData = new Set(Object.keys(DATA.countries));
    const extra = (FLAG_CODES as readonly string[]).filter((c) => !inData.has(c));
    expect(extra, `flag art for unknown codes: ${extra.join(", ")}`).toEqual([]);
  });

  it("ships a real vendored flag file for every nation that has one", async () => {
    const files = import.meta.glob("../../assets/flags/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const have = new Set(Object.keys(files).map((p) => p.split("/").pop()!.replace(".svg", "").toUpperCase()));
    const expected = (FLAG_CODES as readonly string[]).filter((c) => !DRAWN_ONLY.includes(c));
    const missing = expected.filter((c) => !have.has(c));
    expect(missing, `no vendored flag SVG for: ${missing.join(", ")}`).toEqual([]);
  });

  it("vendors square (1:1) flag artwork, so nothing is cropped to fit", async () => {
    const files = import.meta.glob("../../assets/flags/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    for (const [path, src] of Object.entries(files)) {
      const vb = src.match(/viewBox="([\d.\s-]+)"/);
      expect(vb, `${path} has no viewBox`).toBeTruthy();
      const [, , w, h] = vb![1].trim().split(/\s+/).map(Number);
      expect(w, `${path} is not square: ${w}x${h}`).toBeCloseTo(h, 5);
    }
  });

  it("does not reintroduce emoji flags anywhere in the UI", async () => {
    // Regional-indicator pairs (U+1F1E6..U+1F1FF) and tag-sequence flags.
    const emojiFlag = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0060}-\u{E007F}]+/u;
    const modules = import.meta.glob("../../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const offenders = Object.entries(modules)
      .filter(([path]) => !path.includes("__tests__") && !path.endsWith("Flag.tsx"))
      .filter(([, src]) => emojiFlag.test(src))
      .map(([path]) => path);
    expect(offenders, `emoji flags found in: ${offenders.join(", ")}`).toEqual([]);
  });
});
