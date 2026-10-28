import { notFound } from "next/navigation";
import { SeasonFourGalaPreview } from "@/components/game/season-four-gala-preview";
import styles from "@/components/game/season-four-gala.module.css";
import { GalaSelectionPreview } from "./selection-preview";

export const metadata = { title: "Gala S4 · recette locale", robots: { index: false, follow: false } };
export default async function LocalGalaPreview({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query=await searchParams;
  if (query.selection === "1") return <GalaSelectionPreview />;
  const context=query.inscription==='1'?{isOpen:true,team:{id:'demo-team',name:'Équipe de démonstration'},program:null,selections:{},counts:{'world-tour':0,continental:0},riders:Array.from({length:9},(_,index)=>({rider_id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,first_name:'Coureur',last_name:`Démo ${index+1}`,mountain:index===8?76:70,hills:70,flat:70,time_trial:70,cobbles:70,sprint:70}))}:undefined;
  return <div className="game-workspace-background"><main className={styles.page} data-gala-s4-page><p className="p-3 text-center text-sm text-white">Aperçu local · données fictives</p><SeasonFourGalaPreview context={context} /></main></div>;
}
