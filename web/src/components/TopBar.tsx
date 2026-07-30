import { useGameStore } from "../store/useGameStore";

export default function TopBar() {
  const { data, screen, formation, mode, difficulty } = useGameStore();
  const nSq = data?.squads.length ?? 0;
  const nPl = data ? data.squads.reduce((a, s) => a + s.players.length, 0) : 0;

  return (
    <header className="flex justify-between items-center px-6 py-3.5 border-b border-line bg-bg/70 backdrop-blur-md sticky top-0 z-20">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-black tracking-tight text-accent">
          7<span className="text-slate-400">–</span>0
        </span>
        <span className="text-[11px] tracking-[3px] text-slate-400 font-bold">IPL DRAFT · 2008–2026</span>
      </div>
      <div className="text-[13px] text-slate-400">
        {screen === "setup" ? `${nSq} real squads · ${nPl} players` : `${formation.name} · ${mode.name} · ${difficulty.name}`}
      </div>
    </header>
  );
}
