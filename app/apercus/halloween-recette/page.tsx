import { notFound } from "next/navigation";
import { HalloweenEvent } from "@/components/halloween/halloween-event";
import type { HalloweenState } from "@/lib/game/halloween-event";
import "@/components/halloween/halloween.css";
export default async function LocalHalloweenReview({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  if (process.env.NODE_ENV === "production" || process.env.HALLOWEEN_LOCAL_REVIEW !== "1") notFound();
  const state: HalloweenState={state:"open",startsAt:"2026-10-08T22:00Z",endsAt:"2026-11-02T23:00Z",shopEndsAt:"2026-11-09T23:00Z",joined:true,coins:240,tickets:1,inventory:{"lord-vlad":1,"pumpkin-cap":1,"pumpkin-juice":1},obtained:{"lord-vlad":1,"pumpkin-cap":1,"pumpkin-juice":1},purchases:{"lord-vlad":1,"pumpkin-cap":1,"pumpkin-juice":1},cosmetics:{outfit:"lord-vlad",hat:"pumpkin-cap"},curse:null,pendingGift:null,bandages:0,attempts:0,drawn:false,activeRun:null,ranking:[{name:"DS fictif · recette locale",userId:"review",score:3940,distance:2240,coins:68}],dailyRanking:[],riders:[],targets:[],projects:[]};
  const { onglet = "accueil" } = await searchParams;
  state.avatarKey = "director_m_01~halloween~vlad,cap";
  return <HalloweenEvent key={onglet} initial={state} initialTab={onglet}/>;
}
