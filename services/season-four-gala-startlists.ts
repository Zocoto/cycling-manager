import "server-only";
import { strToU8,zipSync } from "fflate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GALA_EVENTS,SEASON_FOUR_GALA,type GalaEventKey,type GalaExportStatus } from "@/lib/game/season-four-gala";
import { buildSeasonFourGalaStartlists,selectSeasonFourGalaContracts,type GalaExportSnapshot,type GalaRegistration,type GalaSelection,type GalaNativeRatings } from "@/lib/game/season-four-gala-startlists";
import type {ContractRow} from "@/lib/game/pcm-export/types";

type Client=ReturnType<typeof createSupabaseAdminClient>;
type Query<T>={range:(from:number,to:number)=>{abortSignal:(signal:AbortSignal)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>}};
async function pages<T>(make:()=>Query<T>):Promise<T[]> {
 const rows:T[]=[];
 for(let from=0;;from+=1000){
  const result=await make().range(from,from+999).abortSignal(AbortSignal.timeout(5000));
  if(result.error)throw new Error(result.error.message);
  const page=result.data??[];rows.push(...page);if(page.length<1000)return rows;
 }
}
async function chunks<T>(ids:string[],make:(part:string[])=>Query<T>):Promise<T[]> {
 const rows:T[]=[];for(let index=0;index<ids.length;index+=200)rows.push(...await pages(()=>make(ids.slice(index,index+200))));return rows;
}
async function registrations(admin:Client) {
 const season=await admin.from('seasons').select('id,game_year').eq('game_year',SEASON_FOUR_GALA.sourceSeason).abortSignal(AbortSignal.timeout(5000)).single<{id:string;game_year:number}>();
 if(season.error||!season.data)throw new Error('La saison source du gala est indisponible.');
 const sourceSeason=season.data;
 const rows=await pages<GalaRegistration>(()=>admin.from('season_gala_registrations').select('id,team_id,program').eq('season_id',sourceSeason.id).order('id'));
 return {season:sourceSeason,rows};
}

export async function getSeasonFourGalaExportStatus():Promise<GalaExportStatus> {
 const {rows}=await registrations(createSupabaseAdminClient());
 return {counts:Object.fromEntries(GALA_EVENTS.map(event=>[event.key,rows.filter(row=>row.program===event.program).length]))};
}

export async function loadSeasonFourGalaStartlistSnapshot():Promise<GalaExportSnapshot> {
 const admin=createSupabaseAdminClient();const source=await registrations(admin);
 const snapshot:GalaExportSnapshot={season:source.season.game_year,registrations:source.rows,selections:[],teams:[],riders:[]};
 if(!source.rows.length)return snapshot;
 snapshot.selections=await chunks<GalaSelection>(source.rows.map(row=>row.id),ids=>admin.from('season_gala_registration_riders').select('registration_id,profile,rider_id,position').in('registration_id',ids).order('registration_id').order('profile').order('position'));
 const teamIds=[...new Set(source.rows.map(row=>row.team_id))];
 const teams=await chunks<{id:string;pcm_export_id:number|null}>(teamIds,ids=>admin.from('teams').select('id,pcm_export_id').in('id',ids).order('id'));
 const identities=await chunks<{team_id:string;display_name:string}>(teamIds,ids=>admin.from('team_seasons').select('team_id,display_name').eq('season_id',source.season.id).in('team_id',ids).order('team_id'));
 const names=new Map(identities.map(row=>[row.team_id,row.display_name]));snapshot.teams=teams.map(team=>({...team,name:names.get(team.id)??team.id}));
 const riderIds=[...new Set(snapshot.selections.map(row=>row.rider_id))];
 if(!riderIds.length)return snapshot;
 const riders=await chunks<{id:string;pcm_export_id:number|null;first_name:string;last_name:string}>(riderIds,ids=>admin.from('riders').select('id,pcm_export_id,first_name,last_name').in('id',ids).order('id'));
 const ratings=await chunks<GalaNativeRatings&{rider_id:string}>(riderIds,ids=>admin.from('rider_season_ratings').select('rider_id,mountain,hills,flat,time_trial,cobbles,sprint').eq('season_id',source.season.id).in('rider_id',ids).order('rider_id'));
 const contracts=await chunks<ContractRow>(riderIds,ids=>admin.from('rider_contracts').select('id,rider_id,team_id,start_season_id,end_season_id,salary_per_season,status,left_season_id,joined_day_number,signed_at').in('rider_id',ids).in('status',['active','completed']).order('id'));
 const seasons=await pages<{id:string;game_year:number}>(()=>admin.from('seasons').select('id,game_year').order('id'));
 const owners=new Map(selectSeasonFourGalaContracts(contracts,seasons).map(contract=>[contract.rider_id,contract.team_id]));
 const native=new Map(ratings.map(row=>[row.rider_id,row]));
 snapshot.riders=riders.map(rider=>({...rider,team_id:owners.get(rider.id)??'',native:native.get(rider.id)??{mountain:null,hills:null,flat:null,time_trial:null,cobbles:null,sprint:null}}));
 return snapshot;
}

export async function generateSeasonFourGalaStartlistExport(eventKey?:GalaEventKey,template=false) {
 // Explicit models never read player records and can never contain demo teams.
 const snapshot=template?{season:4,registrations:[],selections:[],teams:[],riders:[]}:await loadSeasonFourGalaStartlistSnapshot();
 const result=buildSeasonFourGalaStartlists(snapshot,eventKey,template);
 const generatedAt=new Date().toISOString();
 const manifest={formatVersion:1,season:4,generatedAt,template,ratingPolicy:{source:'rider_season_ratings',bonusesIncluded:false,continentalNativePrimaryCap:75},events:result.events};
 if(eventKey){
  const [path,xml]=Object.entries(result.files)[0];
  return {data:strToU8(xml),filename:path.split('/').at(-1)!,contentType:'application/xml',teamCount:result.teamCount,riderCount:result.riderCount,generatedAt,template};
 }
 const files=Object.fromEntries(Object.entries(result.files).map(([path,text])=>[path,strToU8(text)]));
 files['manifest.json']=strToU8(JSON.stringify(manifest,null,2)+'\n');
 files['LISEZ-MOI.txt']=strToU8([
  'Gala S4 — 6 novembre 2026 — notes natives uniquement, sans équipement.',
  template?'MODÈLES SANS INSCRITS : seules l’équipe de simulation et ses sept coureurs sont présents.':'Startlists des inscriptions enregistrées, sans suppression ni troncature.',
  '7 à 8 coureurs par club. Une seule équipe de simulation est ajoutée.',
  'Utiliser la base PCM Gala S4 compatible 7–8 coureurs proposée sur la page privée.',
  'Copier un seul programme à la fois dans %APPDATA%\\Pro Cycling Manager 2026\\Cloud\\Startlists\\.',
  'World-Tour et Continental utilisent les mêmes XML natifs pour montagne et vallons. Ne pas les copier simultanément.',
  'Ne jamais renommer les XML : leurs noms correspondent aux courses de la base PCM, pas aux variantes CDS/ZCES.',
  'Montagne : Tour de France, variante 2022, étape 18 uniquement (Lourdes–Hautacam), en mode étape.',
  'Vallons : Limburg Green Race / Amstel, variante 2023. Pavés : Paris–Roubaix, variante 2026. Sprint : Scheldetour Vlaanderen / Escaut, variante 2026.',
 ].join('\r\n'));
 return {data:zipSync(files,{level:6}),filename:`Cyclostratege-Gala-S4-${template?'Modeles':'Startlists'}.zip`,contentType:'application/zip',teamCount:result.teamCount,riderCount:result.riderCount,generatedAt,template};
}
