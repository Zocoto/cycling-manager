import type {ReactNode} from "react";
import Link from "@/components/ui/app-link";
import {getGameNavigationGroups,type GameNavigationGroupId} from "@/lib/game/game-navigation";
import {GameNavigationIcon} from "./game-navigation-icon";

const descriptions:Record<GameNavigationGroupId,string>={
  team:"Gérer les coureurs, leur progression et les talents de demain.",
  races:"Planifier les engagements, préparer les courses et suivre les résultats.",
  equipment:"Acheter, attribuer et améliorer le matériel de l’équipe.",
  club:"Piloter les ressources, les partenaires et le développement du club.",
  federation:"Retrouver la vie fédérale, les convocations et les championnats.",
  community:"Suivre le peloton, échanger et retrouver les règles du jeu.",
};

// Server-rendered, using only the dashboard's existing data. The additional
// shortcuts use AppLink's hook-free, non-prefetching path; opening this section
// never fetches the pages, their counts or their business data.
export function DashboardManagementNavigation({federationCountryCode,showJerseyWorkshop=false,riderCount,teamRank,balanceLabel,fanClubStatus}: {
  federationCountryCode?:string|null;
  showJerseyWorkshop?:boolean;
  riderCount?:number;
  teamRank?:number|null;
  balanceLabel?:string|null;
  fanClubStatus?:ReactNode;
}) {
  const groups=getGameNavigationGroups({federationCountryCode,showJerseyWorkshop});
  return <section aria-labelledby="dashboard-management-title" className="mt-5 sm:mt-7">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
      <h2 id="dashboard-management-title" className="text-lg font-black text-[#183F37]">Gérer votre équipe</h2>
      <p className="text-xs font-semibold text-[#60756E]">Les mêmes rubriques que dans le menu</p>
    </header>
    <div className="grid items-stretch gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map(group=>{
        const badge=group.id==="team"&&riderCount!==undefined?(riderCount===1?"1 coureur":`${riderCount} coureurs`)
          :group.id==="races"&&teamRank?`#${teamRank} UCI`
          :group.id==="club"?balanceLabel:null;
        return <section key={group.id} data-dashboard-navigation-group={group.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0B302B] text-[#FFFDF4] shadow-[0_12px_32px_rgba(7,26,23,0.13)]">
          <header className="border-b border-white/10 bg-white/[0.035] px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#42B99A]/15 text-[#9BE0BC]"><GameNavigationIcon group={group.id}/></span>
              <div className="min-w-0 flex-1"><h3 className="text-sm font-black leading-5">{group.label}</h3>
                {badge?<p className="mt-1 text-[11px] font-bold text-[#9BE0BC]">{badge}</p>:null}</div>
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-[#BFD1C6]">{descriptions[group.id]}</p>
          </header>
          <nav aria-label={group.label} className="grid flex-1 content-start gap-0.5 p-2">
            {group.links.map(([label,href])=><Link key={href} href={href} prefetch={false} showPendingIndicator={false} className="group/link flex min-h-10 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[13px] font-semibold leading-5 transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A]">
              <span className="inline-flex items-center gap-2">{href==="/jeu/centre-de-soin"?<svg data-navigation-medical-icon aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 shrink-0 text-[#9BE0BC]"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/></svg>:null}{label}</span><span aria-hidden="true" className="text-[#9BE0BC]/65 transition group-hover/link:translate-x-0.5 group-hover/link:text-[#9BE0BC]">→</span>
            </Link>)}
          </nav>
          {group.id==="club"?fanClubStatus:null}
        </section>;
      })}
    </div>
  </section>;
}
