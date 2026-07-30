import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "./store/useGameStore";
import TopBar from "./components/TopBar";
import SetupScreen from "./components/SetupScreen";
import DraftScreen from "./components/DraftScreen";
import StyleScreen from "./components/StyleScreen";
import ResultScreen from "./components/ResultScreen";
import Footer from "./components/Footer";

export default function App() {
  const { data, dataError, loadData, screen } = useGameStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1">
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
            >
              {screen === "setup" && <SetupScreen />}
              {screen === "draft" && <DraftScreen />}
              {screen === "style" && <StyleScreen />}
              {screen === "result" && <ResultScreen />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <Footer />
    </div>
  );
}
