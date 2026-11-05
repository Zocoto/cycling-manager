/**
 * Offline, bounded SQL producer. This script never opens a database connection.
 *
 * Before rollover (identity evidence, never final sporting results):
 *   npx tsx scripts/export-cyclo-stickers-s4.ts stage-sql <new-directory>
 *   Execute 01-context.sql, 02-riders.sql, 03-teams.sql READ ONLY, ONE AT A TIME,
 *   saving their result arrays as 01-context.json, 02-riders.json, 03-teams.json.
 *   npx tsx scripts/export-cyclo-stickers-s4.ts stage <results-directory> <new-stage.json>
 *
 * A stage contains provisional top-200 + known S4 champions (at most 213
 * profiles). It preserves the actual S4 selected jersey before S5 activation
 * replaces selected_jersey_id on continuing contracts. It cannot be sealed or
 * installed as an album. Missing later finalists must never use S5 fallbacks.
 *
 * After S4 is completed:
 *   npx tsx scripts/export-cyclo-stickers-s4.ts final-sql <new-directory>
 *   Read 01-context.sql first; stop while sourceSeasonStatus is active. Run
 *   the remaining seven queries sequentially, saving matching .json arrays.
 *   npx tsx scripts/export-cyclo-stickers-s4.ts completed <reviewed-stage.json> <results-directory> <new-source.json>
 *   Then use prepare-cyclo-stickers-s4.ts, review, and seal-cyclo-stickers-s4.ts.
 *   No command in this script executes SQL or installs/enables an edition.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { SPONSORS } from "../data/sponsors";
import { isAmateurJerseyPattern } from "../lib/amateur-team";
import { createAmateurRiderJersey, createSponsoredRiderJersey, type RiderJerseyAppearance } from "../lib/rider-jersey";
import { CYCLO_STICKERS_FINAL_TITLE_SLOTS, createCycloStickersFinalSnapshot, serializeCycloStickersSnapshot, type CycloStickersFinalSource } from "../lib/game/cyclo-stickers-final-snapshot";
import { createHash } from "node:crypto";

const sqlInstant=`to_char(transaction_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const titleSlots=CYCLO_STICKERS_FINAL_TITLE_SLOTS.map(slot=>`'${slot}'`).join(",");
const stageSource=`source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='active'
  and not exists(select 1 from public.seasons where status='active' and game_year>=5) limit 1)`;
const stageMembership=`${stageSource}, ranked as materialized (
  select summary.rider_id,summary.uci_rank from public.rider_season_summaries summary join source on source.id=summary.season_id
  where summary.uci_rank between 1 and 200 order by summary.uci_rank,summary.rider_id limit 200
), champions as materialized (
  select title.rider_id,title.championship_type from public.rider_national_championship_titles title
  join source on source.id=title.season_id join public.race_editions edition on edition.id=title.race_edition_id and edition.season_id=source.id and edition.status='completed'
  where title.championship_type in (${titleSlots}) order by title.championship_type,title.id limit 14
), members as materialized (select rider_id from ranked union select rider_id from champions)`;

function readOnlySql(label:string,query:string) {
  return `-- READ ONLY. Run sequentially, inspect its result, then continue. No fixtures, locks or gameplay mutations.\nbegin read only;\nset local application_name='cyclo-stickers-s4-${label}';\nset local statement_timeout='4s';\nset local lock_timeout='300ms';\nset local idle_in_transaction_session_timeout='8s';\n${query.trim()}\ncommit;\n`;
}

// Aliases team_season and source belong to the enclosing query. The active
// contract must cover S4. Pending S5 jerseys are deliberately never selected.
const teamEvidenceSql=`jsonb_build_object(
  'sourceSeasonId',source.id,'teamId',team_season.team_id,'teamName',team_season.display_name,
  'amateurPattern',team.amateur_jersey_pattern,'amateurPrimaryColor',team.amateur_jersey_primary_color,
  'amateurSecondaryColor',team.amateur_jersey_secondary_color,'amateurAccentColor',team.amateur_jersey_accent_color,
  'sponsorContracts',coalesce((select jsonb_agg(jsonb_build_object('contractId',principal.id,'startSeasonId',principal.start_season_id,
    'startGameYear',starts.game_year,'contractDurationSeasons',principal.contract_duration_seasons,'sponsorCatalogKey',sponsor.catalog_key,
    'jerseyId',principal.selected_jersey_id,'jerseyStyle',principal.selected_jersey_style) order by principal.created_at,principal.id)
    from public.team_sponsor_contracts principal join public.seasons starts on starts.id=principal.start_season_id
    join public.sponsors sponsor on sponsor.id=principal.sponsor_id where principal.team_id=team_season.team_id and principal.role='principal'
      and principal.status='active' and starts.game_year<=4 and starts.game_year+principal.contract_duration_seasons-1>=4),'[]'::jsonb))`;

export function buildCycloStickersS4StageQueries():Record<string,string> {
  return {
    "01-context.sql":readOnlySql("stage-context",`select id as "sourceSeasonId",game_year as "sourceSeason",status as "sourceSeasonStatus",
      starts_on::text as "startsOn",ends_on::text as "endsOn",${sqlInstant} as "capturedAt",
      (select max(game_year) from public.seasons where status='active') as "activeSeason"
      from public.seasons where game_year=4 limit 1;`),
    "02-riders.sql":readOnlySql("stage-riders",`with ${stageMembership}
      select source.id as "sourceSeasonId",source.status as "sourceSeasonStatus",${sqlInstant} as "capturedAt",
        (select count(*) from members)::integer as "membershipCount",(select count(*) from champions)::integer as "championshipCount",
        rider.id as "riderId",rider.first_name as "firstName",rider.last_name as "lastName",country.name as "country",country.iso_alpha2 as "countryCode",
        rider.avatar_profile_key as "avatarProfileKey",rider.avatar_seed::text as "avatarSeed",ranked.uci_rank as "provisionalUciRank",
        coalesce((select jsonb_agg(championship_type order by championship_type) from champions where rider_id=rider.id),'[]'::jsonb) as "knownChampionships",
        contract.id as "contractId",contract.start_season_id as "contractStartSeasonId",contract.end_season_id as "contractEndSeasonId",
        starts.game_year as "contractStartGameYear",ends.game_year as "contractEndGameYear",contract.status as "contractStatus",
        ${teamEvidenceSql} as "team"
      from members join source on true left join public.riders rider on rider.id=members.rider_id
      left join public.countries country on country.id=rider.country_id left join ranked on ranked.rider_id=rider.id
      left join public.rider_contracts contract on contract.rider_id=rider.id and contract.status='active'
      left join public.seasons starts on starts.id=contract.start_season_id and starts.game_year<=4
      left join public.seasons ends on ends.id=contract.end_season_id and ends.game_year>=4
      left join public.team_seasons team_season on team_season.team_id=contract.team_id and team_season.season_id=source.id
      left join public.teams team on team.id=team_season.team_id
      order by rider.id limit 213;`),
    "03-teams.sql":readOnlySql("stage-teams",`with ${stageSource}
      select source.id as "sourceSeasonId",source.status as "sourceSeasonStatus",${sqlInstant} as "capturedAt",
        team_season.final_rank as "provisionalUciRank",${teamEvidenceSql} as "team"
      from public.team_seasons team_season join source on source.id=team_season.season_id
      left join public.teams team on team.id=team_season.team_id
      where team_season.status<>'withdrawn' and team_season.final_rank between 1 and 5
      order by team_season.final_rank,team_season.team_id limit 6;`),
  };
}

const completedSource=`source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='completed' limit 1)`;
const completedChampions=`champions as materialized (
  select title.rider_id,title.championship_type,title.race_edition_id,edition.status from public.rider_national_championship_titles title
  join source on source.id=title.season_id join public.race_editions edition on edition.id=title.race_edition_id and edition.season_id=source.id
  where title.championship_type in (${titleSlots}) order by title.championship_type,title.id limit 14)`;
const completedMembers=`${completedSource}, ranked as materialized (
  select summary.rider_id,summary.uci_rank from public.rider_season_summaries summary join source on source.id=summary.season_id
  where summary.uci_rank between 1 and 50 order by summary.uci_rank,summary.rider_id limit 51
), ${completedChampions}, members as materialized (select rider_id from ranked union select rider_id from champions)`;

/** Final facts use only season-bound S4 rows. No current rider/jersey service. */
export function buildCycloStickersS4CompletedQueries():Record<string,string>{
  return {
    "01-context.sql":readOnlySql("final-context",`select id as "sourceSeasonId",game_year as "sourceSeason",status as "sourceSeasonStatus",
      starts_on::text as "startsOn",ends_on::text as "endsOn",${sqlInstant} as "capturedAt" from public.seasons where game_year=4 limit 1;`),
    "02-ranking.sql":readOnlySql("final-ranking",`with ${completedSource}
      select source.id as "sourceSeasonId",summary.rider_id as "riderId",summary.uci_rank as rank,coalesce(summary.points,0) as points,coalesce(summary.victories,0) as victories
      from public.rider_season_summaries summary join source on source.id=summary.season_id
      where summary.uci_rank between 1 and 50 order by summary.uci_rank,summary.rider_id limit 51;`),
    "03-teams.sql":readOnlySql("final-teams",`with ${completedSource}
      select source.id as "sourceSeasonId",team.team_id as "teamId",team.final_rank as rank,team.display_name as name,team.points
      from public.team_seasons team join source on source.id=team.season_id where team.status<>'withdrawn' and team.final_rank between 1 and 5
      order by team.final_rank,team.team_id limit 6;`),
    "04-championships.sql":readOnlySql("final-titles",`with ${completedSource},${completedChampions}
      select source.id as "sourceSeasonId",champions.championship_type as type,champions.rider_id as "riderId",champions.race_edition_id as "raceEditionId",
        champions.status as "raceStatus",'pro'::text as category from champions join source on true order by champions.championship_type;`),
    "05-ratings.sql":readOnlySql("final-ratings",`with ${completedMembers}
      select rating.rider_id as "riderId",rating.season_id as "sourceSeasonId",rating.age,rating.mountain,rating.hills,rating.flat,rating.time_trial as "timeTrial",rating.cobbles,
        rating.sprint,rating.acceleration,rating.downhill,rating.endurance,rating.resistance,rating.recovery,rating.breakaway,rating.prologue
      from public.rider_season_ratings rating join source on source.id=rating.season_id join members on members.rider_id=rating.rider_id order by rating.rider_id limit 64;`),
    "06-honours.sql":readOnlySql("final-honours",`with ${completedMembers}, honours as (
      select roster.rider_id as "riderId",source.id as "sourceSeasonId",edition.id as "raceEditionId",edition.display_name as "raceName",category.code as "categoryCode",
        'race'::text as kind,1::integer as count,result.final_rank::integer as rank
      from public.race_results result join public.race_rosters roster on roster.id=result.race_roster_id join members on members.rider_id=roster.rider_id
      join public.race_editions edition on edition.id=result.race_edition_id and edition.status='completed' join source on source.id=edition.season_id
      join public.races race on race.id=edition.race_id join public.race_categories category on category.id=edition.race_category_id
      where result.status='classified' and (result.final_rank=1 or (result.final_rank<=3 and (category.code in ('elite','world')
        or race.competition_type in ('continental_championship','world_championship') or race.competition_type like 'quadrennial%'))
        or (result.final_rank<=10 and (race.is_grand_tour or race.is_monument)))
      union all
      select roster.rider_id,source.id,edition.id,edition.display_name,category.code,'stages',count(*)::integer,null::integer
      from public.stage_results result join public.race_rosters roster on roster.id=result.race_roster_id join members on members.rider_id=roster.rider_id
      join public.stages stage on stage.id=result.stage_id join public.race_editions edition on edition.id=stage.race_edition_id and edition.status='completed'
      join source on source.id=edition.season_id join public.races race on race.id=edition.race_id and race.race_format='stage_race'
      join public.race_categories category on category.id=edition.race_category_id and category.code in ('elite','world')
      where result.status='finished' and result.rank=1 group by roster.rider_id,source.id,edition.id,edition.display_name,category.code
      union all
      select roster.rider_id,source.id,edition.id,edition.display_name,category.code,result.classification_type,1,null::integer
      from public.race_secondary_results result join public.race_rosters roster on roster.id=result.race_roster_id join members on members.rider_id=roster.rider_id
      join public.race_editions edition on edition.id=result.race_edition_id and edition.status='completed' join source on source.id=edition.season_id
      join public.races race on race.id=edition.race_id and race.race_format='stage_race'
      join public.race_categories category on category.id=edition.race_category_id and category.code in ('elite','world')
      where result.rank=1 and result.classification_type in ('mountain','sprint','youth'))
      select * from honours order by "riderId","raceEditionId",kind,rank limit 6001;`),
    "07-contracts.sql":readOnlySql("final-contracts",`with ${completedMembers}
      select contract.rider_id as "riderId",contract.id as "contractId",contract.team_id as "teamId",starts.game_year as "startGameYear",ends.game_year as "endGameYear",
        contract.status,left_season.game_year as "leftGameYear",contract.left_day_number as "leftDayNumber"
      from public.rider_contracts contract join members on members.rider_id=contract.rider_id join public.seasons starts on starts.id=contract.start_season_id and starts.game_year<=4
      join public.seasons ends on ends.id=contract.end_season_id and ends.game_year>=4 left join public.seasons left_season on left_season.id=contract.left_season_id
      where contract.status in ('active','completed','terminated') order by contract.rider_id,contract.id limit 1001;`),
    "08-naturalizations.sql":readOnlySql("final-nationality",`with ${completedMembers}
      select change.rider_id as "riderId",to_char(change.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "changedAt",change.season_id as "sourceSeasonId",country.name as country,country.iso_alpha2 as "countryCode"
      from public.rider_naturalizations change join members on members.rider_id=change.rider_id join source on source.id=change.season_id
      join public.countries country on country.id=change.to_country_id where change.subject_type='professional'
      order by change.rider_id,change.created_at,change.id limit 1001;`),
  };
}

const uuid=z.uuid();
const instant=z.iso.datetime({offset:true});
const text=z.string().trim().min(1).max(200);
const rawTeamSchema=z.strictObject({
  sourceSeasonId:uuid,teamId:uuid,teamName:text,
  amateurPattern:z.string().nullable(),amateurPrimaryColor:z.string().nullable(),amateurSecondaryColor:z.string().nullable(),amateurAccentColor:z.string().nullable(),
  sponsorContracts:z.array(z.strictObject({contractId:uuid,startSeasonId:uuid,startGameYear:z.number().int(),contractDurationSeasons:z.number().int().positive(),sponsorCatalogKey:text,
    jerseyId:text.nullable(),jerseyStyle:z.enum(["classic","modern","bold"]).nullable()})).max(1),
});
const contextSchema=z.strictObject({sourceSeasonId:uuid,sourceSeason:z.literal(4),sourceSeasonStatus:z.literal("active"),startsOn:z.iso.date(),endsOn:z.iso.date(),capturedAt:instant,activeSeason:z.literal(4)});
const envelope={sourceSeasonId:uuid,sourceSeasonStatus:z.literal("active"),capturedAt:instant};
const rawRiderSchema=z.strictObject({...envelope,membershipCount:z.number().int().min(1).max(213),championshipCount:z.number().int().min(0).max(13),
  riderId:uuid,firstName:text,lastName:text,country:text,countryCode:z.string().regex(/^[A-Z]{2}$/),avatarProfileKey:text.nullable(),avatarSeed:text.nullable(),
  provisionalUciRank:z.number().int().min(1).max(200).nullable(),knownChampionships:z.array(z.enum(CYCLO_STICKERS_FINAL_TITLE_SLOTS)).max(13),
  contractId:uuid,contractStartSeasonId:uuid,contractEndSeasonId:uuid,contractStartGameYear:z.number().int().max(4),contractEndGameYear:z.number().int().min(4),contractStatus:z.literal("active"),team:rawTeamSchema,
});
const rawTopTeamSchema=z.strictObject({...envelope,provisionalUciRank:z.number().int().min(1).max(5),team:rawTeamSchema});
type RawTeam=z.infer<typeof rawTeamSchema>;
export type CycloStickersS4IdentityStage={
  schemaVersion:1;kind:"s4-active-identity-evidence";sportingResultsFinal:false;
  sourceSeasonId:string;sourceSeason:4;sourceSeasonStatus:"active";startsOn:string;endsOn:string;capturedAt:string;capturedUntil:string;
  selection:{provisionalTopRank:200;knownChampions:number;profileCount:number};
  riders:{id:string;name:string;country:string;countryCode:string;avatarProfileKey:string|null;avatarSeed:string|null;teamId:string;
    capturedAt:string;contractEvidence:{contractId:string;startSeasonId:string;endSeasonId:string;startGameYear:number;endGameYear:number};
    provisionalUciRank:number|null;knownChampionships:string[]}[];
  teams:{teamId:string;teamName:string;jersey:RiderJerseyAppearance;sourceSeasonId:string;capturedAt:string;contractEvidence:RawTeam["sponsorContracts"]}[];
  assets:{originalPath:string;frozenPath:string;sha256:string;bytes:number}[];
  sha256:string;
};

function assertCondition(condition:unknown,message:string):asserts condition {if(!condition)throw Error(`S4 identity stage: ${message}`);}
function resolveTeamJersey(raw:RawTeam):RiderJerseyAppearance {
  const principal=raw.sponsorContracts[0];
  if(principal){
    const sponsor=SPONSORS.find(row=>row.id===principal.sponsorCatalogKey);
    const jersey=sponsor?.jerseys.find(row=>row.id===principal.jerseyId);
    assertCondition(sponsor&&jersey&&jersey.style===principal.jerseyStyle,"missing S4 sponsor selection/catalogue asset; no substitute jersey is permitted");
    return createSponsoredRiderJersey({colors:sponsor.colors,style:jersey.style,imagePath:jersey.imagePath});
  }
  assertCondition(raw.amateurPattern!==null&&isAmateurJerseyPattern(raw.amateurPattern)&&raw.amateurPrimaryColor&&raw.amateurSecondaryColor&&raw.amateurAccentColor,"missing captured S4 amateur jersey");
  for(const value of [raw.amateurPrimaryColor,raw.amateurSecondaryColor,raw.amateurAccentColor])assertCondition(/^#[0-9a-f]{6}$/i.test(value),"invalid captured jersey colour");
  return createAmateurRiderJersey({pattern:raw.amateurPattern,primaryColor:raw.amateurPrimaryColor,secondaryColor:raw.amateurSecondaryColor,accentColor:raw.amateurAccentColor});
}

export function assembleCycloStickersS4IdentityStage(input:{context:unknown;riders:unknown;teams:unknown}):CycloStickersS4IdentityStage {
  const context=z.array(contextSchema).length(1).parse(input.context)[0];
  const riders=z.array(rawRiderSchema).min(1).max(213).parse(input.riders);
  const topTeams=z.array(rawTopTeamSchema).length(5).parse(input.teams);
  assertCondition(new Set(riders.map(row=>row.riderId)).size===riders.length,"duplicate profile or ambiguous active rider contract");
  assertCondition(riders.every(row=>row.membershipCount===riders.length&&row.championshipCount===riders[0].championshipCount),"truncated membership or conflicting query results");
  assertCondition(topTeams.every((row,index)=>row.provisionalUciRank===index+1),"top-five team staging ranks are missing or duplicated");
  const timestamps=[context.capturedAt,...riders.map(row=>row.capturedAt),...topTeams.map(row=>row.capturedAt)].map(Date.parse);
  assertCondition(Math.max(...timestamps)-Math.min(...timestamps)<=10*60_000,"queries span more than ten minutes; capture again sequentially");
  assertCondition([...riders,...topTeams].every(row=>row.sourceSeasonId===context.sourceSeasonId&&row.team.sourceSeasonId===context.sourceSeasonId),"mixed source seasons");
  const teams=new Map<string,CycloStickersS4IdentityStage["teams"][number]>();
  for(const row of [...riders,...topTeams]){
    const team={teamId:row.team.teamId,teamName:row.team.teamName,jersey:resolveTeamJersey(row.team),sourceSeasonId:context.sourceSeasonId,capturedAt:row.capturedAt,contractEvidence:row.team.sponsorContracts};
    const previous=teams.get(team.teamId);
    assertCondition(!previous||serializeCycloStickersSnapshot({...previous,capturedAt:""})===serializeCycloStickersSnapshot({...team,capturedAt:""}),"team identity or selected jersey changed during capture");
    teams.set(team.teamId,previous??team);
  }
  const core={schemaVersion:1 as const,kind:"s4-active-identity-evidence" as const,sportingResultsFinal:false as const,
    sourceSeasonId:context.sourceSeasonId,sourceSeason:4 as const,sourceSeasonStatus:"active" as const,startsOn:context.startsOn,endsOn:context.endsOn,
    capturedAt:new Date(Math.min(...timestamps)).toISOString(),capturedUntil:new Date(Math.max(...timestamps)).toISOString(),
    selection:{provisionalTopRank:200 as const,knownChampions:riders[0].championshipCount,profileCount:riders.length},
    riders:riders.map(row=>({id:row.riderId,name:`${row.firstName} ${row.lastName}`,country:row.country,countryCode:row.countryCode,avatarProfileKey:row.avatarProfileKey,avatarSeed:row.avatarSeed,
      teamId:row.team.teamId,capturedAt:row.capturedAt,contractEvidence:{contractId:row.contractId,startSeasonId:row.contractStartSeasonId,endSeasonId:row.contractEndSeasonId,startGameYear:row.contractStartGameYear,endGameYear:row.contractEndGameYear},
      provisionalUciRank:row.provisionalUciRank,knownChampionships:row.knownChampionships})),teams:[...teams.values()].sort((a,b)=>a.teamId.localeCompare(b.teamId)),assets:[]};
  return {...core,sha256:createHash("sha256").update(serializeCycloStickersSnapshot(core)).digest("hex")};
}

/** Copy existing raster files byte-for-byte to content-addressed S4 paths. */
export async function freezeCycloStickersS4StageAssets(stage:CycloStickersS4IdentityStage,repositoryRoot:string):Promise<CycloStickersS4IdentityStage>{
  const frozen=structuredClone(stage);
  const publicRoot=resolve(repositoryRoot,"public");
  const copied=new Map<string,CycloStickersS4IdentityStage["assets"][number]>();
  let bytes=0;
  for(const team of frozen.teams){
    const originalPath=team.jersey.imagePath;if(!originalPath)continue;
    assertCondition(/^\/images\/[^?#\\]+$/.test(originalPath)&&!originalPath.split("/").includes(".."),"unsafe source jersey path");
    const sourcePath=resolve(publicRoot,originalPath.slice(1));
    assertCondition(sourcePath.startsWith(`${publicRoot}${sep}`),"jersey asset escaped public directory");
    let asset=copied.get(originalPath);
    if(!asset){
      const info=await stat(sourcePath);assertCondition(info.isFile()&&info.size<=2_000_000,"missing or oversized source jersey asset");
      bytes+=info.size;assertCondition(bytes<=64_000_000,"staged jersey assets exceed 64 MB");
      const buffer=await readFile(sourcePath),sha256=createHash("sha256").update(buffer).digest("hex");
      const extension=extname(originalPath).toLowerCase();assertCondition([".webp",".png",".jpg",".jpeg",".svg"].includes(extension),"unsupported jersey file extension");
      const frozenPath=`/images/collector-albums/s4/${sha256}${extension}`;
      const destination=resolve(publicRoot,frozenPath.slice(1));
      await mkdir(resolve(publicRoot,"images","collector-albums","s4"),{recursive:true});
      try{await writeFile(destination,buffer,{flag:"wx"});}
      catch(error){
        if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;
        assertCondition(createHash("sha256").update(await readFile(destination)).digest("hex")===sha256,"frozen asset path already has different bytes");
      }
      asset={originalPath,frozenPath,sha256,bytes:buffer.length};copied.set(originalPath,asset);
    }
    team.jersey.imagePath=asset.frozenPath;
  }
  frozen.assets=[...copied.values()].sort((a,b)=>a.originalPath.localeCompare(b.originalPath));
  const {sha256:previousHash,...core}=frozen;
  void previousHash;
  frozen.sha256=createHash("sha256").update(serializeCycloStickersSnapshot(core)).digest("hex");
  return frozen;
}

const finalContextSchema=z.strictObject({sourceSeasonId:uuid,sourceSeason:z.literal(4),sourceSeasonStatus:z.literal("completed"),startsOn:z.iso.date(),endsOn:z.iso.date(),capturedAt:instant});
const finalRankingSchema=z.strictObject({sourceSeasonId:uuid,riderId:uuid,rank:z.number().int(),points:z.number().finite().nonnegative(),victories:z.number().int().nonnegative()});
const finalTeamSchema=z.strictObject({sourceSeasonId:uuid,teamId:uuid,rank:z.number().int(),name:text,points:z.number().finite().nonnegative()});
const contractSchema=z.strictObject({riderId:uuid,contractId:uuid,teamId:uuid,startGameYear:z.number().int().max(4),endGameYear:z.number().int().min(4),status:z.enum(["active","completed","terminated"]),leftGameYear:z.number().int().nullable(),leftDayNumber:z.number().int().nullable()});
const naturalizationSchema=z.strictObject({riderId:uuid,changedAt:instant,sourceSeasonId:uuid,country:text,countryCode:z.string().regex(/^[A-Z]{2}$/)});

/** Combine final facts with the reviewed, hashed pre-rollover presentation. */
export function assembleCompletedCycloStickersS4Source(stage:CycloStickersS4IdentityStage,facts:Record<string,unknown>):CycloStickersFinalSource{
  const {sha256,...stageCore}=stage;
  assertCondition(stage.kind==="s4-active-identity-evidence"&&stage.sportingResultsFinal===false&&stage.sourceSeason===4&&stage.sourceSeasonStatus==="active"
    &&/^[a-f0-9]{64}$/.test(sha256)&&createHash("sha256").update(serializeCycloStickersSnapshot(stageCore)).digest("hex")===sha256,"staged identity evidence hash/provenance is invalid");
  const context=z.array(finalContextSchema).length(1).parse(facts.context)[0];
  assertCondition(context.sourceSeasonId===stage.sourceSeasonId&&context.startsOn===stage.startsOn&&context.endsOn===stage.endsOn,"final facts and stage refer to different seasons");
  const ranking=z.array(finalRankingSchema).length(50).parse(facts.ranking);
  const finalTeams=z.array(finalTeamSchema).length(5).parse(facts.teams);
  const championships=z.array(z.strictObject({sourceSeasonId:uuid,type:z.enum(CYCLO_STICKERS_FINAL_TITLE_SLOTS),riderId:uuid,raceEditionId:uuid,raceStatus:z.literal("completed"),category:z.literal("pro")})).length(13).parse(facts.championships);
  const ratings=z.array(z.record(z.string(),z.unknown())).min(50).max(63).parse(facts.ratings);
  const honours=z.array(z.record(z.string(),z.unknown())).max(6000).parse(facts.honours);
  const contracts=z.array(contractSchema).max(1000).parse(facts.contracts);
  const changes=z.array(naturalizationSchema).max(1000).parse(facts.naturalizations);
  const selected=new Set([...ranking.map(row=>row.riderId),...championships.map(row=>row.riderId)]);
  assertCondition(ratings.length===selected.size&&new Set(ratings.map(row=>row.riderId)).size===selected.size,"missing or duplicate native S4 ratings");
  const frozenTeams=new Map(stage.teams.map(row=>[row.teamId,row]));
  const frozenRiders=new Map(stage.riders.map(row=>[row.id,row]));
  const teams=finalTeams.map(row=>{
    const captured=frozenTeams.get(row.teamId);assertCondition(captured,"final top-five team was not staged; recover genuine S4 jersey evidence, never use S5");
    assertCondition(captured.teamName===row.name,"team name changed after staging; review genuine final-S4 identity before sealing");
    return {...row,jerseySeasonId:context.sourceSeasonId,jersey:captured.jersey};
  });
  const nativeKeys=["mountain","hills","flat","timeTrial","cobbles","sprint","acceleration","downhill","endurance","resistance","recovery","breakaway","prologue"] as const;
  const nativeNumber=(value:unknown)=>{
    assertCondition((typeof value==="number"||typeof value==="string")&&String(value).trim()!==""&&Number.isFinite(Number(value)),"native S4 rating is null or non-finite");
    return Number(value);
  };
  const riders=[...selected].sort().map(riderId=>{
    const identity=frozenRiders.get(riderId);assertCondition(identity,`final rider ${riderId} was outside the staged top200/champions; no S5 fallback is permitted`);
    const native=ratings.find(row=>row.riderId===riderId);assertCondition(native&&native.sourceSeasonId===context.sourceSeasonId,"missing source-season native rating row");
    const eligible=contracts.filter(row=>row.riderId===riderId&&(row.leftGameYear===null||row.leftGameYear>4)&&!(row.status==="terminated"&&row.leftGameYear===null));
    const clubs=new Set(eligible.map(row=>row.teamId));assertCondition(clubs.size===1,`ambiguous/missing end-of-S4 contract for ${riderId}; review historical club evidence`);
    const clubId=[...clubs][0],team=frozenTeams.get(clubId);assertCondition(team,`end-of-S4 club ${clubId} has no captured S4 jersey; no current jersey fallback`);
    const laterChanges=changes.filter(row=>row.riderId===riderId&&Date.parse(row.changedAt)>Date.parse(identity.capturedAt));
    assertCondition(laterChanges.every(row=>row.sourceSeasonId===context.sourceSeasonId),"mixed nationality source seasons");
    const country=laterChanges.sort((a,b)=>Date.parse(a.changedAt)-Date.parse(b.changedAt)).at(-1)??identity;
    return {id:riderId,sourceSeasonId:context.sourceSeasonId,ratingsSeasonId:context.sourceSeasonId,contractSeasonId:context.sourceSeasonId,jerseySeasonId:context.sourceSeasonId,
      name:identity.name,country:country.country,countryCode:country.countryCode,age:native.age,avatarProfileKey:identity.avatarProfileKey,avatarSeed:identity.avatarSeed,
      teamId:clubId,teamName:team.teamName,jersey:team.jersey,ratings:Object.fromEntries(nativeKeys.map(key=>[key,nativeNumber(native[key])])),
      honours:honours.filter(row=>row.riderId===riderId).map(({riderId:sourceRiderId,rank,...row})=>{void sourceRiderId;return {...row,...(rank===null?{}:{rank})};})};
  });
  const source={schemaVersion:1,capturedAt:context.capturedAt,season:{id:context.sourceSeasonId,gameYear:4,status:"completed",startsOn:context.startsOn,endsOn:context.endsOn},ranking,teams,riders,championships,
    identityCapture:{kind:stage.kind,sourceSeasonId:stage.sourceSeasonId,sourceSeasonStatus:stage.sourceSeasonStatus,capturedAt:stage.capturedAt,capturedUntil:stage.capturedUntil,sha256:stage.sha256}};
  // The same strict source validator/rebuilder used by prepare and seal is
  // the final authority; this cannot promote an active ranking to completed.
  return createCycloStickersFinalSnapshot(source).provenance.source;
}

async function readRows(file:string):Promise<unknown[]> {
  assertCondition((await stat(file)).size<=2_000_000,"query result exceeds 2 MB");
  const parsed:unknown=JSON.parse(await readFile(file,"utf8"));
  if(Array.isArray(parsed))return parsed;
  if(parsed&&typeof parsed==="object")for(const key of ["rows","data"]){const value=(parsed as Record<string,unknown>)[key];if(Array.isArray(value))return value;}
  throw Error(`Expected a query result array in ${file}`);
}
async function main(){
  const [mode,input,output]=process.argv.slice(2);
  if(mode==="final-sql"&&input&&!output){
    await mkdir(resolve(input),{recursive:false});
    for(const [name,query]of Object.entries(buildCycloStickersS4CompletedQueries()))await writeFile(resolve(input,name),query,{flag:"wx"});
    console.log(JSON.stringify({generated:true,readOnly:true,executed:false,mode:"completed-S4-facts",queries:8,maxFinalProfiles:63}));return;
  }
  if(mode==="stage-sql"&&input&&!output){
    await mkdir(resolve(input),{recursive:false});
    for(const [name,query]of Object.entries(buildCycloStickersS4StageQueries()))await writeFile(resolve(input,name),query,{flag:"wx"});
    console.log(JSON.stringify({generated:true,readOnly:true,executed:false,mode:"active-S4-identity-evidence",queries:3,maxProfiles:213,finalSportingResults:false}));return;
  }
  if(mode==="stage"&&input&&output&&resolve(input)!==resolve(output)){
    const stage=await freezeCycloStickersS4StageAssets(assembleCycloStickersS4IdentityStage({context:await readRows(resolve(input,"01-context.json")),riders:await readRows(resolve(input,"02-riders.json")),teams:await readRows(resolve(input,"03-teams.json"))}),fileURLToPath(new URL("..",import.meta.url)));
    await writeFile(resolve(output),`${JSON.stringify(stage,null,2)}\n`,{flag:"wx"});
    console.log(JSON.stringify({staged:true,sealed:false,finalSportingResults:false,profiles:stage.riders.length,teams:stage.teams.length,sha256:stage.sha256}));return;
  }
  if(mode==="completed"&&input&&output&&process.argv[5]){
    assertCondition((await stat(resolve(input))).size<=2_000_000,"identity stage exceeds 2 MB");
    const stage=JSON.parse(await readFile(resolve(input),"utf8")) as CycloStickersS4IdentityStage;
    const files={context:"01-context",ranking:"02-ranking",teams:"03-teams",championships:"04-championships",ratings:"05-ratings",honours:"06-honours",contracts:"07-contracts",naturalizations:"08-naturalizations"};
    const facts:Record<string,unknown>={};for(const [key,file]of Object.entries(files))facts[key]=await readRows(resolve(output,`${file}.json`));
    const source=assembleCompletedCycloStickersS4Source(stage,facts);
    await writeFile(resolve(process.argv[5]),`${JSON.stringify(source,null,2)}\n`,{flag:"wx"});
    console.log(JSON.stringify({exported:true,sourceSeasonStatus:"completed",sealed:false,requiresReview:true,finalRiders:source.riders.length,identityStageSha256:stage.sha256}));return;
  }
  throw Error("Usage: npx tsx scripts/export-cyclo-stickers-s4.ts stage-sql|final-sql <new-directory> | stage <query-results-directory> <new-stage.json> | completed <reviewed-stage.json> <final-query-results-directory> <new-source.json>");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error instanceof Error?error.message:"S4 export preparation failed");process.exitCode=1;});
