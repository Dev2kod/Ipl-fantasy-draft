import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { Button } from "./ui";

export default function TopBar() {
  const { data, screen, mode, difficulty, restart } = useGameStore();
  const [confirming, setConfirming] = useState(false);
  const nSq = data?.squads.length ?? 0;
  const nPl = data ? data.squads.reduce((a, s) => a + s.players.length, 0) : 0;

  const inGame = screen !== "setup";
  // Leaving mid-run throws the draft away, so ask first. From the Result
  // screen there's nothing left to lose, so go straight home.
  const goHome = () => {
    if (screen === "draft" || screen === "style" || screen === "knockout") setConfirming(true);
    else restart();
  };

  return (
    <>
      <header className="flex justify-between items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-line bg-bg/70 backdrop-blur-md sticky top-0 z-20">
        <button
          type="button"
          onClick={inGame ? goHome : undefined}
          disabled={!inGame}
          aria-label={inGame ? "Leave this tournament and return to the home screen" : "7-0 World Cup Draft"}
          title={inGame ? "Back to home (ends this tournament)" : undefined}
          className={[
            "group flex items-baseline gap-3 bg-transparent border-none p-0 text-left",
            inGame ? "cursor-pointer" : "cursor-default",
          ].join(" ")}
        >
          <span className="text-3xl font-black tracking-tight text-accent transition-transform group-hover:scale-105">
            7<span className="text-slate-400">–</span>0
          </span>
          <span className="hidden sm:inline text-[11px] tracking-[3px] text-slate-400 font-bold">
            WORLD CUP DRAFT · 1975–2023
          </span>
        </button>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline text-[13px] text-slate-400">
            {screen === "setup" ? `${nSq} real squads · ${nPl} players` : `${mode.name} · ${difficulty.name}`}
          </span>
          {inGame && (
            <button
              type="button"
              onClick={goHome}
              title="Back to home (ends this tournament)"
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-400 border border-line rounded-lg px-2.5 py-1.5 hover:border-accent hover:text-accent transition-colors cursor-pointer bg-transparent"
            >
              <Home size={14} /> <span className="hidden sm:inline">Home</span>
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirming(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-panel border border-line rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl"
            >
              <h3 className="text-lg font-bold m-0 mb-1.5">Leave this tournament?</h3>
              <p className="text-slate-400 text-[13.5px] m-0 mb-5">
                Your current XI and any matches played will be discarded. This can't be undone.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="ghost" onClick={() => setConfirming(false)}>Keep playing</Button>
                <Button onClick={() => { setConfirming(false); restart(); }}>Leave &amp; start over</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
