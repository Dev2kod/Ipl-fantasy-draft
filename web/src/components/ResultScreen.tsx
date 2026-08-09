import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { FileText, Trophy, Target, ChevronDown, Share2, Loader2, Download, X } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import type { SignedPlayer } from "../engine/types";
import type { GroupStanding, LeaderboardRow } from "../engine/simulate";
import { Button, AwardBadge } from "./ui";
import Flag, { flagUrlFor } from "./Flag";
import ScorecardModal from "./ScorecardModal";
import { renderResultCard, canShareFile, shareImageFile, downloadImage } from "../engine/shareCard";

function GroupTable({ standings }: { standings: GroupStanding[] }) {
  return (
    <table className="w-full text-[13px] border-collapse">
      <thead>
        <tr className="text-slate-400 text-left">
          <th className="py-1.5 px-2 font-bold">#</th>
          <th className="py-1.5 px-2 font-bold">Team</th>
          <th className="py-1.5 px-2 font-bold text-center">P</th>
          <th className="py-1.5 px-2 font-bold text-center">W</th>
          <th className="py-1.5 px-2 font-bold text-center">L</th>
          <th className="py-1.5 px-2 font-bold text-center">Runs +/-</th>
          <th className="py-1.5 px-2 font-bold text-center">Pts</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((row, i) => (
          <tr key={i} className={clsx("border-t border-line", row.isYou && "bg-accent/10 font-bold")}>
            <td className="py-1.5 px-2">{i + 1}</td>
            <td className="py-1.5 px-2">
              <span className="inline-flex items-center gap-1.5">
                <Flag code={row.code} isYou={row.isYou} />
                {row.isYou ? "You" : row.name}
              </span>
            </td>
            <td className="py-1.5 px-2 text-center">{row.played}</td>
            <td className="py-1.5 px-2 text-center">{row.won}</td>
            <td className="py-1.5 px-2 text-center">{row.lost}</td>
            <td className="py-1.5 px-2 text-center">{row.runsFor - row.runsAgainst >= 0 ? "+" : ""}{row.runsFor - row.runsAgainst}</td>
            <td className="py-1.5 px-2 text-center">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ResultScreen() {
  const { data, simResults, simMeta, slots, mode, difficulty, style, restart } = useGameStore();
  const [copied, setCopied] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [otherGroupsOpen, setOtherGroupsOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [statPlayer, setStatPlayer] = useState<{ row: LeaderboardRow; unit: string } | null>(null);

  if (!simMeta) return null;
  const won = simMeta.won;
  const played = simMeta.played;
  const perfect = simMeta.champion && won === played && played === 7;
  const players = slots.map((s) => s.player).filter((p): p is SignedPlayer => p !== null);

  let verdict: string, sub: string;
  if (perfect) {
    verdict = "🏆 CHAMPIONS — UNBEATEN";
    sub = "Seven wins from seven. You built the perfect XI and delivered the statement.";
  } else if (simMeta.champion) {
    verdict = "🏆 CHAMPIONS";
    sub = "You lifted the trophy — though the run wasn't spotless.";
  } else if (simMeta.reachedFinal) {
    verdict = "Runners-up";
    sub = "Lost the final. A brilliant run through a 32-team World Cup, but not the perfect 7–0.";
  } else if (simMeta.qualified) {
    verdict = `Lost in the ${simMeta.stageReached}`;
    sub = `Topped your group in ${ordinal(simMeta.groupRank)}, but your knockout run ended in the ${simMeta.stageReached}.`;
  } else {
    verdict = "Group Stage exit";
    sub = `Finished ${ordinal(simMeta.groupRank)} in your group of 4 — not enough to reach the Round of 16.`;
  }

  const copyResult = () => {
    const lines = [
      `Unbeaten XI — ${verdict} (${won}/${played})`,
      ...players.map((p) => `${p.role.padEnd(4)} ${p.name} — ${p._src} (${p.overall})`),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const shareText = `Unbeaten XI — ${verdict.replace("🏆 ", "")} (${won}/${played})`;
  const shareFilename = "unbeaten-xi-result.png";
  const shareSupported = canShareFile(shareFilename);

  const openPreview = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await renderResultCard({
        verdict: verdict.replace("🏆 ", ""), sub, perfect,
        won, played, groupRank: simMeta.groupRank, overall: simMeta.r.overall,
        modeName: mode.name, difficultyName: difficulty.name, styleName: style.name,
        players: players.map((p) => ({ name: p.name, role: p.role, overall: p.overall, srcLabel: p._src, srcCode: p._srcCode })),
        matches: simResults.map((m) => ({
          stage: m.stage, ourRuns: m.ourRuns, theirRuns: m.theirRuns, oppName: m.oppName, oppCode: m.oppCode, win: m.win,
        })),
        flagUrl: flagUrlFor,
        countryColour: (code) => data?.countries[code]?.colour,
      });
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } finally {
      setSharing(false);
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <section className="max-w-3xl mx-auto px-5 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={clsx(
          "rounded-[20px] p-7 text-center shadow-2xl bg-gradient-to-br from-panel2 to-panel border",
          perfect ? "border-accent shadow-[0_0_40px_rgba(255,122,26,0.35)]" : "border-line"
        )}
      >
        {perfect && (
          <div className="text-[64px] font-black text-accent tracking-tighter mb-1" style={{ textShadow: "0 0 30px rgba(255,122,26,0.4)" }}>
            7–0
          </div>
        )}
        <h2 className="text-[clamp(26px,5vw,40px)] font-black m-0 mb-1.5">{verdict}</h2>
        <p className="text-slate-400 mb-4.5">{sub}</p>

        <div className="flex justify-center gap-6 flex-wrap mb-3">
          <Stat label="Matches won" value={`${won}/${played}`} />
          <Stat label="Group finish" value={`${ordinal(simMeta.groupRank)} / 4`} />
          <Stat label="Batting" value={Math.round(simMeta.r.batting)} />
          <Stat label="Bowling" value={Math.round(simMeta.r.bowling)} />
          <Stat label="Overall" value={Math.round(simMeta.r.overall)} />
        </div>

        <div className="grid gap-2 mt-5 text-left" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))" }}>
          {players.map((p, i) => (
            <div key={i} className="bg-panel border border-line rounded-lg px-2.5 py-2 text-[13px] flex justify-between gap-1.5">
              <span className="truncate">
                {p.name}
                <small className="block text-slate-400 text-[10.5px]">{p.role} · <Flag code={p._srcCode} /> {p._src}</small>
                {p.award && <span className="block mt-1"><AwardBadge award={p.award} /></span>}
              </span>
              <span className="font-extrabold text-accent">{p.overall}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-400 text-sm mt-4">
          {mode.name} · {difficulty.name} · {style.name} style
        </p>
      </motion.div>

      <div className="mt-6">
        <h3 className="text-center font-bold mb-3">Your Group</h3>
        <div className="overflow-x-auto">
          <GroupTable standings={simMeta.groupStandings} />
        </div>
        <p className="text-[11.5px] text-slate-400 text-center mt-1.5">Top 2 advance to the Round of 16.</p>
      </div>

      <div className="mt-4">
        <button
          onClick={() => setOtherGroupsOpen((o) => !o)}
          className="w-full flex items-center justify-center gap-1.5 text-[13px] font-bold text-accent2 bg-transparent border-none cursor-pointer py-1.5"
        >
          <motion.span animate={{ rotate: otherGroupsOpen ? 180 : 0 }}><ChevronDown size={15} /></motion.span>
          {otherGroupsOpen ? "Hide" : "Show"} the other 7 groups
        </button>
        {otherGroupsOpen && (
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            {simMeta.allGroupStandings.slice(1).map((standings, gi) => (
              <div key={gi} className="overflow-x-auto">
                <h4 className="text-center text-[12px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Group {gi + 2}</h4>
                <GroupTable standings={standings} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-5">
        <div>
          <h3 className="flex items-center justify-center gap-1.5 font-bold mb-3">
            <Target size={16} className="text-accent2" /> Most Runs
          </h3>
          <ol className="list-none m-0 p-0 flex flex-col gap-1.5">
            {simMeta.topRuns.map((row, i) => (
              <li key={row.name}>
                <button
                  type="button"
                  onClick={() => setStatPlayer({ row, unit: "runs" })}
                  aria-label={`${row.name}, ${row.team} — click to see every match this total came from`}
                  className="w-full flex items-center gap-2.5 bg-panel border border-line rounded-lg px-3 py-1.5 text-[13px] text-left cursor-pointer hover:border-accent2 transition-colors"
                >
                  <span className="w-5 text-slate-400 font-bold">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate">
                    {row.name} <span className="text-slate-400 text-[11.5px]"><Flag code={row.teamCode} isYou={row.team === "You"} /> {row.team}</span>
                  </span>
                  <span className="font-black text-accent">{row.value}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="flex items-center justify-center gap-1.5 font-bold mb-3">
            <Trophy size={16} className="text-accent2" /> Most Wickets
          </h3>
          <ol className="list-none m-0 p-0 flex flex-col gap-1.5">
            {simMeta.topWickets.map((row, i) => (
              <li key={row.name}>
                <button
                  type="button"
                  onClick={() => setStatPlayer({ row, unit: "wickets" })}
                  aria-label={`${row.name}, ${row.team} — click to see every match this total came from`}
                  className="w-full flex items-center gap-2.5 bg-panel border border-line rounded-lg px-3 py-1.5 text-[13px] text-left cursor-pointer hover:border-accent2 transition-colors"
                >
                  <span className="w-5 text-slate-400 font-bold">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate">
                    {row.name} <span className="text-slate-400 text-[11.5px]"><Flag code={row.teamCode} isYou={row.team === "You"} /> {row.team}</span>
                  </span>
                  <span className="font-black text-accent">{row.value}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="text-[11.5px] text-slate-400 text-center mt-2">Tournament-wide across all 32 teams and every match played, not just yours.</p>

      <div className="mt-6">
        <h3 className="text-center font-bold mb-3">Full Cup Run Scorecard</h3>
        <div className="flex flex-col gap-2">
          {simResults.map((m, i) => (
            <button
              key={i}
              onClick={() => setOpenIdx(i)}
              className="flex justify-between items-center gap-3 bg-panel border border-line rounded-xl px-4 py-2.5 hover:border-accent2 transition-colors cursor-pointer text-left"
            >
              <span className="text-[13px] font-extrabold text-slate-400 uppercase tracking-wide w-36">{m.stage}</span>
              <span className="flex-1 text-sm">
                You <b>{m.ourRuns}</b> vs <b>{m.theirRuns}</b> <Flag code={m.oppCode} /> {m.oppName} · {m.line}
              </span>
              <span className={clsx("text-[12px] font-black px-3 py-0.5 rounded-full", m.win ? "bg-win/20 text-win" : "bg-loss/20 text-loss")}>
                {m.win ? "WON" : "LOST"}
              </span>
              <FileText size={16} className="text-accent2" />
            </button>
          ))}
        </div>
      </div>

      <div className="text-center mt-6 flex justify-center gap-3">
        <Button onClick={restart}>Draft again ↻</Button>
        <Button variant="ghost" onClick={copyResult}>{copied ? "Copied ✓" : "Copy result"}</Button>
        <Button variant="ghost" onClick={openPreview} disabled={sharing}>
          <span className="inline-flex items-center gap-1.5">
            {sharing ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
            Share as image
          </span>
        </Button>
      </div>

      {openIdx !== null && simResults[openIdx] && (
        <ScorecardModal match={simResults[openIdx]} onClose={() => setOpenIdx(null)} />
      )}

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePreview}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-panel border border-line rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto scrollbar-thin"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold m-0">Share your result</h3>
                <button onClick={closePreview} className="bg-transparent border-none text-slate-400 hover:text-ink cursor-pointer p-1">
                  <X size={20} />
                </button>
              </div>
              <div className="rounded-xl overflow-hidden border border-line bg-panel2">
                <img src={preview.url} alt="Your Unbeaten XI result card" className="w-full h-auto block" />
              </div>
              <div className="flex gap-2 mt-4">
                {shareSupported && (
                  <Button className="grow" onClick={() => shareImageFile(preview.blob, shareFilename, shareText)}>
                    <span className="inline-flex items-center gap-1.5"><Share2 size={15} /> Share</span>
                  </Button>
                )}
                <Button
                  variant={shareSupported ? "ghost" : "primary"}
                  className="grow"
                  onClick={() => downloadImage(preview.blob, shareFilename)}
                >
                  <span className="inline-flex items-center gap-1.5"><Download size={15} /> Save image</span>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {statPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStatPlayer(null)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-panel border border-line rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto scrollbar-thin"
            >
              <div className="flex justify-between items-start mb-1">
                <div>
                  <h3 className="text-lg font-bold m-0">{statPlayer.row.name}</h3>
                  <p className="text-slate-400 text-[13px] m-0 mt-0.5">
                    {statPlayer.row.team === "You" ? "Your XI" : statPlayer.row.team} · {statPlayer.row.value} {statPlayer.unit} total
                  </p>
                </div>
                <button onClick={() => setStatPlayer(null)} className="bg-transparent border-none text-slate-400 hover:text-ink cursor-pointer p-1">
                  <X size={20} />
                </button>
              </div>
              <ul className="list-none m-0 p-0 mt-3 flex flex-col gap-1.5">
                {statPlayer.row.contributions.map((c, i) => (
                  <li key={i} className="flex items-center gap-2.5 bg-panel2 border border-line rounded-lg px-3 py-2 text-[13px]">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[10.5px] font-black uppercase tracking-wide text-slate-400">{c.stage}</span>
                      <span className="block truncate">vs {c.opponent}</span>
                    </span>
                    <span className="font-black text-accent shrink-0">{c.value}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-[13px] text-slate-400 text-center">
      <b className="block text-[22px] text-ink">{value}</b>
      {label}
    </div>
  );
}
