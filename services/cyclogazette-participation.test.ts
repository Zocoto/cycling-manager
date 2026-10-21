import { describe, expect, it, vi } from "vitest";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadCyclogazetteHumanRaceEditionIds, loadCyclogazetteHumanDevelopmentEditionIds } from "./cyclogazette-participation";
const admin=(rpc:ReturnType<typeof vi.fn>)=>({rpc}) as unknown as ReturnType<typeof createSupabaseAdminClient>;
describe("Gazette human participation loading",()=>{
 it("loads the day once and deduplicates editions",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:[{race_edition_id:"human"},{race_edition_id:"human"}],error:null});
  expect(await loadCyclogazetteHumanRaceEditionIds(admin(rpc),"day")).toEqual(["human"]);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("get_cyclogazette_human_race_editions",{p_season_day_id:"day",p_include_scheduled:false});
 });
 it("uses planned starters only for tomorrow's previews",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:[],error:null});
  expect(await loadCyclogazetteHumanRaceEditionIds(admin(rpc),"tomorrow",true)).toEqual([]);
  expect(rpc.mock.calls[0][1].p_include_scheduled).toBe(true);
 });
 it.each([{data:null,error:{message:"offline"}},{data:null,error:null}])("fails closed when participation cannot be verified",async result=>{
  await expect(loadCyclogazetteHumanRaceEditionIds(admin(vi.fn().mockResolvedValue(result)),"day")).rejects.toThrow("participation humaine");
 });
 it("skips empty junior lists and scopes a nonempty query",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:[{race_edition_id:"junior"}],error:null});
  expect(await loadCyclogazetteHumanDevelopmentEditionIds(admin(rpc),[])).toEqual([]);expect(rpc).not.toHaveBeenCalled();
  expect(await loadCyclogazetteHumanDevelopmentEditionIds(admin(rpc),["junior","junior"])).toEqual(["junior"]);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("get_cyclogazette_human_development_editions",{p_race_edition_ids:["junior"]});
 });
});
