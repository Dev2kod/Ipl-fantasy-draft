import type { GameData } from "./types";

// The Python server (local/Render/a VPS) always has the freshest data live
// from SQLite at /api/data. A pure-static deploy (Vercel) has no server to
// ask, so it falls back to the pre-built data.json snapshot Vite copies
// straight out of web/public -- see export_data.py for how that's produced.
export async function fetchGameData(): Promise<GameData> {
  try {
    const res = await fetch("/api/data");
    if (res.ok) return res.json();
  } catch {
    // no live API on this deployment -- fall through to the static snapshot
  }
  const fallback = await fetch("/data.json");
  if (!fallback.ok) throw new Error(`Static dataset returned ${fallback.status}`);
  return fallback.json();
}
