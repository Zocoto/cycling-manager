import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),filters:[] as Array<{table:string;column:string;values:unknown}>,tables:[] as string[]}));
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:mocks.rpc,from:(table:string)=>{
 mocks.tables.push(table);
 const empty={data:[],error:null,count:0};
 const query={select:()=>query,eq:()=>query,neq:()=>query,not:()=>query,is:()=>query,order:()=>query,limit:()=>query,
 in:(column:string,values:unknown)=>{mocks.filters.push({table,column,values});return query;},
 returns:async()=>empty,then:(resolve:(value:unknown)=>void)=>resolve(empty)};
 return query;
}})}));
import { getCyclogazetteNewsItems, getDashboardPelotonNews } from "./public-game-news";
beforeEach(()=>{vi.clearAllMocks();mocks.filters=[];mocks.tables=[];mocks.rpc.mockResolvedValue({data:[],error:null});});
describe("Gazette scoped race news",()=>{
 it("filters recaps before their limit and scopes the victory RPC",async()=>{
  expect(await getCyclogazetteNewsItems(["mixed"])).toEqual([]);
  expect(mocks.filters.filter(f=>f.table==="post_race_news_events")).toEqual([
   {table:"post_race_news_events",column:"race_edition_id",values:["mixed"]},
   {table:"post_race_news_events",column:"race_edition_id",values:["mixed"]},
  ]);
  expect(mocks.rpc).toHaveBeenCalledWith("get_cyclogazette_human_race_victories",{p_race_edition_ids:["mixed"],p_limit:12});
  expect(mocks.rpc).not.toHaveBeenCalledWith("get_public_home_victories",expect.anything());
 });
 it("does not request any race data on a day with no human participation",async()=>{
  expect(await getCyclogazetteNewsItems([])).toEqual([]);
  expect(mocks.tables).not.toContain("post_race_news_events");expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.tables).toContain("sporting_directors");
 });
 it("keeps the dashboard's existing global victory behavior",async()=>{
  await getDashboardPelotonNews();expect(mocks.rpc).toHaveBeenCalledWith("get_public_home_victories",{p_limit:6});
 });
});
