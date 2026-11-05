import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createCycloStickersFinalSnapshot, serializeCycloStickersSnapshot } from "./cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "./cyclo-stickers-final-snapshot.fixture";
import { assembleCompletedCycloStickersS4Source, assemblePreparedCycloStickersS4Snapshot, type CycloStickersS4IdentityStage } from "./cyclo-stickers-source";

function fixture() {
  const source = createFinalCycloStickersSourceFixture();
  const capturedAt = "2026-11-05T10:00:00.000Z";
  const core: Omit<CycloStickersS4IdentityStage,"sha256"> = {
    schemaVersion:1,kind:"s4-active-identity-evidence",sportingResultsFinal:false,
    sourceSeasonId:source.season.id,sourceSeason:4,sourceSeasonStatus:"active",startsOn:source.season.startsOn,endsOn:source.season.endsOn,capturedAt,capturedUntil:capturedAt,
    selection:{provisionalTopRank:200,knownChampions:13,profileCount:source.riders.length},
    riders:source.riders.map(row=>({id:row.id,name:row.name,country:row.country,countryCode:row.countryCode,avatarProfileKey:row.avatarProfileKey,avatarSeed:String(row.avatarSeed),teamId:row.teamId,capturedAt,
      contractEvidence:{contractId:row.id,startSeasonId:source.season.id,endSeasonId:source.season.id,startGameYear:4,endGameYear:4},provisionalUciRank:null,knownChampionships:[]})),
    teams:source.teams.map(row=>({teamId:row.teamId,teamName:row.name,jersey:row.jersey,sourceSeasonId:source.season.id,capturedAt,contractEvidence:[]})),assets:[],
  };
  const stage = {...core,sha256:createHash("sha256").update(serializeCycloStickersSnapshot(core)).digest("hex")};
  const facts = {
    context:[{sourceSeasonId:source.season.id,sourceSeason:4,sourceSeasonStatus:"completed",startsOn:source.season.startsOn,endsOn:source.season.endsOn,capturedAt:source.capturedAt}],
    ranking:source.ranking,bonusRanking:source.bonusRanking,
    teams:source.teams.map(({sourceSeasonId,teamId,rank,name,points})=>({sourceSeasonId,teamId,rank,name,points})),
    championships:source.championships,
    ratings:source.riders.map(row=>({sourceSeasonId:source.season.id,riderId:row.id,age:row.age,...row.ratings})),
    honours:source.riders.flatMap(row=>row.honours.map(honour=>({...honour,riderId:row.id}))),
    contracts:source.riders.map(row=>({riderId:row.id,contractId:row.id,teamId:row.teamId,startGameYear:4,endGameYear:4,status:"active",leftGameYear:null,leftDayNumber:null})),
    naturalizations:[],
  };
  return {source,stage,facts};
}

it("combines the three official bonus rows with their own retained S4 identities, ratings and honours",()=>{
  const {source,stage,facts}=fixture();
  const completed=assembleCompletedCycloStickersS4Source(stage,facts);
  expect(completed.bonusRanking).toEqual(source.bonusRanking);
  const snapshot=createCycloStickersFinalSnapshot(completed);
  expect(snapshot.cards).toHaveLength(72);
  for(const [index,row] of source.bonusRanking.entries()){
    const native=source.riders.find(rider=>rider.id===row.riderId)!;
    expect(snapshot.cards[69+index]).toMatchObject({number:70+index,id:row.riderId,rank:row.rank,profileKey:"breakaway",ratings:native.ratings});
    expect(snapshot.cards[69+index].honours[0].raceEditionId).toBe(native.honours[0].raceEditionId);
  }
});

it("builds the same 72 genuine cards as provisional evidence without promoting active sporting facts",()=>{
  const {stage,facts}=fixture();
  const active={...facts,context:[{...facts.context[0],sourceSeasonStatus:"active",capturedAt:stage.capturedUntil}]};
  const snapshot=assemblePreparedCycloStickersS4Snapshot(stage,active);
  expect(snapshot.cards).toHaveLength(72);
  expect(snapshot.sourceSeasonStatus).toBe("active");
  expect(()=>assembleCompletedCycloStickersS4Source(stage,active)).toThrow();
});

it("refuses incomplete bonus facts and cannot fall back to S5 identity data",()=>{
  const {source,stage,facts}=fixture();
  expect(()=>assembleCompletedCycloStickersS4Source(stage,{...facts,bonusRanking:undefined})).toThrow();
  expect(()=>assembleCompletedCycloStickersS4Source(stage,{...facts,ratings:facts.ratings.filter(row=>row.riderId!==source.bonusRanking[0].riderId)})).toThrow();
  const {sha256:_sha256,...core}=stage;
  void _sha256;
  const missing={...core,riders:core.riders.filter(row=>row.id!==source.bonusRanking[0].riderId)};
  const incomplete={...missing,sha256:createHash("sha256").update(serializeCycloStickersSnapshot(missing)).digest("hex")};
  expect(()=>assembleCompletedCycloStickersS4Source(incomplete,facts)).toThrow(/no S5 fallback/);
  const forged=fixture();
  forged.facts.ratings.find(row=>row.riderId===forged.source.bonusRanking[0].riderId)!.mountain=99;
  forged.facts.ratings.find(row=>row.riderId===forged.source.bonusRanking[0].riderId)!.timeTrial=99;
  expect(()=>assembleCompletedCycloStickersS4Source(forged.stage,forged.facts)).toThrow(/primary Baroudeur/);
});

it("keeps the frozen S4 club when rollover stamps natural expiry as completed on S4/J28",()=>{
  const {source,stage,facts}=fixture();
  const expired=facts.contracts.map(row=>({...row,status:"completed",leftGameYear:4,leftDayNumber:28}));
  const completed=assembleCompletedCycloStickersS4Source(stage,{...facts,contracts:expired});
  const rider=completed.riders.find(row=>row.id===source.riders[0].id)!;
  expect(rider.teamId).toBe(source.riders[0].teamId);
  expect(rider.jersey).toEqual(stage.teams.find(row=>row.teamId===rider.teamId)!.jersey);
  expect(rider.jerseySeasonId).toBe(source.season.id);
  expect(createCycloStickersFinalSnapshot(completed).cards).toHaveLength(72);
});

it.each([
  {status:"completed",endGameYear:4,leftDayNumber:27},
  {status:"terminated",endGameYear:4,leftDayNumber:28},
  {status:"completed",endGameYear:5,leftDayNumber:28},
])("rejects an early or terminated departure instead of treating it as natural expiry: %j",departure=>{
  const {stage,facts}=fixture();
  const contracts=facts.contracts.map((row,index)=>index===0?{...row,...departure,leftGameYear:4}:row);
  expect(()=>assembleCompletedCycloStickersS4Source(stage,{...facts,contracts})).toThrow(/ambiguous\/missing end-of-S4 contract/);
});

it("prefers a contract still covering S4 over the natural-expiry fallback and keeps ambiguity closed",()=>{
  const {source,stage,facts}=fixture();
  const riderId=source.riders[0].id;
  const expired={...facts.contracts[0],status:"completed",leftGameYear:4,leftDayNumber:28};
  const continuing={...facts.contracts[0],teamId:source.teams[1].teamId,endGameYear:5};
  const remaining=facts.contracts.slice(1);
  const completed=assembleCompletedCycloStickersS4Source(stage,{...facts,contracts:[expired,continuing,...remaining]});
  expect(completed.riders.find(row=>row.id===riderId)!.teamId).toBe(continuing.teamId);
  expect(()=>assembleCompletedCycloStickersS4Source(stage,{...facts,contracts:[expired,continuing,...facts.contracts]})).toThrow(/ambiguous\/missing end-of-S4 contract/);
  expect(()=>assembleCompletedCycloStickersS4Source(stage,{...facts,contracts:[expired,{...expired,teamId:continuing.teamId},...remaining]})).toThrow(/ambiguous\/missing end-of-S4 contract/);
});
