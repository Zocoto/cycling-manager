/** Pure bounded S4 source assembly shared by offline preparation and scheduled publication. */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { RiderJerseyAppearance } from "../rider-jersey";
import type { CollectorAlbumSnapshot } from "./collector-album";
import { CYCLO_STICKERS_FINAL_TITLE_SLOTS, createCycloStickersFinalSnapshot, createCycloStickersPreparedSnapshot, serializeCycloStickersSnapshot, type CycloStickersFinalSource } from "./cyclo-stickers-final-snapshot";
const uuid=z.uuid(), instant=z.iso.datetime({offset:true}), text=z.string().trim().min(1).max(200);
function assertCondition(condition:unknown,message:string):asserts condition {if(!condition)throw Error(`S4 source: ${message}`);}
export type CycloStickersS4IdentityStage={
  schemaVersion:1;kind:"s4-active-identity-evidence";sportingResultsFinal:false;
  sourceSeasonId:string;sourceSeason:4;sourceSeasonStatus:"active";startsOn:string;endsOn:string;capturedAt:string;capturedUntil:string;
  selection:{provisionalTopRank:200;knownChampions:number;profileCount:number};
  riders:{id:string;name:string;country:string;countryCode:string;avatarProfileKey:string|null;avatarSeed:string|null;teamId:string;
    capturedAt:string;contractEvidence:{contractId:string;startSeasonId:string;endSeasonId:string;startGameYear:number;endGameYear:number};
    provisionalUciRank:number|null;knownChampionships:string[]}[];
  teams:{teamId:string;teamName:string;jersey:RiderJerseyAppearance;sourceSeasonId:string;capturedAt:string;contractEvidence:{contractId:string;startSeasonId:string;startGameYear:number;contractDurationSeasons:number;sponsorCatalogKey:string;jerseyId:string|null;jerseyStyle:"classic"|"modern"|"bold"|null}[]}[];
  assets:{originalPath:string;frozenPath:string;sha256:string;bytes:number}[];
  sha256:string;
};

const finalContextSchema=z.strictObject({sourceSeasonId:uuid,sourceSeason:z.literal(4),sourceSeasonStatus:z.literal("completed"),startsOn:z.iso.date(),endsOn:z.iso.date(),capturedAt:instant});
const finalRankingSchema=z.strictObject({sourceSeasonId:uuid,riderId:uuid,rank:z.number().int(),points:z.number().finite().nonnegative(),victories:z.number().int().nonnegative()});
const finalTeamSchema=z.strictObject({sourceSeasonId:uuid,teamId:uuid,rank:z.number().int(),name:text,points:z.number().finite().nonnegative()});
const contractSchema=z.strictObject({riderId:uuid,contractId:uuid,teamId:uuid,startGameYear:z.number().int().max(4),endGameYear:z.number().int().min(4),status:z.enum(["active","completed","terminated"]),leftGameYear:z.number().int().nullable(),leftDayNumber:z.number().int().nullable()});
const naturalizationSchema=z.strictObject({riderId:uuid,changedAt:instant,sourceSeasonId:uuid,country:text,countryCode:z.string().regex(/^[A-Z]{2}$/)});

/** Combine final facts with the reviewed, hashed pre-rollover presentation. */
function assembleSource(stage:CycloStickersS4IdentityStage,facts:Record<string,unknown>,expectedStatus:"active"|"completed"){
  const {sha256,...stageCore}=stage;
  assertCondition(stage.kind==="s4-active-identity-evidence"&&stage.sportingResultsFinal===false&&stage.sourceSeason===4&&stage.sourceSeasonStatus==="active"
    &&/^[a-f0-9]{64}$/.test(sha256)&&createHash("sha256").update(serializeCycloStickersSnapshot(stageCore)).digest("hex")===sha256,"staged identity evidence hash/provenance is invalid");
  const context=z.array(finalContextSchema.extend({sourceSeasonStatus:z.literal(expectedStatus)})).length(1).parse(facts.context)[0];
  assertCondition(context.sourceSeasonId===stage.sourceSeasonId&&context.startsOn===stage.startsOn&&context.endsOn===stage.endsOn,"final facts and stage refer to different seasons");
  const ranking=z.array(finalRankingSchema).length(50).parse(facts.ranking);
  const bonusRanking=z.array(finalRankingSchema).length(3).parse(facts.bonusRanking);
  const finalTeams=z.array(finalTeamSchema).length(5).parse(facts.teams);
  const championships=z.array(z.strictObject({sourceSeasonId:uuid,type:z.enum(CYCLO_STICKERS_FINAL_TITLE_SLOTS),riderId:uuid,raceEditionId:uuid,raceStatus:z.literal("completed"),category:z.literal("pro")})).length(13).parse(facts.championships);
  const ratings=z.array(z.record(z.string(),z.unknown())).min(53).max(66).parse(facts.ratings);
  const honours=z.array(z.record(z.string(),z.unknown())).max(6000).parse(facts.honours);
  const contracts=z.array(contractSchema).max(1000).parse(facts.contracts);
  const changes=z.array(naturalizationSchema).max(1000).parse(facts.naturalizations);
  const selected=new Set([...ranking,...bonusRanking].map(row=>row.riderId).concat(championships.map(row=>row.riderId)));
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
    const history=contracts.filter(row=>row.riderId===riderId);
    const covering=history.filter(row=>(row.leftGameYear===null||row.leftGameYear>4)&&!(row.status==="terminated"&&row.leftGameYear===null));
    // Rollover stamps a naturally expired S4 contract as departed on S4/J28.
    // Use that historical club only when no contract still covers the S4 end.
    const eligible=covering.length?covering:history.filter(row=>row.status==="completed"&&row.endGameYear===4&&row.leftGameYear===4&&row.leftDayNumber===28);
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
  const source={schemaVersion:1,capturedAt:context.capturedAt,season:{id:context.sourceSeasonId,gameYear:4,status:expectedStatus,startsOn:context.startsOn,endsOn:context.endsOn},ranking,bonusRanking,teams,riders,championships,
    identityCapture:{kind:stage.kind,sourceSeasonId:stage.sourceSeasonId,sourceSeasonStatus:stage.sourceSeasonStatus,capturedAt:stage.capturedAt,capturedUntil:stage.capturedUntil,sha256:stage.sha256}};
  // The same strict source validator/rebuilder used by prepare and seal is
  // the final authority; this cannot promote an active ranking to completed.
  return source;
}

export function assembleCompletedCycloStickersS4Source(stage:CycloStickersS4IdentityStage,facts:Record<string,unknown>):CycloStickersFinalSource {
  return createCycloStickersFinalSnapshot(assembleSource(stage,facts,"completed")).provenance.source;
}
export function assemblePreparedCycloStickersS4Snapshot(stage:CycloStickersS4IdentityStage,facts:Record<string,unknown>):CollectorAlbumSnapshot {
  return createCycloStickersPreparedSnapshot(assembleSource(stage,facts,"active"));
}
