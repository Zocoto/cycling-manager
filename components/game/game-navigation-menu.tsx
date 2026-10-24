"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import Link from "@/components/ui/app-link";
import {useLocale} from "@/components/i18n/locale-provider";
import {GameNavigationIcon} from "./game-navigation-icon";
import {canAccessPrivateAdmin} from "@/lib/game/private-admin-access";
import {getGameNavigationGroups,getActiveGameNavigationHref,NAVIGATION_EVENTS_FR,NAVIGATION_EVENTS_EN} from "@/lib/game/game-navigation";

export {NAVIGATION_GROUPS_FR,NAVIGATION_GROUPS_EN} from "@/lib/game/game-navigation";

export function GameNavigationMenu({viewerEmail,federationCountryCode,showJerseyWorkshop=false}: {
  viewerEmail?: string|null;
  federationCountryCode?: string|null;
  showJerseyWorkshop?: boolean;
}) {
  const {locale}=useLocale();
  const pathname=usePathname()??"";
  const english=locale==="en";
  const groups=getGameNavigationGroups({locale,federationCountryCode,showJerseyWorkshop});
  const events=english?NAVIGATION_EVENTS_EN:NAVIGATION_EVENTS_FR;
  const activeHref=getActiveGameNavigationHref(groups,pathname);
  const showPrivateAdmin=canAccessPrivateAdmin(viewerEmail);
  const menuRef=useRef<HTMLDetailsElement>(null);
  const summaryRef=useRef<HTMLElement>(null);
  const [open,setOpen]=useState(false);

  const closeMenu=useCallback(()=>{if(menuRef.current)menuRef.current.open=false;},[]);
  useEffect(()=>{
    if(!open)return;
    function onPointerDown(event:PointerEvent) {
      if(event.target instanceof Node&&!menuRef.current?.contains(event.target))closeMenu();
    }
    function onKeyDown(event:KeyboardEvent) {
      if(event.key!=="Escape")return;
      closeMenu();summaryRef.current?.focus();
    }
    document.addEventListener("pointerdown",onPointerDown);
    document.addEventListener("keydown",onKeyDown);
    return ()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKeyDown);};
  },[open,closeMenu]);

  return <details ref={menuRef} onToggle={event=>setOpen(event.currentTarget.open)} className="group relative hidden shrink-0 sm:block">
    <summary ref={summaryRef} className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-[#D6DFD2]/25 bg-white/5 text-xs font-extrabold uppercase tracking-[0.12em] text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:h-10 sm:w-auto sm:px-3 [&::-webkit-details-marker]:hidden">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13"/></svg>
      <span className="hidden sm:inline">Menu</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="hidden h-3.5 w-3.5 transition group-open:rotate-180 sm:block" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 8 4 4 4-4"/></svg>
    </summary>
    <div data-game-navigation-panel className="absolute -left-16 top-[calc(100%+0.75rem)] z-50 max-h-[calc(100dvh-8rem)] w-[min(42rem,calc(100vw-5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-[#78947D]/45 bg-[#102D27] shadow-2xl shadow-black/45 lg:w-[min(58rem,calc(100vw-16rem))]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#78947D]/30 bg-[#071A17] px-5 py-4">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--game-header-accent)]">Navigation</p>
          <p className="mt-1 text-sm font-semibold text-[#FFFDF4]">{english?"Your team, at a glance":"Votre équipe, en un coup d’œil"}</p></div>
        <Link href="/jeu" prefetchOnIntent showPendingIndicator={false} onNavigate={closeMenu} aria-current={pathname==="/jeu"?"page":undefined} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-black text-[#FFFDF4] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="m2 9 8-7 8 7M4 8v10h12V8M8 18v-6h4v6"/></svg>
          {english?"DS office":"Bureau du DS"}
        </Link>
      </header>
      <nav aria-label={english?"Main game navigation":"Navigation principale du jeu"} className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {groups.map(group=><section key={group.id} data-navigation-group={group.id} className="min-w-0 rounded-xl border border-white/8 bg-white/[0.025] p-2">
          <h2 className="mb-1 flex min-h-10 items-center gap-2 px-2 text-[11px] font-extrabold text-[#9BE0CA]"><GameNavigationIcon group={group.id} className="h-4 w-4 shrink-0"/>{group.label}</h2>
          <div className="space-y-0.5">{group.links.map(([label,href])=>{
            const active=href===activeHref;
            return <Link key={href} href={href} prefetchOnIntent showPendingIndicator={false} onNavigate={closeMenu} aria-current={active?"page":undefined} className={`flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-semibold leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] ${active?"bg-white/10 text-[var(--game-header-accent)]":"text-[#FFFDF4] hover:bg-white/8"}`}>
              {href.startsWith("/jeu/federations/")?<span aria-hidden="true" className={`fi fi-${href.slice(-2)} shrink-0 text-base`}/>:null}
              <span>{label}</span>
            </Link>;
          })}</div>
        </section>)}
      </nav>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#78947D]/30 px-5 py-3">
        <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-[#9BE0CA]">{english?"Events":"Événements"}</span>
        {events.map(([label,href])=><Link key={href} href={href} prefetchOnIntent showPendingIndicator={false} onNavigate={closeMenu} className="rounded-lg border border-[#F2C94C]/25 bg-[#F2C94C]/8 px-3 py-2 text-xs font-bold text-[#FFE58A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]">{label} ↗</Link>)}
      </div>
      {showPrivateAdmin?<div className="space-y-2 border-t border-[#78947D]/30 bg-[#071A17] p-3 sm:px-5">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#9BE0CA]">Administration</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/jeu/suivi-joueurs" prefetchOnIntent showPendingIndicator={false} onNavigate={closeMenu} className="rounded-xl border border-[#F2C94C]/25 px-3 py-2.5 text-xs font-bold text-[#FFFDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]">{english?"Player tracking":"Suivi des joueurs"} →</Link>
          <Link href="/jeu/export-pcm" prefetchOnIntent showPendingIndicator={false} onNavigate={closeMenu} className="rounded-xl border border-[#9BE0CA]/25 px-3 py-2.5 text-xs font-bold text-[#FFFDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]">{english?"PCM26 export":"Export PCM26"} →</Link>
        </div>
      </div>:null}
    </div>
  </details>;
}
