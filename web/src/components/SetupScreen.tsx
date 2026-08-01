import { motion } from "framer-motion";
import { Trophy, Eye, Flame, Users2, LayoutList, ShieldCheck } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { MODES, DIFFICULTIES, POSITION_FORMATION } from "../engine/constants";
import { OptionCard, Button, CricketBallGlyph } from "./ui";

const STATS = [
  { label: "Real World Cups", value: "13" },
  { label: "Team-editions", value: "143" },
  { label: "Real players", value: "2,050" },
  { label: "Years covered", value: "1975–2023" },
];

const SNAPSHOTS = [
  {
    src: "/screenshots/draft.png",
    title: "Draft real historical squads",
    desc: "Every market is a genuine World Cup squad. Pick a player who fits an open real-life job, or choose the slot yourself when they fit more than one.",
  },
  {
    src: "/screenshots/result.png",
    title: "A real 32-team World Cup",
    desc: "8 groups of 4, then Round of 16, Quarter-Final, Semi-Final, Final — plus a tournament-wide stats leaderboard for Most Runs and Most Wickets.",
  },
];

export default function SetupScreen() {
  const { mode, difficulty, setMode, setDifficulty, startDraft } = useGameStore();

  return (
    <section className="max-w-6xl mx-auto px-5 pt-6 pb-16">
      <div className="relative text-center pt-8 pb-4 overflow-hidden rounded-3xl">
        <CricketBallGlyph className="absolute w-40 h-40 text-accent/10 -top-8 -left-10 -rotate-12 pointer-events-none" />
        <CricketBallGlyph className="absolute w-56 h-56 text-accent2/10 -bottom-16 -right-16 rotate-12 pointer-events-none" />

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative text-[clamp(28px,5vw,46px)] leading-tight font-black m-0 mb-3.5"
        >
          Build a Champion XI.
          <br />
          Chase the perfect{" "}
          <span className="text-accent animate-glow">7–0</span>.
        </motion.h1>
        <p className="relative max-w-2xl mx-auto text-slate-400 text-base">
          Each turn draws one <b className="text-ink">nation &amp; World Cup year</b> at random — that squad
          becomes your market. Pick <b className="text-ink">one</b> player who fits an open real-life job — a
          player can be signed <b className="text-ink">only once</b>, even if he played in multiple World
          Cups. No going back. Each pick gives you <b className="text-ink">3 switches</b> (to another team
          from that same World Cup, or the same team from another World Cup). Fill your XI, choose a style,
          then simulate a real 32-team World Cup: <b className="text-ink">8 groups of 4</b> (you play all 3
          group matches — one loss doesn't end your tournament, only the final table does), then a
          <b className="text-ink"> Round of 16</b>, <b className="text-ink">Quarter-Final</b>,{" "}
          <b className="text-ink">Semi-Final</b>, and <b className="text-ink">Final</b> if you finish top 2.
          Win every match you play — up to seven — and lift the trophy <b className="text-ink">unbeaten</b>.
        </p>

        <div className="relative flex flex-wrap justify-center gap-x-8 gap-y-3 mt-6">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              className="text-center"
            >
              <div className="text-2xl font-black text-accent leading-none">{s.value}</div>
              <div className="text-[11px] text-slate-400 tracking-wide uppercase font-bold mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="flex items-center justify-center gap-2 text-[15px] tracking-wide text-slate-400 uppercase font-bold mb-4">
          <Eye size={16} className="text-accent2" /> See it in action
        </h2>
        <div className="grid md:grid-cols-2 gap-5">
          {SNAPSHOTS.map((snap, i) => (
            <motion.div
              key={snap.src}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.1, duration: 0.45 }}
              whileHover={{ y: -4 }}
              className="bg-panel border border-line rounded-2xl overflow-hidden shadow-xl"
            >
              <div className="overflow-hidden h-56 md:h-64">
                <img
                  src={snap.src}
                  alt={snap.title}
                  loading="lazy"
                  className="w-full h-full object-cover object-top block border-b border-line"
                />
              </div>
              <div className="p-4">
                <h3 className="font-extrabold text-[15px] m-0 mb-1">{snap.title}</h3>
                <p className="text-slate-400 text-[13px] m-0">{snap.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="bg-panel border border-line rounded-2xl p-4.5 shadow-xl mt-7">
        <h2 className="flex items-center gap-2 text-[15px] tracking-wide text-slate-400 uppercase font-bold m-0 mb-3.5">
          <LayoutList size={16} className="text-accent2" /> Your XI shape
        </h2>
        <div className="bg-panel2 border border-line rounded-xl p-3.5 text-[13px] text-slate-400">
          One fixed real-world shape for every draft — 2 openers, 4 middle-order, a keeper, and 4 bowlers:
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {POSITION_FORMATION.map((s, i) => (
              <span key={i} className="bg-panel border border-line rounded-full px-2.5 py-1 text-[11px] font-bold text-ink">
                {s.position}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 mt-3 text-[12.5px] text-slate-400">
          <ShieldCheck size={15} className="text-win shrink-0 mt-0.5" />
          <span>Positions stay editable after you draft — move or swap any signed player into another slot they're tagged for, any time before you lock the XI.</span>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-2xl p-4.5 shadow-xl mt-5">
        <h2 className="flex items-center gap-2 text-[15px] tracking-wide text-slate-400 uppercase font-bold m-0 mb-3.5">
          <Users2 size={16} className="text-accent2" /> Choose your ratings mode
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map((m) => (
            <OptionCard key={m.id} title={m.name} desc={m.desc} selected={mode.id === m.id} onClick={() => setMode(m)} />
          ))}
        </div>
        <h2 className="flex items-center gap-2 text-[15px] tracking-wide text-slate-400 uppercase font-bold m-0 mt-5.5 mb-3.5">
          <Flame size={16} className="text-accent" /> Difficulty
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {DIFFICULTIES.map((d) => (
            <OptionCard
              key={d.id}
              title={d.name}
              desc={d.desc}
              selected={difficulty.id === d.id}
              onClick={() => setDifficulty(d)}
              extra={<p className="text-slate-400 text-[12px] mt-1.5">Rival strength ≈ {d.opp}</p>}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-7">
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button size="lg" onClick={startDraft}>
            <span className="inline-flex items-center gap-2"><Trophy size={18} /> Start the Draft →</span>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
