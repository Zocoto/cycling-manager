"use client";

import { useState } from "react";
import Link from "@/components/ui/app-link";

export type NewsTickerItem = { id: string; title: string };
export function DashboardNewsTicker({ items }: { items: NewsTickerItem[] }) {
  const [paused, setPaused] = useState(false);
  return <section className="game-news-ticker flex h-10 min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-[#315B3E]/15 bg-white/75 px-3 text-[#315B3E]" aria-label="Dernières nouveautés" data-paused={paused}>
    <Link href="/jeu/nouveautes" className="shrink-0 rounded text-[10px] font-black uppercase tracking-wider text-[#278B70] focus-visible:outline-2">📣 <span className="hidden sm:inline">Nouveautés</span></Link>
    <div className="min-w-0 flex-1 overflow-hidden"><div className={`game-news-ticker-track flex w-max items-center gap-8 text-xs font-semibold ${items.length > 1 ? "game-news-ticker-animated" : ""}`}>
      {items.length ? <>{items.map((item) => <Link key={item.id} href={`/jeu/nouveautes/${item.id}`} className="shrink-0 rounded hover:text-[#176951] focus-visible:outline-2">{item.title}<span aria-hidden="true" className="ml-3 text-[#A66F3D]">→</span></Link>)}{items.length > 1 ? <span aria-hidden="true" className="flex items-center gap-8">{items.map((item) => <Link key={item.id} tabIndex={-1} href={`/jeu/nouveautes/${item.id}`} className="shrink-0 rounded hover:text-[#176951]">{item.title}<span className="ml-3 text-[#A66F3D]">→</span></Link>)}</span> : null}</> : <Link href="/jeu/nouveautes">Les actualités du jeu →</Link>}
    </div></div>
    {items.length > 1 ? <button type="button" aria-pressed={paused} aria-label={paused ? "Reprendre le défilement des nouveautés" : "Mettre les nouveautés en pause"} onClick={() => setPaused(!paused)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs hover:bg-[#EAF5F3] focus-visible:outline-2">{paused ? "▶" : "Ⅱ"}</button> : null}
    <style>{`@keyframes gameNewsTicker{from{transform:translateX(0)}to{transform:translateX(calc(-50% - 1rem))}}.game-news-ticker-animated{animation:gameNewsTicker 50s linear infinite}.game-news-ticker:hover .game-news-ticker-track,.game-news-ticker:focus-within .game-news-ticker-track,.game-news-ticker[data-paused=true] .game-news-ticker-track{animation-play-state:paused}@media(prefers-reduced-motion:reduce){.game-news-ticker-animated{animation:none}}`}</style>
  </section>;
}
