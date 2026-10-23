import { createPcmStartlistXml, PCM_SPECTATOR_RIDER_IDS, PCM_SPECTATOR_TEAM_ID, type PcmStartlistTeam } from "./pcm-gala-startlists";
import { GALA_EVENTS, GALA_PROGRAM_PROFILES, SEASON_FOUR_GALA, galaClubCapacity, type GalaEventKey, type GalaProfile, type GalaProgram } from "./season-four-gala";
import type { ContractRow, SeasonRow } from "./pcm-export/types";

export type GalaNativeRatings = Record<"mountain"|"hills"|"flat"|"time_trial"|"cobbles"|"sprint",number|string|null>;
export const GALA_NATIVE_PRIMARY_KEYS = ["mountain","hills","flat","time_trial","cobbles","sprint"] as const;
export type GalaRegistration = {id:string;team_id:string;program:GalaProgram};
export type GalaSelection = {registration_id:string;profile:GalaProfile;rider_id:string;position:number};
export type GalaExportSnapshot = {
 season:number;
 registrations:GalaRegistration[];
 selections:GalaSelection[];
 teams:{id:string;pcm_export_id:number|null;name:string}[];
 riders:({id:string;pcm_export_id:number|null;first_name:string;last_name:string;team_id:string;native:GalaNativeRatings})[];
};
export class GalaStartlistError extends Error {}

export function selectSeasonFourGalaContracts(contracts:ContractRow[],seasons:Pick<SeasonRow,'id'|'game_year'>[]) {
 const years=new Map(seasons.map(season=>[season.id,season.game_year]));
 const eligible=contracts.filter(contract=>['active','completed'].includes(contract.status)
  &&(years.get(contract.start_season_id)??Infinity)<=4&&(years.get(contract.end_season_id)??-Infinity)>=4
  &&(!contract.left_season_id||(years.get(String(contract.left_season_id))??-Infinity)>4));
 eligible.sort((a,b)=>(years.get(b.start_season_id)??0)-(years.get(a.start_season_id)??0)
  ||Number(b.joined_day_number??1)-Number(a.joined_day_number??1)||String(b.signed_at??'').localeCompare(String(a.signed_at??''))||a.id.localeCompare(b.id));
 return [...new Map(eligible.reverse().map(contract=>[contract.rider_id,contract])).values()];
}

export function hasContinentalNativeRatings(ratings:GalaNativeRatings):boolean {
 return GALA_NATIVE_PRIMARY_KEYS.every(key=>ratings[key]!==null&&ratings[key]!==undefined&&String(ratings[key]).trim()!==''&&Number.isFinite(Number(ratings[key]))&&Number(ratings[key])>=1&&Number(ratings[key])<=SEASON_FOUR_GALA.primaryCap);
}

export function buildSeasonFourGalaStartlists(snapshot:GalaExportSnapshot, eventKey?:GalaEventKey, template=false) {
 if(snapshot.season!==SEASON_FOUR_GALA.sourceSeason)throw new GalaStartlistError('La source du gala doit être la saison 4.');
 const events=eventKey?GALA_EVENTS.filter(event=>event.key===eventKey):GALA_EVENTS;
 if(!events.length)throw new GalaStartlistError('Course du gala inconnue.');
 const files:Record<string,string>={};
 const manifests:Record<string,unknown>[]=[];
 const teamsById=new Map(snapshot.teams.map(team=>[team.id,team]));
 const ridersById=new Map(snapshot.riders.map(rider=>[rider.id,rider]));
 const registeredTeams=new Set<string>();let riderCount=0;
 const programsByTeam=new Map<string,string>();
 const registrationsById=new Map(snapshot.registrations.map(row=>[row.id,row]));
 const selectionsByProfile=new Map<string,GalaSelection[]>();
 for(const registration of snapshot.registrations){
  if(programsByTeam.has(registration.team_id))throw new GalaStartlistError('Une équipe ne peut participer qu’à un seul programme.');
  programsByTeam.set(registration.team_id,registration.program);
 }
 for(const selection of snapshot.selections){
  const registration=registrationsById.get(selection.registration_id);
  if(!registration||!GALA_PROGRAM_PROFILES[registration.program]?.includes(selection.profile))throw new GalaStartlistError('Une composition appartient à un profil incompatible avec le programme.');
  const key=selection.registration_id+':'+selection.profile;
  const list=selectionsByProfile.get(key)??[];list.push(selection);selectionsByProfile.set(key,list);
 }
 for(const event of events){
  const registrations=template?[]:snapshot.registrations.filter(row=>row.program===event.program && selectionsByProfile.has(row.id+':'+event.profile))
   .sort((a,b)=>(teamsById.get(a.team_id)?.name??a.team_id).localeCompare(teamsById.get(b.team_id)?.name??b.team_id,'fr'));
  if(!template&&!registrations.length){
   if(eventKey)throw new GalaStartlistError('Aucune inscription enregistrée pour cette course. Le modèle XML reste disponible.');
   continue;
  }
  if(registrations.length>galaClubCapacity(event.course))throw new GalaStartlistError(`Capacité PCM dépassée : ${registrations.length} clubs pour ${galaClubCapacity(event.course)} places. Un arbitrage est nécessaire ; aucune équipe n’a été retirée.`);
  const teams:PcmStartlistTeam[]=[{teamId:PCM_SPECTATOR_TEAM_ID,riderIds:[...PCM_SPECTATOR_RIDER_IDS]}];
  const manifestTeams:Record<string,unknown>[]=[];
  for(const registration of registrations){
   const team=teamsById.get(registration.team_id);
   if(!team||!Number.isSafeInteger(team.pcm_export_id)||Number(team.pcm_export_id)<=0||team.pcm_export_id===PCM_SPECTATOR_TEAM_ID)throw new GalaStartlistError('Identifiant PCM permanent d’équipe absent ou réservé.');
   const selections=[...(selectionsByProfile.get(registration.id+':'+event.profile)??[])].sort((a,b)=>a.position-b.position);
   if(selections.length<SEASON_FOUR_GALA.minRiders||selections.length>SEASON_FOUR_GALA.maxRiders||selections.some((row,index)=>row.position!==index+1))throw new GalaStartlistError(`Composition invalide pour ${team.name} : 7 à 8 coureurs sont requis, sans position manquante.`);
   const riders=selections.map(selection=>{
    const rider=ridersById.get(selection.rider_id);
    if(!rider||rider.team_id!==registration.team_id)throw new GalaStartlistError('Un coureur sélectionné n’appartient plus à l’équipe pour la saison source.');
    if(!Number.isSafeInteger(rider.pcm_export_id)||Number(rider.pcm_export_id)<=0||(PCM_SPECTATOR_RIDER_IDS as readonly number[]).includes(Number(rider.pcm_export_id)))throw new GalaStartlistError('Identifiant PCM permanent de coureur absent ou réservé.');
    if(event.program==='continental'&&!hasContinentalNativeRatings(rider.native))throw new GalaStartlistError(`Plafond Continental dépassé ou notes natives manquantes pour ${rider.first_name} ${rider.last_name} : 75 maximum dans chaque note primaire, sans bonus d’équipement.`);
    return rider;
   });
   teams.push({teamId:Number(team.pcm_export_id),riderIds:riders.map(rider=>Number(rider.pcm_export_id))});
   registeredTeams.add(registration.team_id);riderCount+=riders.length;
   manifestTeams.push({team:team.name,pcmTeamId:team.pcm_export_id,riders:riders.map(rider=>({name:`${rider.first_name} ${rider.last_name}`,pcmRiderId:rider.pcm_export_id}))});
  }
  const folder=event.program==='world-tour'?'World-Tour':'Continental';
  const filename=`${folder}/${event.course.startlistFilename}`;
  try {
   const xml=createPcmStartlistXml(teams);
   files[filename]=template?xml.replace('<startlist>','<!-- MODELE SANS INSCRITS / TEMPLATE WITHOUT ENTRANTS -->\r\n<startlist>'):xml;
  } catch(error) {
   throw new GalaStartlistError(error instanceof Error?error.message:'Composition PCM invalide.');
  }
  manifests.push({eventKey:event.key,file:filename,course:event.course.name,variant:event.course.filename,nativeCapacity:event.course.nativeCapacity,clubCapacity:galaClubCapacity(event.course),spectatorTeamIncluded:true,registeredTeams:registrations.length,teams:manifestTeams});
 }
 if(!template&&!manifests.length)throw new GalaStartlistError('Aucune inscription enregistrée pour cette course. Le modèle XML reste disponible.');
 return {files,events:manifests,teamCount:registeredTeams.size,riderCount,template};
}
