import { readFile } from "node:fs/promises";
import { notFound } from "next/navigation";
import Link from "@/components/ui/app-link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { WelcomeJourney } from "@/components/game/dashboard-assistant";
import { formatDashboardAssistantDate, type NewcomerJourneyStepKey } from "@/lib/game/dashboard-assistant";

export default async function NewcomerPreview({searchParams}:{searchParams:Promise<{chapter?:string}>}) {
  if(process.env.NODE_ENV==="production")notFound();
  const query=await searchParams;
  const chapter=Math.max(1,Math.min(4,Math.floor(Number(query.chapter))||3));
  const sql=await readFile("supabase/migrations/20260920140000_create_newcomer_welcome_journey.sql","utf8");
  const definitions=[...sql.matchAll(/\(\s*'([a-z_]+)',\s*(\d),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\s*\)/g)];
  const selected=definitions.slice((chapter-1)*2,chapter*2);
  const journey={enrolledAt:"2026-10-27T08:00:00Z",chapter:selected[0][3],wave:chapter,totalWaves:4,
    completedCount:chapter*2-1,claimedCount:chapter*2-1,totalCount:8,steps:selected.map((step,index)=>({
      key:step[1] as NewcomerJourneyStepKey,position:Number(step[2]),title:step[4],description:step[5],href:step[6],
      rewardCash:Number(step[7]),rewardExperience:Number(step[8]),completed:index===0,claimed:index===0,
    }))};
  return <main className="min-h-screen bg-[#EAF5F3] p-4 text-[#12312D] sm:p-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <p>Aperçu local · données fictives</p><LanguageSwitcher />
      </div>
      <nav className="mb-4 flex gap-3">{[1,2,3,4].map(wave=><Link key={wave} href={`/apercus/parcours-debutant?chapter=${wave}`}>{wave}/4</Link>)}</nav>
      <section className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9]">
        <header className="flex items-center justify-between gap-3 bg-[#0B302B] p-4 text-white">
          <h1>Assistant du DS</h1><time>{formatDashboardAssistantDate("2026-10-27")}</time>
        </header>
        <WelcomeJourney journey={journey} />
        <p className="p-4">15 quotidiennes · 4 entre DS · prochaine clôture 11:27</p>
      </section>
    </div>
  </main>;
}
