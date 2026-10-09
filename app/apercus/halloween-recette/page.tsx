import { notFound } from "next/navigation";
import { HalloweenEvent } from "@/components/halloween/halloween-event";
import { GameHeader } from "@/components/game/game-header";
import type { HalloweenState } from "@/lib/game/halloween-event";
import "@/components/halloween/halloween.css";
import "@/app/jeu/mobile.css";
export default async function LocalHalloweenReview({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  if (process.env.NODE_ENV === "production" || process.env.HALLOWEEN_LOCAL_REVIEW !== "1") notFound();
  const state: HalloweenState={state:"open",startsAt:"2026-10-08T22:00Z",endsAt:"2026-11-02T23:00Z",shopEndsAt:"2026-11-09T23:00Z",joined:true,coins:240,tickets:1,inventory:{"lord-vlad":1,"pumpkin-cap":1,"pumpkin-juice":1},obtained:{"lord-vlad":1,"pumpkin-cap":1,"pumpkin-juice":1},purchases:{"lord-vlad":1,"pumpkin-cap":1,"pumpkin-juice":1},cosmetics:{outfit:"lord-vlad",hat:"pumpkin-cap"},curse:null,pendingGift:null,bandages:0,attempts:0,drawn:false,activeRun:null,ranking:[{name:"DS fictif · recette locale",userId:"review",score:3940,distance:2240,coins:68}],dailyRanking:[],riders:[],targets:[],projects:[]};
  const { onglet = "accueil" } = await searchParams;
  if (onglet === "boutons") {
    return <div className="game-shell"><GameHeader displayName="Recette locale" /><main className="mx-auto grid max-w-4xl gap-4 p-6 text-[#29231f]">
      <h1 className="text-2xl font-black">Contrôle local du thème des boutons</h1>
      <a href="#" data-review-action="card" className="group rounded-xl bg-[#0B302B] p-4 text-white"><span data-site-action-icon className="bg-[#42B99A]/15 text-[#9BE0BC]">★</span> Raccourci du bureau</a>
      <a href="#" data-review-action="footer" className="bg-white px-4 py-3 text-[#176951]">Lien sans arrondi</a>
      <a href="#" data-review-action="gradient" data-site-action="dark" className="bg-[linear-gradient(105deg,#071A17_0%,#0B302B_62%,#176951_100%)] px-4 py-3 text-white">Fédération</a>
      <button type="button" data-review-action="primary" className="rounded-xl bg-[#42B99A] px-4 py-3 text-white">Action principale</button>
      <button type="button" data-review-action="disabled" disabled className="rounded-xl bg-[#176951] px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-45">Action indisponible</button>
      <button type="button" data-review-action="variable" style={{ "--fan-primary": "#176951" } as React.CSSProperties} className="rounded-xl bg-[var(--fan-primary)] px-4 py-3 text-white">Bouton du fan-club</button>
      <button type="button" data-review-action="selected" aria-pressed="true" className="rounded-xl bg-[#EAF5F3] px-4 py-3 text-[#176951]">Onglet sélectionné</button>
      <div data-site-theme="default"><button type="button" data-review-action="default" className="rounded-xl bg-[#176951] px-4 py-3 text-white">Thème normal préservé</button></div>
      <div data-site-theme-preserve><button type="button" data-review-action="preserved" className="rounded-xl bg-[#176951] px-4 py-3 text-white">Couleur protégée</button></div>
      <p data-review-action="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">Message de succès préservé</p>
      <button type="button" data-review-action="danger" className="rounded-xl bg-[#EF5B65] px-4 py-3 text-white">Action destructive préservée</button>
      <button type="button" data-review-action="chat" className="mobile-chat-bubble rounded-full bg-[#0B302B] p-3 text-white" aria-label="Chat local">✉</button>
    </main></div>;
  }
  state.avatarKey = "director_m_01~halloween~vlad,cap";
  return <div className="game-shell"><GameHeader displayName="Recette locale" /><HalloweenEvent key={onglet} initial={state} initialTab={onglet}/></div>;
}
