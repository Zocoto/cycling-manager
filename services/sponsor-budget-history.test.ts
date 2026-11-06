import {beforeEach, describe, expect, it, vi} from "vitest";
import {SPONSORS} from "@/data/sponsors";
const mocks=vi.hoisted(()=>({admin:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:mocks.admin}));
import {getSponsorHistoryForTeam, getSponsorBudgetHistoryForTeam} from "./sponsor-budget-history";

let tables: Record<string, unknown[]>;
let failure: string | null;
let queries: {table:string;filters: [string,unknown][]}[];
function client() {
  return {from:vi.fn((table:string)=>{
    const trace={table,filters:[] as [string,unknown][]};queries.push(trace);
    const q={select:vi.fn(),eq:vi.fn((key:string,value:unknown)=>{trace.filters.push([key,value]);return q;}),
      neq:vi.fn(),in:vi.fn(),order:vi.fn(),limit:vi.fn(),abortSignal:vi.fn(),returns:vi.fn(async()=>({data:tables[table]??[],error:failure===table?{message:"offline"}:null}))};
    for(const name of ["select","neq","in","order","limit","abortSignal"] as const)q[name].mockReturnValue(q);
    return q;
  })};
}
beforeEach(()=>{
  queries=[];failure=null;
  tables={
    team_seasons:[{season_id:"s4",display_name:"Team",operating_budget:320000},{season_id:"s5",display_name:"Team",operating_budget:350720}],
    seasons:[{id:"s4",game_year:4,name:"Saison 4",status:"completed"},{id:"s5",game_year:5,name:"Saison 5",status:"active"}],
    team_sponsor_contracts:[{id:"c",sponsor_id:"sponsor",start_season_id:"s4",end_season_id:"s5",budget_per_season:350720,currency_code:"EUR",status:"active",created_at:"2026-10-01",sponsor_offer_id:"offer-s5",objective_season_id:"s5",satisfaction_score:0}],
    sponsors:[{id:"sponsor",catalog_key:SPONSORS[0].id}],
    sponsor_annual_objective_history:[{team_sponsor_contract_id:"c",season_id:"s4",budget_per_season:320000,sponsor_offer_id:"offer-s4",satisfaction_score:98}],
    sponsor_objectives:[{id:"o",name:"Classement UCI",display_order:1,status:"completed",satisfaction_points:12,target_details:{kind:"uci_ranking",rankingScope:"teams",targetRank:80},objective_progress:[{current_value:"35.00",status:"achieved",details:{targetValue:80}}]}],
  };
  mocks.admin.mockReturnValue(client());
});

describe("sponsor annual history loading",()=>{
  it("reuses the existing history and adds one owner-scoped objective read",async()=>{
    const result=await getSponsorHistoryForTeam("team");
    expect(result.previousSeasonReview).toMatchObject({gameYear:4,currentGameYear:5,satisfactionScore:98,previousBudget:320000,currentBudget:350720,sameContract:true,objectivesAvailable:true,objectives:[{currentValue:35,status:"completed"}]});
    expect(queries).toHaveLength(6);
    expect(queries.find(q=>q.table==="sponsor_objectives")?.filters).toEqual([
      ["sponsor_offer_id","offer-s4"],["season_id","s4"],["objective_progress.team_sponsor_contract_id","c"],["objective_progress.season_id","s4"],
    ]);
    expect(queries.find(q=>q.table==="team_sponsor_contracts")?.filters).toContainEqual(["team_id","team"]);
  });
  it("keeps the old history helper at five reads",async()=>{
    expect(await getSponsorBudgetHistoryForTeam("team")).toHaveLength(2);
    expect(queries).toHaveLength(5);
  });
  it("uses the ended contract's retained counters when there is no annual archive",async()=>{
    tables.sponsor_annual_objective_history=[];
    tables.team_sponsor_contracts=[{...(tables.team_sponsor_contracts[0] as object),status:"completed",end_season_id:"s4",objective_season_id:"s4",sponsor_offer_id:"offer-s4",satisfaction_score:75}];
    const result=await getSponsorHistoryForTeam("team");
    expect(result.previousSeasonReview).toMatchObject({satisfactionScore:75,sameContract:false,currentSponsorName:null});
  });
  it("does not reuse reset current-season scores or objectives when an archive is missing",async()=>{
    tables.sponsor_annual_objective_history=[];
    const result=await getSponsorHistoryForTeam("team");
    expect(result.previousSeasonReview).toMatchObject({satisfactionScore:null,objectivesAvailable:false});
    expect(queries).toHaveLength(5);
  });
  it("keeps the prior sponsor's review when a different sponsor takes over",async()=>{
    tables.team_sponsor_contracts=[
      {...(tables.team_sponsor_contracts[0] as object),status:"completed",end_season_id:"s4",objective_season_id:"s4",sponsor_offer_id:"offer-s4",satisfaction_score:98},
      {...(tables.team_sponsor_contracts[0] as object),id:"new",sponsor_id:"new-sponsor",start_season_id:"s5",satisfaction_score:0},
    ];
    tables.sponsors.push({id:"new-sponsor",catalog_key:SPONSORS[1].id});
    const result=await getSponsorHistoryForTeam("team");
    expect(result.previousSeasonReview).toMatchObject({sameContract:false,sponsorName:SPONSORS[0].name,currentSponsorName:SPONSORS[1].name,satisfactionScore:98});
    expect(queries.find(q=>q.table==="sponsor_objectives")?.filters).toContainEqual(["sponsor_offer_id","offer-s4"]);
  });
  it("does not skip back to an unrelated season or report amateur years as failures",async()=>{
    tables.seasons=[{id:"s4",game_year:3,name:"S3",status:"completed"},{id:"s5",game_year:5,name:"S5",status:"active"}];
    expect((await getSponsorHistoryForTeam("team")).previousSeasonReview).toBeNull();
    expect(queries).toHaveLength(5);
    queries=[];tables.team_sponsor_contracts=[];
    expect((await getSponsorHistoryForTeam("team")).previousSeasonReview).toBeNull();
  });
  it("keeps financial history and archived satisfaction visible if the optional detail fails",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});failure="sponsor_objectives";
    expect(await getSponsorHistoryForTeam("team")).toMatchObject({budgetHistory:expect.any(Array),previousSeasonReview:{satisfactionScore:98,objectivesAvailable:false}});
    expect(queries).toHaveLength(6);log.mockRestore();
  });
  it("never touches the database for a missing team",async()=>{
    expect(await getSponsorHistoryForTeam(" ")).toEqual({budgetHistory:[],previousSeasonReview:null});expect(queries).toHaveLength(0);
  });
});
