import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),abort:vi.fn(),from:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:mocks.rpc,from:mocks.from})}));
import { GalaResultImportError, getSeasonFourGalaLiveParticipants, getSeasonFourGalaPublishedResults, importSeasonFourGalaResults } from "./season-four-gala-results";
const fixture=()=>({eventKey:"world-tour:mountain",results:Array.from({length:10},(_,i)=>({rank:i+1,riderId:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,teamId:"00000000-0000-4000-8000-000000000100"}))});
const receipt={eventKey:"world-tour:mountain",rewardedRiders:10,equipmentUnits:3,consumableUnits:25,alreadyImported:false};
beforeEach(()=>{vi.clearAllMocks();mocks.from.mockReset();mocks.rpc.mockReturnValue({abortSignal:mocks.abort});mocks.abort.mockResolvedValue({data:receipt,error:null});});
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

function readQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe("lecture des classements du gala", () => {
  it("évite toute lecture d’identité en l’absence de classement importé", async () => {
    const imports = readQuery([]);
    mocks.from.mockReturnValueOnce(imports);
    expect(await getSeasonFourGalaPublishedResults()).toEqual({});
    expect(mocks.from.mock.calls).toEqual([["season_gala_result_imports"]]);
    expect(imports.limit).toHaveBeenCalledWith(6);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("résout les noms par lots dans la saison de l’épreuve et ne renvoie que le classement public", async () => {
    const { eventKey, results } = fixture();
    const imports = readQuery([{
      event_key: eventKey,
      season_id: "season-four",
      results: results.map(({ rank, riderId, teamId }) => ({ rank, rider_id: riderId, team_id: teamId })).reverse(),
    }]);
    const riders = readQuery(results.map(({ rank, riderId }) => ({ id: riderId, first_name: "Coureur", last_name: String(rank) })));
    const teams = readQuery([{ team_id: results[0].teamId, display_name: "Club en saison 4" }]);
    mocks.from.mockReturnValueOnce(imports).mockReturnValueOnce(riders).mockReturnValueOnce(teams);

    expect(await getSeasonFourGalaPublishedResults()).toEqual({
      [eventKey]: results.map(({ rank }) => ({ rank, riderName: `Coureur ${rank}`, teamName: "Club en saison 4" })),
    });
    expect(imports.select).toHaveBeenCalledWith("event_key, season_id, results");
    expect(riders.in).toHaveBeenCalledWith("id", [...results].reverse().map(row => row.riderId));
    expect(teams.eq).toHaveBeenCalledWith("season_id", "season-four");
    expect(teams.in).toHaveBeenCalledWith("team_id", [results[0].teamId]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuse un classement incomplet avant les lectures d’identité", async () => {
    mocks.from.mockReturnValueOnce(readQuery([{ event_key: fixture().eventKey, season_id: "season-four", results: [] }]));
    await expect(getSeasonFourGalaPublishedResults()).rejects.toThrow();
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});

describe("lecture des participants au live", () => {
  it("pagine avec un ordre stable et préserve les pseudonymes homonymes", async () => {
    const first = readQuery(Array.from({ length: 500 }, () => ({ participant_name: "Pseudonyme" })));
    const second = readQuery([{ participant_name: "Pseudonyme" }, { participant_name: "Zocoto" }]);
    mocks.from.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const participants = await getSeasonFourGalaLiveParticipants();

    expect(participants).toEqual([...Array.from({ length: 501 }, () => "Pseudonyme"), "Zocoto"]);
    expect(first.select).toHaveBeenCalledExactlyOnceWith("participant_name");
    expect(first.order.mock.calls).toEqual([["participant_name"], ["auth_user_id"]]);
    expect(first.range).toHaveBeenCalledExactlyOnceWith(0, 499);
    expect(second.range).toHaveBeenCalledExactlyOnceWith(500, 999);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
