import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { RotateCcw, Copy, Check, FileText, Target, Trophy, ChevronDown, Share2, Loader2 } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import Flag, { flagUrlFor } from "../components/Flag";
import ScorecardModal from "../components/ScorecardModal";
import { BigButton, BottomBar, SectionTitle } from "./mui";
import type { SignedPlayer } from "../engine/types";
import type { GroupStanding, LeaderboardRow } from "../engine/simulate";
import { renderResultCard, shareOrDownloadImage } from "../engine/shareCard";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function Standings({ rows }: { rows: GroupStanding[] }) {
  return (
    <table className="w-full text-[12.5px] border-collapse">
      <caption className="sr-only">Group standings</caption>
      <thead>
        <tr className="text-slate-400 text-left">
          <th scope="col" className="py-1 pr-1 font-bold w-5">#</th>
          <th scope="col" className="py-1 font-bold">Team</th>
          <th scope="col" className="py-1 px-1 font-bold text-center">W</th>
          <th scope="col" className="py-1 px-1 font-bold text-center">L</th>
          <th scope="col" className="py-1 pl-1 font-bold text-center">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={clsx("border-t border-line", row.isYou && "bg-accent/10 font-bold")}>
            <td className="py-1.5 pr-1 tabular-nums">{i + 1}</td>
            <td className="py-1.5">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <Flag code={row.code} isYou={row.isYou} className="w-4 h-4 rounded-[2px] shrink-0 ring-1 ring-black/10 object-cover" />
                <span className="truncate">{row.isYou ? "You" : row.name}</span>
              </span>
            </td>
            <td className="py-1.5 px-1 text-center tabular-nums">{row.won}</td>
            <td className="py-1.5 px-1 text-center tabular-nums">{row.lost}</td>
            <td className="py-1.5 pl-1 text-center tabular-nums">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Board({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: LeaderboardRow[] }) {
  return (
    <section aria-label={title}>
      <h3 className="flex items-center justify-center gap-1.5 text-[13.5px] font-bold mb-2">{icon} {title}</h3>
      <ol className="list-none m-0 p-0 flex flex-col gap-1.5">
        {rows.slice(0, 5).map((row, i) => (
          <li key={row.name} className="flex items-center gap-2 bg-panel border border-line rounded-xl px-3 py-2 text-[12.5px]">
            <span className="w-4 text-slate-400 font-bold tabular-nums">{i + 1}</span>
            <Flag code={row.teamCode} isYou={row.team === "You"} className="w-4 h-4 rounded-[2px] shrink-0 ring-1 ring-black/10 object-cover" />
            <span className="grow min-w-0 truncate">{row.name}</span>
            <b className="text-accent tabular-nums">{row.value}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function MResult() {
  const { data, simResults, simMeta, slots, mode, difficulty, style, restart } = useGameStore();
  const [copied, setCopied] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!simMeta) return null;
  const { won, played, champion, reachedFinal, qualified, groupRank, stageReached } = simMeta;
  const perfect = champion && won === played && played === 7;
  const players = slots.map((s) => s.player).filter((p): p is SignedPlayer => p !== null);

  let verdict: string, sub: string;
  if (perfect) { verdict = "CHAMPIONS — UNBEATEN"; sub = "Seven from seven. The perfect run."; }
  else if (champion) { verdict = "CHAMPIONS"; sub = "You lifted the trophy."; }
  else if (reachedFinal) { verdict = "Runners-up"; sub = "Lost the final — so close."; }
  else if (qualified) { verdict = `Out in the ${stageReached}`; sub = `Finished ${ordinal(groupRank)} in your group.`; }
  else { verdict = "Group Stage exit"; sub = `Finished ${ordinal(groupRank)} of 4 — no Round of 16.`; }

  const copy = () => {
    const lines = [
      `Unbeaten XI — ${verdict} (${won}/${played})`,
      ...players.map((p) => `${p.role.padEnd(4)} ${p.name} — ${p._src} (${p.overall})`),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await renderResultCard({
        verdict, sub, perfect,
        won, played, groupRank, overall: simMeta.r.overall,
        modeName: mode.name, difficultyName: difficulty.name, styleName: style.name,
        players: players.map((p) => ({ name: p.name, role: p.role, overall: p.overall, srcLabel: p._src, srcCode: p._srcCode })),
        matches: simResults.map((m) => ({
          stage: m.stage, ourRuns: m.ourRuns, theirRuns: m.theirRuns, oppName: m.oppName, oppCode: m.oppCode, win: m.win,
        })),
        flagUrl: flagUrlFor,
        countryColour: (code) => data?.countries[code]?.colour,
      });
      await shareOrDownloadImage(blob, "unbeaten-xi-result.png", `Unbeaten XI — ${verdict} (${won}/${played})`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 grow">
      <div className="grow overflow-y-auto px-4 pb-4">
        <motion.section
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className={clsx(
            "rounded-3xl p-5 text-center mt-4 border-2 bg-gradient-to-br from-panel2 to-panel",
            perfect ? "border-accent shadow-[0_0_30px_rgba(255,122,26,0.28)]" : "border-line"
          )}
        >
          {perfect && <div className="text-[46px] font-black text-accent leading-none tracking-tighter mb-1">7–0</div>}
          <h1 className="text-[25px] leading-tight font-black m-0">{champion && "🏆 "}{verdict}</h1>
          <p className="text-slate-400 text-[13.5px] mt-1.5 mb-4">{sub}</p>

          <dl className="grid grid-cols-3 gap-3 m-0">
            {[
              [`${won}/${played}`, "Won"],
              [`${ordinal(groupRank)}/4`, "Group"],
              [String(Math.round(simMeta.r.overall)), "Overall"],
            ].map(([v, k]) => (
              <div key={k}>
                <dd className="text-[19px] font-black m-0 leading-none tabular-nums">{v}</dd>
                <dt className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold mt-1">{k}</dt>
              </div>
            ))}
          </dl>
          <p className="text-[11.5px] text-slate-400 mt-4 mb-0">
            {mode.name} · {difficulty.name} · {style.name}
          </p>
        </motion.section>

        <div className="mt-5">
          <SectionTitle>Your XI</SectionTitle>
          <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
            {players.map((p, i) => (
              <li key={i} className="flex items-center gap-2 bg-panel border border-line rounded-xl px-3 py-2 text-[13px]">
                <Flag code={p._srcCode} className="w-4 h-4 rounded-[2px] shrink-0 ring-1 ring-black/10 object-cover" />
                <span className="grow min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-[11px] text-slate-400 truncate">{p.role} · {p._src}</span>
                </span>
                <b className="text-accent tabular-nums">{p.overall}</b>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <SectionTitle>Your group</SectionTitle>
          <div className="bg-panel border border-line rounded-2xl p-3">
            <Standings rows={simMeta.groupStandings} />
          </div>
          <button
            type="button"
            onClick={() => setOthersOpen((o) => !o)}
            aria-expanded={othersOpen}
            className="w-full min-h-[44px] flex items-center justify-center gap-1.5 text-[13px] font-bold text-accent2 mt-1"
          >
            <motion.span animate={{ rotate: othersOpen ? 180 : 0 }} aria-hidden="true">
              <ChevronDown size={15} />
            </motion.span>
            {othersOpen ? "Hide" : "Show"} the other 7 groups
          </button>
          {othersOpen && (
            <div className="flex flex-col gap-3 mt-1">
              {simMeta.allGroupStandings.slice(1).map((g, gi) => (
                <div key={gi} className="bg-panel border border-line rounded-2xl p-3">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 text-center m-0 mb-1.5">
                    Group {gi + 2}
                  </h3>
                  <Standings rows={g} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4">
          <Board title="Most Runs" icon={<Target size={15} className="text-accent2" aria-hidden="true" />} rows={simMeta.topRuns} />
          <Board title="Most Wickets" icon={<Trophy size={15} className="text-accent2" aria-hidden="true" />} rows={simMeta.topWickets} />
        </div>
        <p className="text-[11px] text-slate-400 text-center mt-2">
          Across all 32 teams and every match played.
        </p>

        <div className="mt-5">
          <SectionTitle>Every match</SectionTitle>
          <ul className="list-none m-0 p-0 flex flex-col gap-2">
            {simResults.map((m, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(i)}
                  aria-label={`Full scorecard for ${m.stage} against ${m.oppName}`}
                  className="w-full text-left bg-panel border border-line rounded-xl px-3.5 py-2.5 min-h-[56px] flex items-center gap-2.5"
                >
                  <span className="grow min-w-0">
                    <span className="block text-[10.5px] font-black uppercase tracking-wider text-slate-400">{m.stage}</span>
                    <span className="flex items-center gap-1.5 mt-0.5 text-[13px]">
                      <b className="tabular-nums">{m.ourRuns}</b>
                      <span className="text-slate-400">v</span>
                      <b className="tabular-nums">{m.theirRuns}</b>
                      <Flag code={m.oppCode} className="w-4 h-4 rounded-[2px] ml-0.5 ring-1 ring-black/10 object-cover" />
                      <span className="truncate">{m.oppName}</span>
                    </span>
                  </span>
                  <span className={clsx("text-[10.5px] font-black px-2 py-1 rounded-full shrink-0", m.win ? "bg-win/20 text-win" : "bg-loss/20 text-loss")}>
                    {m.win ? "W" : "L"}
                  </span>
                  <FileText size={15} className="text-accent2 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BottomBar>
        <div className="flex gap-2">
          <BigButton onClick={restart} className="grow">
            <RotateCcw size={17} aria-hidden="true" /> Draft again
          </BigButton>
          <BigButton tone="ghost" onClick={copy} className="!w-auto px-5" ariaLabel="Copy result to clipboard">
            {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
          </BigButton>
          <BigButton tone="ghost" onClick={share} disabled={sharing} className="!w-auto px-5" ariaLabel="Share your XI and result as an image">
            {sharing ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Share2 size={17} aria-hidden="true" />}
          </BigButton>
        </div>
      </BottomBar>

      {openIdx !== null && simResults[openIdx] && (
        <ScorecardModal match={simResults[openIdx]} onClose={() => setOpenIdx(null)} />
      )}
    </div>
  );
}
