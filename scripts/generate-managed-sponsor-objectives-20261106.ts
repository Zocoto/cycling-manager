// Pure offline generation from bounded read-only snapshots. No credentials or RPC.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SPONSORS } from "@/data/sponsors";
import { generateProvisionalSponsorObjectives, shouldSponsorRequestRiderRecruitment,
  type SponsorObjectiveRaceCandidate, type SponsorObjectiveTeamRiderCandidate } from "@/services/sponsor-objectives";
import { getRiderSportingProfile, type RiderRatings } from "@/lib/game/rider-profile";
import { calculateNationRiderOverall } from "@/lib/game/nation-rider-ranking";
import { normalizeTeamDivisionCode } from "@/lib/game/team-divisions";
import { resolveSponsorSportingPhilosophy } from "@/lib/game/sponsor-philosophy";
import { calculateSponsorMainObjectiveTerms, getSponsorMainObjectiveCandidateScore,
  selectSponsorMainObjectiveOfferId } from "@/lib/game/sponsor-main-objective";
import type { SponsorObjectiveDifficulty } from "@/lib/game/sponsor-negotiation";
import type { RaceCategoryCode, RaceProfileType } from "@/lib/game/race-calendar";
import type { SponsorObjectiveTargetDetails } from "@/types/sponsor-objective";

const SEASON="7ea43c15-30fd-4878-b18f-ab2a43ad3be8";
const EXPECTED=new Map([
  ["e9353b68-b7c6-4a9a-a1d7-a96f84a89e07",{key:"antoine_morel_29",catalog:"maison-lannic",budget:570000,team:"817db772-6373-4b4a-bb01-a78b1107d546"}],
  ["066e9270-cfd0-48ca-81b8-8ccad5d9f330",{key:"giulia_rinaldi",catalog:"dong-duong-phanh",budget:340000,team:"61c5aac7-4917-48ed-b861-ebf5eea2d754"}],
]);
type Offer={bot_key:string;team_id:string;offer_id:string;season_id:string;sponsor_id:string;catalog_key:string;
  offer_status:string;contract_status:string;role:string;budget_per_season:number;base_budget_per_season:number;
  contract_budget:number;objective_difficulty:SponsorObjectiveDifficulty;generation_version:number;
  reputation_points:number;current_division:string|null;final_rank:number|null;sponsor_continent_code:string|null;
  existing_objective_count:number};
type RatingRow={bot_key:string;rider_id:string;first_name:string;last_name:string;country_code:string;joined_for_target_season:boolean;
  mountain:number;hills:number;flat:number;time_trial:number;cobbles:number;sprint:number;acceleration:number;downhill:number;
  endurance:number;resistance:number;recovery:number;breakaway:number;prologue:number};
type Race={race_id:string;race_edition_id:string;race_slug:string;race_label:string;country_code:string;continent_code:string|null;
  registration_policy:"open"|"criteria_pending"|"closed";minimum_reputation:number|null;category_code:RaceCategoryCode;
  race_format:"one_day"|"stage_race";competition_type:string;is_monument:boolean;is_grand_tour:boolean;profile_types:RaceProfileType[]|null};
export type ManagedSponsorSnapshot={season_id:string;game_year:number;offers:Offer[];roster:RatingRow[];
  history:{current_offer_id:string;game_year:number;target_details:SponsorObjectiveTargetDetails}[];calendar:Race[]};

// Exact seeded RNG used by persisted-sponsor-objectives.ts, including UTF-16
// charCodeAt hashing and the offerId:sponsorCatalogKey seed.
export function canonicalSponsorRandom(seedValue:string):()=>number{
  let seed=2166136261;
  for(let index=0;index<seedValue.length;index++){seed^=seedValue.charCodeAt(index);seed=Math.imul(seed,16777619);}
  let state=seed>>>0;
  return ()=>{state=(state+0x6d2b79f5)>>>0;let value=state;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}
function toRatings(row:RatingRow):RiderRatings{
  return {mountain:Number(row.mountain),hills:Number(row.hills),flat:Number(row.flat),timeTrial:Number(row.time_trial),
    cobbles:Number(row.cobbles),sprint:Number(row.sprint),acceleration:Number(row.acceleration),downhill:Number(row.downhill),
    endurance:Number(row.endurance),resistance:Number(row.resistance),recovery:Number(row.recovery),
    breakaway:Number(row.breakaway),prologue:Number(row.prologue)};
}
export function buildManagedSponsorObjectiveRows(snapshot:ManagedSponsorSnapshot,idFactory:()=>string=randomUUID){
  assert.equal(snapshot.season_id,SEASON);assert.equal(snapshot.game_year,5);
  assert.equal(snapshot.offers.length,2);assert.equal(new Set(snapshot.offers.map(o=>o.offer_id)).size,2);
  assert.ok(snapshot.calendar.length>=3&&snapshot.calendar.length<601);
  assert.ok(snapshot.roster.length<71&&snapshot.history.length<61);
  const raceById=new Map<string,SponsorObjectiveRaceCandidate>();
  for(const race of snapshot.calendar){
    raceById.set(race.race_id,{raceId:race.race_id,raceEditionId:race.race_edition_id,raceSlug:race.race_slug,
      raceLabel:race.race_label,countryCode:race.country_code,continentCode:race.continent_code,
      registrationPolicy:race.registration_policy,minimumReputation:race.minimum_reputation,categoryCode:race.category_code,
      raceFormat:race.race_format,profileTypes:race.profile_types??[],competitionType:race.competition_type,
      isMonument:race.is_monument,isGrandTour:race.is_grand_tour});
  }
  const raceCandidates=[...raceById.values()];
  const rows=[];
  const raceLinks=[];
  const mainTerms=[];
  const reports=[];
  for(const offer of snapshot.offers){
    const expected=EXPECTED.get(offer.offer_id);assert.ok(expected,"Unexpected offer outside the authorized repair");
    assert.equal(offer.bot_key,expected.key);assert.equal(offer.team_id,expected.team);
    assert.equal(offer.catalog_key,expected.catalog);assert.equal(offer.season_id,SEASON);
    assert.equal(offer.offer_status,"accepted");assert.equal(offer.contract_status,"active");assert.equal(offer.role,"principal");
    assert.equal(Number(offer.budget_per_season),expected.budget);assert.equal(Number(offer.contract_budget),expected.budget);
    assert.equal(Number(offer.existing_objective_count),0,"Objectives already exist; do not overwrite an agreed plan");
    const sponsor=SPONSORS.find(s=>s.id===offer.catalog_key);assert.ok(sponsor);
    const philosophy=resolveSponsorSportingPhilosophy(sponsor.id);
    // These two catalog sponsors do not request a named recruit. If the
    // canonical catalog changes that rule, obtain a proper candidate snapshot.
    assert.equal(shouldSponsorRequestRiderRecruitment({sponsorCatalogKey:sponsor.id,sportingPhilosophy:philosophy}),false);
    const roster=snapshot.roster.filter(r=>r.bot_key===offer.bot_key);
    assert.equal(roster.length,12,"Wait until all twelve actual recruitment contracts are committed");
    assert.equal(new Set(roster.map(r=>r.rider_id)).size,12);
    const teamRiderCandidates:SponsorObjectiveTeamRiderCandidate[]=roster.map(row=>{
      const ratings=toRatings(row);assert.ok(Object.values(ratings).every(Number.isFinite));
      return {riderId:row.rider_id,riderName:`${row.first_name} ${row.last_name}`.trim(),countryCode:row.country_code.trim().toUpperCase(),
        ratings,sportingProfile:getRiderSportingProfile(ratings),overallRating:calculateNationRiderOverall(ratings),
        joinedForTargetSeason:row.joined_for_target_season};
    });
    const currentDivision=normalizeTeamDivisionCode(offer.current_division);
    const rank=typeof offer.final_rank==="number"&&Number.isInteger(offer.final_rank)&&offer.final_rank>0?offer.final_rank:null;
    const previousObjectives=snapshot.history.filter(h=>h.current_offer_id===offer.offer_id).map(h=>h.target_details);
    const generated=generateProvisionalSponsorObjectives({
      sponsorCountryCode:sponsor.countryCode,sponsorPrestige:sponsor.prestige,
      proposedBudget:Number(offer.base_budget_per_season),sponsorCatalogKey:sponsor.id,sponsorSector:sponsor.sector,
      sponsorContinentCode:offer.sponsor_continent_code,relationshipYear:2,
      objectiveDifficulty:offer.objective_difficulty,includeRiderRecruitmentObjective:Number(offer.generation_version)>=8,
      riderCandidates:[],teamRiderCandidates,previousObjectives,targetSeasonGameYear:5,
      teamSportingContext:{currentDivision,projectedDivision:currentDivision,projectedRank:rank},
      teamReputationPoints:Number(offer.reputation_points),raceCandidates,
      random:canonicalSponsorRandom(`${offer.offer_id}:${sponsor.id}`),
    });
    assert.equal(generated.length,10);assert.equal(generated.reduce((total,o)=>total+o.satisfactionPoints,0),100);
    assert.equal(new Set(generated.map(o=>o.name)).size,10);
    const offerRows=generated.map(objective=>({id:idFactory(),sponsor_offer_id:offer.offer_id,season_id:SEASON,
      name:objective.name,description:objective.description,objective_type:objective.objectiveType,priority:objective.priority,
      evaluation_timing:objective.evaluationTiming,evaluation_day_number:objective.evaluationDayNumber,status:"draft" as const,
      display_order:objective.displayOrder,renewal_bonus_percent:objective.renewalBonusPercent,
      satisfaction_points:objective.satisfactionPoints,is_provisional:objective.isProvisional,target_details:objective.targetDetails}));
    rows.push(...offerRows);
    for(const row of offerRows){
      const details=row.target_details;
      if(row.objective_type!=="race_result"||details.kind!=="race_result"||!details.raceEditionId)continue;
      raceLinks.push({objective_id:row.id,race_edition_id:details.raceEditionId,stage_id:null,target_scope:"race_final",
        achievement_type:details.achievementType,target_rank:details.targetRank,required_count:details.requiredCount});
    }
    // The persisted service is invoked per team. Selecting across the two
    // different teams together would change the canonical main-objective draw.
    if(selectSponsorMainObjectiveOfferId([offer.offer_id],SEASON)===offer.offer_id){
      const candidates=offerRows.flatMap(objective=>{
        const details=objective.target_details;if(details.kind!=="race_result")return [];
        const race=raceById.get(details.raceId);if(!race?.categoryCode)return [];
        const targetRank=details.achievementType==="win"?1:(details.targetRank??10);
        return [{objective,categoryCode:race.categoryCode,targetRank,
          score:getSponsorMainObjectiveCandidateScore({raceCategoryCode:race.categoryCode,targetRank})}];
      }).sort((a,b)=>b.score-a.score||a.objective.display_order-b.objective.display_order);
      const selected=candidates[0];
      if(selected){
        const terms=calculateSponsorMainObjectiveTerms({sponsorPrestige:sponsor.prestige,raceCategoryCode:selected.categoryCode,
          targetRank:selected.targetRank,targetSeasonGameYear:5,annualSponsorBudget:Number(offer.budget_per_season)});
        mainTerms.push({sponsor_objective_id:selected.objective.id,cash_reward:terms.cashReward,currency_code:"EUR",
          reputation_penalty:terms.reputationPenalty,race_category_code:selected.categoryCode});
      }
    }
    reports.push({bot_key:offer.bot_key,offer_id:offer.offer_id,sponsor:sponsor.name,country:sponsor.countryCode,
      philosophy,roster_size:roster.length,history_objectives:previousObjectives.length,
      generation_versions:[...new Set(generated.map(o=>o.targetDetails.generationVersion))],
      objectives:offerRows.map(row=>({order:row.display_order,name:row.name,points:row.satisfaction_points,
        type:row.objective_type,details:row.target_details}))});
  }
  assert.equal(rows.length,20);assert.equal(new Set(rows.map(r=>r.id)).size,20);
  return {season_id:SEASON,game_year:5,required_existing_objective_count:0,
    rows,race_links:raceLinks,main_terms:mainTerms,
    activation:{offer_ids:[...EXPECTED.keys()],status:"active",is_provisional:false},reports,
    canonical_sources:["services/sponsor-objectives.ts","services/persisted-sponsor-objectives.ts",
      "services/sponsor-objective-sporting-context.ts","lib/game/sponsor-main-objective.ts"]};
}

export function createManagedSponsorObjectiveInstallSql(payload:ReturnType<typeof buildManagedSponsorObjectiveRows>){
  assert.equal(payload.rows.length,20);
  const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
  const data=literal(JSON.stringify({rows:payload.rows,race_links:payload.race_links,main_terms:payload.main_terms}));
  return `begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
set local application_name='managed-s5-canonical-sponsor-objectives-install';
do $install$
declare
  v_payload constant jsonb := ${data}::jsonb;
  v_offers constant uuid[] := array['e9353b68-b7c6-4a9a-a1d7-a96f84a89e07'::uuid,'066e9270-cfd0-48ca-81b8-8ccad5d9f330'::uuid];
  v_count integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('managed-s5-canonical-sponsor-objectives-20261106',0)) then
    raise exception 'Sponsor objective installation already running.' using errcode='55P03';
  end if;
  perform id from public.seasons where id='${SEASON}'::uuid and status='active' and game_year=5 and current_day_number=1 for share nowait;
  if not found then raise exception 'Expected S5 J1 changed; review before installation.'; end if;
  perform id from public.sponsor_offers where id=any(v_offers) order by id for update nowait;
  select count(*) into v_count from public.sponsor_offers o
  join public.team_sponsor_contracts c on c.sponsor_offer_id=o.id and c.role='principal' and c.status='active'
  join public.sponsors s on s.id=o.sponsor_id
  join public.alpha_bot_managers b on b.team_id=c.team_id and b.sporting_director_id=o.sporting_director_id
  where o.id=any(v_offers) and o.status='accepted' and o.season_id='${SEASON}'::uuid
    and c.start_season_id='${SEASON}'::uuid and c.end_season_id='${SEASON}'::uuid
    and ((o.id=v_offers[1] and b.bot_key='antoine_morel_29' and c.team_id='817db772-6373-4b4a-bb01-a78b1107d546'::uuid
      and s.catalog_key='maison-lannic' and o.budget_per_season=570000 and c.budget_per_season=570000)
      or(o.id=v_offers[2] and b.bot_key='giulia_rinaldi' and c.team_id='61c5aac7-4917-48ed-b861-ebf5eea2d754'::uuid
      and s.catalog_key='dong-duong-phanh' and o.budget_per_season=340000 and c.budget_per_season=340000));
  if v_count<>2 then raise exception 'The two approved sponsor restorations are not active as expected.'; end if;
  if exists(select 1 from public.sponsor_objectives where sponsor_offer_id=any(v_offers)) then
    raise exception 'Objectives already exist. Inspect them; never overwrite or reroll an agreed plan.';
  end if;
  insert into public.sponsor_objectives(id,sponsor_offer_id,season_id,name,description,objective_type,priority,
    evaluation_timing,evaluation_day_number,status,display_order,renewal_bonus_percent,satisfaction_points,is_provisional,target_details)
  select * from jsonb_to_recordset(v_payload->'rows') as r(id uuid,sponsor_offer_id uuid,season_id uuid,name text,description text,
    objective_type text,priority text,evaluation_timing text,evaluation_day_number smallint,status text,display_order smallint,
    renewal_bonus_percent numeric,satisfaction_points integer,is_provisional boolean,target_details jsonb);
  get diagnostics v_count=row_count;
  if v_count<>20 then raise exception 'Expected exactly twenty canonical objectives.'; end if;
  insert into public.race_result_objectives(objective_id,race_edition_id,stage_id,target_scope,achievement_type,target_rank,required_count)
  select * from jsonb_to_recordset(v_payload->'race_links') as r(objective_id uuid,race_edition_id uuid,stage_id uuid,
    target_scope text,achievement_type text,target_rank smallint,required_count smallint);
  insert into public.sponsor_main_objective_terms(sponsor_objective_id,cash_reward,currency_code,reputation_penalty,race_category_code)
  select * from jsonb_to_recordset(v_payload->'main_terms') as r(sponsor_objective_id uuid,cash_reward numeric,currency_code text,
    reputation_penalty numeric,race_category_code text);
  update public.sponsor_offers set generation_version=12 where id=any(v_offers) and status='accepted';
  -- Normal S5 lifecycle after the provisional canonical draw. No evaluation,
  -- reward, cash settlement or historical objective update is performed here.
  update public.sponsor_objectives set status='active',is_provisional=false,updated_at=now()
  where sponsor_offer_id=any(v_offers) and id in(select (r->>'id')::uuid from jsonb_array_elements(v_payload->'rows') r);
  get diagnostics v_count=row_count;
  if v_count<>20 then raise exception 'Expected exactly twenty activated objectives.'; end if;
  if (select count(*) from public.sponsor_objectives where sponsor_offer_id=any(v_offers))<>20
    or exists(select 1 from public.sponsor_objectives where sponsor_offer_id=any(v_offers)
      and(status<>'active' or is_provisional or target_details->>'generationVersion'<>'12'))
    or exists(select 1 from public.sponsor_objectives where sponsor_offer_id=any(v_offers)
      group by sponsor_offer_id having count(*)<>10 or sum(satisfaction_points)<>100) then
    raise exception 'Canonical sponsor objective postconditions failed.';
  end if;
end;
$install$;
select sponsor_offer_id,count(*) objectives,sum(satisfaction_points) satisfaction_points,
  count(*) filter(where status='active' and not is_provisional) active_count
from public.sponsor_objectives where sponsor_offer_id in('e9353b68-b7c6-4a9a-a1d7-a96f84a89e07'::uuid,'066e9270-cfd0-48ca-81b8-8ccad5d9f330'::uuid)
group by sponsor_offer_id order by sponsor_offer_id;
commit;
`;
}

if(process.argv[1]?.replaceAll("\\","/").endsWith("/generate-managed-sponsor-objectives-20261106.ts")){
  const snapshotPath=process.argv[2]??"C:/Dev/artifacts/managed-teams-s5-20261106/sponsor-objective-generation.json";
  const outputPath=process.argv[3]??"C:/Dev/artifacts/managed-teams-s5-20261106/canonical-sponsor-objectives.json";
  const raw=readFileSync(snapshotPath,"utf8"),wrapped=JSON.parse(raw);
  const snapshot=(Array.isArray(wrapped)?wrapped[0].snapshot:wrapped) as ManagedSponsorSnapshot;
  const result=buildManagedSponsorObjectiveRows(snapshot);
  const payload={...result,generated_at:new Date().toISOString(),source_snapshot_sha256:createHash("sha256").update(raw).digest("hex"),
    canonical_source_sha256:Object.fromEntries(result.canonical_sources.map(file=>[file,createHash("sha256").update(readFileSync(path.resolve(file))).digest("hex")]))};
  const serialized=JSON.stringify(payload,null,2);writeFileSync(outputPath,serialized);
  const installPath=path.join(path.dirname(outputPath),"canonical-sponsor-objectives-install.sql");
  const install=createManagedSponsorObjectiveInstallSql(payload);writeFileSync(installPath,install);
  console.log(JSON.stringify({output:outputPath,sha256:createHash("sha256").update(serialized).digest("hex"),
    install:installPath,install_sha256:createHash("sha256").update(install).digest("hex"),
    rows:payload.rows.length,race_links:payload.race_links.length,main_terms:payload.main_terms.length,
    reports:payload.reports.map(r=>({team:r.bot_key,country:r.country,philosophy:r.philosophy,generation:r.generation_versions,
      objectives:r.objectives.map(o=>({order:o.order,name:o.name,points:o.points}))}))}));
}
