import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Home } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import UiModeToggle from "../components/UiModeToggle";
import { BigButton, Sheet } from "./mui";
import MSetup from "./MSetup";
import MDraft from "./MDraft";
import MStyle from "./MStyle";
import MBracket from "./MBracket";
import MResult from "./MResult";

/**
 * The mobile shell.
 *
 * Deliberately a separate tree from the desktop app rather than a pile of
 * responsive overrides: the two layouts want genuinely different structures
 * (tabs vs side-by-side, bottom sheets vs centred modals, bottom actions vs
 * top actions). They share the same store and engine, so a game started in
 * one layout continues correctly in the other.
 */
export default function MobileApp() {
  const { data, dataError, screen, mode, difficulty, restart } = useGameStore();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const inGame = screen !== "setup";
  const leave = () => {
    if (screen === "result") restart();
    else setConfirmLeave(true);
  };

  return (
    <div className="mobile-ui flex flex-col h-[100dvh] overflow-hidden">
      <a href="#m-main" className="skip-link">Skip to game</a>

      <header className="shrink-0 flex items-center gap-2 px-4 py-2.5 pt-safe border-b border-line bg-bg/85 backdrop-blur-md">
        <button
          type="button"
          onClick={inGame ? leave : undefined}
          disabled={!inGame}
          aria-label={inGame ? "Leave this tournament and return home" : "7-0 World Cup Draft"}
          className="flex items-baseline gap-2 bg-transparent border-none p-0 min-h-[44px]"
        >
          <span className="text-[26px] font-black tracking-tight text-accent leading-none">
            7<span className="text-slate-400">–</span>0
          </span>
          <span className="text-[9px] tracking-[2px] text-slate-400 font-bold">WORLD CUP</span>
        </button>

        <span className="grow" />

        {inGame && (
          <>
            <span className="text-[11px] text-slate-400 font-semibold hidden xs:inline">
              {mode.name} · {difficulty.name}
            </span>
            <button
              type="button"
              onClick={leave}
              aria-label="Leave this tournament and return home"
              className="w-11 h-11 grid place-items-center rounded-xl border border-line text-slate-400 active:bg-panel2"
            >
              <Home size={17} />
            </button>
          </>
        )}
        <UiModeToggle compact />
      </header>

      <main id="m-main" className="grow min-h-0 flex flex-col">
        {dataError && (
          <div className="m-4 p-4 bg-red-50 border border-red-300 text-red-700 rounded-2xl text-center text-[13.5px]">
            Could not load data — is <code>server.py</code> running? ({dataError})
          </div>
        )}
        {!dataError && !data && (
          <p className="text-center text-slate-400 mt-20 animate-pulse">Loading squads…</p>
        )}
        {data && (
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="grow min-h-0 flex flex-col"
            >
              {screen === "setup" && <MSetup />}
              {screen === "draft" && <MDraft />}
              {screen === "style" && <MStyle />}
              {screen === "knockout" && <MBracket />}
              {screen === "result" && <MResult />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <Sheet
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave this tournament?"
        footer={
          <div className="flex flex-col gap-2">
            <BigButton tone="danger" onClick={() => { setConfirmLeave(false); restart(); }}>
              Leave &amp; start over
            </BigButton>
            <BigButton tone="ghost" onClick={() => setConfirmLeave(false)}>Keep playing</BigButton>
          </div>
        }
      >
        <p className="text-[13.5px] text-slate-400 m-0">
          Your current XI and any matches played will be discarded. This can't be undone.
        </p>
      </Sheet>
    </div>
  );
}
