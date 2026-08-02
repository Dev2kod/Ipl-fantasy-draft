import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { useGameStore } from "./store/useGameStore";
import TopBar from "./components/TopBar";
import SetupScreen from "./components/SetupScreen";
import DraftScreen from "./components/DraftScreen";
import StyleScreen from "./components/StyleScreen";
import ResultScreen from "./components/ResultScreen";
import BracketScreen from "./components/BracketScreen";
import Footer from "./components/Footer";

export default function App() {
  const { data, dataError, loadData, screen } = useGameStore();
  const isFullBleed = screen === "draft" || screen === "knockout";

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    // The viewport-locked layout is a desktop affordance: on phones there
    // isn't room for two side-by-side scroll panes, so the page scrolls
    // normally instead of squeezing everything into one screen.
    <div className={clsx("flex flex-col", isFullBleed ? "min-h-screen md:h-screen md:overflow-hidden" : "min-h-screen")}>
      <TopBar />
      <main className={clsx("flex-1 min-h-0", isFullBleed && "flex flex-col md:overflow-hidden")}>
        {dataError && (
          <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-50 border border-red-300 text-red-700 rounded-xl text-center">
            Could not load data — is <code>server.py</code> running? ({dataError})
          </div>
        )}
        {!dataError && !data && (
          <div className="max-w-2xl mx-auto mt-24 text-center text-slate-400 animate-pulse">
            Loading squads…
          </div>
        )}
        {data && (
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={clsx(isFullBleed && "flex-1 min-h-0 flex flex-col")}
            >
              {screen === "setup" && <SetupScreen />}
              {screen === "draft" && <DraftScreen />}
              {screen === "style" && <StyleScreen />}
              {screen === "knockout" && <BracketScreen />}
              {screen === "result" && <ResultScreen />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      {!isFullBleed && <Footer />}
    </div>
  );
}
