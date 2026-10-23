import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),abort:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:mocks.rpc})}));
import { GalaResultImportError, importSeasonFourGalaResults } from "./season-four-gala-results";
const fixture=()=>({eventKey:"world-tour:mountain",results:Array.from({length:10},(_,i)=>({rank:i+1,riderId:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,teamId:"00000000-0000-4000-8000-000000000100"}))});
const receipt={eventKey:"world-tour:mountain",rewardedRiders:10,equipmentUnits:3,consumableUnits:25,alreadyImported:false};
beforeEach(()=>{vi.clearAllMocks();mocks.rpc.mockReturnValue({abortSignal:mocks.abort});mocks.abort.mockResolvedValue({data:receipt,error:null});});
describe("attribution du gala via une seule RPC bornée",()=>{
  it("convertit uniquement les dix lignes validées et exige le reçu complet",async()=>{
    expect(await importSeasonFourGalaResults(fixture())).toEqual(receipt);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('settle_season_four_gala_results',{p_event_key:'world-tour:mountain',p_results:fixture().results.map(row=>({rank:row.rank,rider_id:row.riderId,team_id:row.teamId}))});
    expect(mocks.abort).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it("refuse un classement invalide avant tout accès base",async()=>{await expect(importSeasonFourGalaResults({eventKey:'bad',results:[]})).rejects.toThrow();expect(mocks.rpc).not.toHaveBeenCalled();});
  it("ne confirme pas des crédits sans reçu complet",async()=>{mocks.abort.mockResolvedValue({data:null,error:null});await expect(importSeasonFourGalaResults(fixture())).rejects.toThrow('incomplet');});
  it("distingue un conflit métier d’un incident de transport",async()=>{mocks.abort.mockResolvedValue({data:null,error:{code:'P0001',message:'Déjà récompensé'}});await expect(importSeasonFourGalaResults(fixture())).rejects.toBeInstanceOf(GalaResultImportError);});
  it("signale un inventaire absent et ne simule aucun succès",async()=>{mocks.abort.mockResolvedValue({data:null,error:{code:'P0002'}});await expect(importSeasonFourGalaResults(fixture())).rejects.toThrow('Aucun lot');});
});
