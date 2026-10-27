import { describe, expect, it } from "vitest";
import { loadSponsorObjectiveSportingContext } from "./sponsor-objective-sporting-context";

type Row = Record<string, unknown>;
type Filter = { kind: "eq" | "neq" | "in"; column: string; value: unknown };
type Request = { table: string; columns: string; filters: Filter[] };
const contract = (riderId: string, overrides: Row = {}): Row => ({
  rider_id: riderId, team_id: "team", start_season_id: "s4", end_season_id: "s4", status: "active", ...overrides,
});
const rider = (id: string, overrides: Row = {}): Row => ({ id, country_id: "fr", first_name: id, last_name: "Leader", status: "active", ...overrides });
const rating = (id: string, season = "s4", score = 70): Row => ({
  rider_id: id, season_id: season, mountain: score, hills: score, flat: score, time_trial: score,
  cobbles: score, sprint: score, acceleration: score, downhill: score, endurance: score,
  resistance: score, recovery: score, breakaway: score, prologue: score,
});

function fixture() {
  const tables: Record<string, Row[]> = {
    seasons: [{id:"s3",game_year:3,status:"completed"},{id:"s4",game_year:4,status:"active"},
      {id:"s5",game_year:5,status:"planned"},{id:"s6",game_year:6,status:"planned"}],
    team_seasons: [{team_id:"team",season_id:"s4",final_rank:18,division:{code:"world"}},
      {team_id:"team",season_id:"s5",final_rank:null,division:null}],
    rider_contracts: [], riders: [], countries: [{id:"fr",iso_alpha2:"fr"}], rider_season_ratings: [],
  };
  const requests: Request[] = [];
  let failingTable: string | undefined;
  const db = { from(table: string) {
    let columns = "";
    const filters: Filter[] = [];
    function resolve(single: boolean) {
      requests.push({table,columns,filters:[...filters]});
      if (table === failingTable) return {data:null,error:{message:"read unavailable"}};
      const rows = (tables[table] ?? []).filter(row => filters.every(filter => {
        const value = row[filter.column];
        if (filter.kind === "eq") return value === filter.value;
        if (filter.kind === "neq") return value !== filter.value;
        return (filter.value as unknown[]).includes(value);
      }));
      return {data:single?rows[0]??null:rows,error:null};
    }
    const query = {
      select(value:string) {columns=value;return query;},
      eq(column:string,value:unknown) {filters.push({kind:"eq",column,value});return query;},
      neq(column:string,value:unknown) {filters.push({kind:"neq",column,value});return query;},
      in(column:string,value:unknown[]) {filters.push({kind:"in",column,value});return query;},
      async returns() {return resolve(false);},
      async maybeSingle() {return resolve(true);},
    };
    // No mutation, RPC or global roster methods are available in this client.
    return query;
  }};
  const load = (options: Partial<Parameters<typeof loadSponsorObjectiveSportingContext>[0]> = {}) =>
    loadSponsorObjectiveSportingContext({supabase:db as never,seasonId:"s5",targetSeasonGameYear:5,teamId:"team",...options});
  return {tables,requests,load,fail:(table:string)=>{failingTable=table;}};
}

describe("sponsor objective sporting snapshot", () => {
  it("does not load S4 or an unidentified team's context", async () => {
    const f = fixture();
    expect(await f.load({targetSeasonGameYear:4})).toEqual({teamRiderCandidates:[]});
    expect(await f.load({teamId:undefined})).toEqual({teamRiderCandidates:[]});
    expect(f.requests).toEqual([]);
  });

  it("uses the current division and valid official rank, never the empty future registration", async () => {
    const f = fixture();
    const result = await f.load();
    expect(result.teamSportingContext).toEqual({currentDivision:"world",projectedDivision:"elite",projectedRank:18});
    expect(f.requests.filter(request=>request.table==="team_seasons")).toEqual([
      {table:"team_seasons",columns:"final_rank, division:divisions(code)",filters:[
        {kind:"eq",column:"team_id",value:"team"},{kind:"eq",column:"season_id",value:"s4"},
      ]},
    ]);
  });

  it.each([null,0,-1,NaN,1.5])("keeps an invalid rank %s unknown instead of projecting rank-one Elite", async rank => {
    const f = fixture();f.tables.team_seasons[0].final_rank=rank;
    expect((await f.load()).teamSportingContext).toEqual({currentDivision:"world",projectedDivision:null,projectedRank:null});
  });

  it("does not reinterpret an active season's fixed division from its current rank", async () => {
    const f = fixture();f.tables.seasons[1].status="completed";f.tables.seasons[2].status="active";
    f.tables.team_seasons[1]={team_id:"team",season_id:"s5",final_rank:3,division:{code:"national"}};
    expect((await f.load()).teamSportingContext).toEqual({currentDivision:"national",projectedDivision:"national",projectedRank:3});
  });

  it("retains unsigned current riders, adds confirmed arrivals and excludes only confirmed departures, retirees and stale contracts", async () => {
    const f = fixture();
    f.tables.rider_contracts=[
      contract("expiring-leader"),
      contract("covered",{end_season_id:"s5"}),
      contract("covered",{start_season_id:"s5",end_season_id:"s6",status:"planned"}),
      contract("incoming",{start_season_id:"s5",end_season_id:"s6",status:"planned"}),
      contract("departing"),contract("departing",{team_id:"other",start_season_id:"s5",end_season_id:"s5",status:"planned"}),
      contract("later-departure"),contract("later-departure",{team_id:"other",start_season_id:"s6",end_season_id:"s6",status:"planned"}),
      contract("retired"),contract("suspended"),
      contract("expired",{start_season_id:"s3",end_season_id:"s3"}),
      contract("terminated",{status:"terminated"}),
      contract("later-incoming",{start_season_id:"s6",end_season_id:"s6",status:"planned"}),
    ];
    f.tables.riders=["expiring-leader","covered","incoming","departing","later-departure","expired","terminated","later-incoming"]
      .map(id=>rider(id)).concat([rider("retired",{status:"retired"}),rider("suspended",{status:"suspended"})]);
    f.tables.rider_season_ratings=f.tables.riders.map(row=>rating(String(row.id)));
    const result=await f.load();
    expect(result.teamRiderCandidates.map(row=>row.riderId)).toEqual(["expiring-leader","covered","incoming","later-departure"]);
    expect(result.teamRiderCandidates.find(row=>row.riderId==="expiring-leader")).toMatchObject({overallRating:70,joinedForTargetSeason:false,countryCode:"FR"});
    expect(result.teamRiderCandidates.find(row=>row.riderId==="incoming")).toMatchObject({joinedForTargetSeason:true});
    expect(new Set(result.teamRiderCandidates.map(row=>row.riderId)).size).toBe(result.teamRiderCandidates.length);
  });

  it("prefers existing target-season ratings and falls back to current notes only for missing riders", async () => {
    const f = fixture();
    f.tables.rider_contracts=[contract("future-notes"),contract("current-only"),contract("no-notes")];
    f.tables.riders=[rider("future-notes"),rider("current-only"),rider("no-notes")];
    f.tables.rider_season_ratings=[rating("future-notes","s5",81),rating("future-notes","s4",70),rating("current-only","s4",65)];
    const result=await f.load();
    expect(result.teamRiderCandidates.map(row=>[row.riderId,row.overallRating])).toEqual([["future-notes",81],["current-only",65]]);
    const fallback=f.requests.find(request=>request.table==="rider_season_ratings"&&request.filters.some(filter=>filter.column==="season_id"&&filter.value==="s4"));
    expect(fallback?.filters).toContainEqual({kind:"in",column:"rider_id",value:["current-only","no-notes"]});
  });

  it("batches a large roster instead of one request per rider", async () => {
    const f=fixture();
    const ids=Array.from({length:151},(_,index)=>`rider-${index}`);
    f.tables.rider_contracts=ids.map(id=>contract(id));
    f.tables.riders=ids.map(id=>rider(id));
    f.tables.rider_season_ratings=ids.map(id=>rating(id));
    expect((await f.load()).teamRiderCandidates).toHaveLength(151);
    expect(f.requests.filter(request=>request.table==="riders")).toHaveLength(3);
    expect(f.requests.filter(request=>request.table==="team_seasons")).toHaveLength(1);
    for(const request of f.requests) for(const filter of request.filters) {
      if(filter.kind==="in") expect((filter.value as unknown[]).length).toBeLessThanOrEqual(75);
    }
  });

  it("fails explicitly on an unavailable roster rather than inventing a weak team", async () => {
    const f=fixture();f.fail("rider_contracts");
    await expect(f.load()).rejects.toThrow("read unavailable");
  });
});
