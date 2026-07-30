import { motion } from "framer-motion";
import { useGameStore } from "../store/useGameStore";
import { FORMATIONS, MODES, DIFFICULTIES, DRAFT_MODES, AUCTION_PURSE, POSITION_FORMATION } from "../engine/constants";
import { OptionCard, Button } from "./ui";

export default function SetupScreen() {
  const {
    draftMode, formation, mode, difficulty,
    setDraftMode, setFormation, setMode, setDifficulty, startDraft,
  } = useGameStore();

  return (
    <section className="max-w-6xl mx-auto px-5 pt-6 pb-16">
      <div className="text-center pt-6 pb-2.5">
        <h1 className="text-[clamp(28px,5vw,46px)] leading-tight font-black m-0 mb-3.5">
          Build a Champion XI.
          <br />
          Chase the perfect{" "}
          <span className="text-accent animate-glow">7–0</span>.
        </h1>
        <p className="max-w-2xl mx-auto text-slate-400 text-base">
          Each turn draws one <b className="text-ink">IPL franchise &amp; season</b> at random — that squad
          becomes your market. Pick <b className="text-ink">one</b> player who fits an open role — a player
          can be signed <b className="text-ink">only once</b>, even across seasons, and your XI may carry{" "}
          <b className="text-ink">at most 4 overseas players</b>. No going back. Each pick gives you{" "}
          <b className="text-ink">3 switches</b> (to another team that season, or the same team another
          season). Fill your XI, choose a style, then simulate a 7-match gauntlet. Win all seven and lift the
          trophy <b className="text-ink">unbeaten</b>.
        </p>
      </div>

      <div className="bg-panel border border-line rounded-2xl p-4.5 shadow-xl mt-6">
        <h2 className="text-[15px] tracking-wide text-slate-400 uppercase m-0 mb-3.5">1 · Choose your draft mode</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {DRAFT_MODES.map((dm) => (
            <OptionCard
              key={dm.id}
              title={dm.name}
              desc={dm.desc}
              selected={draftMode.id === dm.id}
              onClick={() => setDraftMode(dm)}
            />
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div className="bg-panel border border-line rounded-2xl p-4.5 shadow-xl">
          <h2 className="text-[15px] tracking-wide text-slate-400 uppercase m-0 mb-3.5">2 · Choose your XI shape</h2>
          {draftMode.id === "positions" ? (
            <div className="bg-panel2 border border-line rounded-xl p-3.5 text-[13px] text-slate-400">
              Real Positions mode uses one fixed real-world shape — 2 openers, a No.3, middle-order, finisher,
              keeper, two all-rounders, and three specialist bowlers:
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {POSITION_FORMATION.map((s, i) => (
                  <span key={i} className="bg-panel border border-line rounded-full px-2.5 py-1 text-[11px] font-bold text-ink">
                    {s.position}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {FORMATIONS.map((f) => (
                <OptionCard
                  key={f.id}
                  title={f.name}
                  subtitle={f.shape}
                  desc={f.desc}
                  selected={formation.id === f.id}
                  onClick={() => setFormation(f)}
                />
              ))}
            </div>
          )}
          {draftMode.id === "auction" && (
            <p className="text-[12.5px] text-slate-400 mt-3.5">
              💰 You'll have a <b className="text-accent">₹{AUCTION_PURSE}cr purse</b> for the whole XI — every
              player has a price, so the highest-rated pick isn't always the smart one.
            </p>
          )}
        </div>
        <div className="bg-panel border border-line rounded-2xl p-4.5 shadow-xl">
          <h2 className="text-[15px] tracking-wide text-slate-400 uppercase m-0 mb-3.5">3 · Choose your ratings mode</h2>
          <div className="grid grid-cols-2 gap-3">
            {MODES.map((m) => (
              <OptionCard key={m.id} title={m.name} desc={m.desc} selected={mode.id === m.id} onClick={() => setMode(m)} />
            ))}
          </div>
          <h2 className="text-[15px] tracking-wide text-slate-400 uppercase m-0 mt-5.5 mb-3.5">4 · Difficulty</h2>
          <div className="grid grid-cols-2 gap-3">
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
      </div>

      <div className="flex items-center justify-center gap-4 mt-7">
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button size="lg" onClick={startDraft}>
            Start the Draft →
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
