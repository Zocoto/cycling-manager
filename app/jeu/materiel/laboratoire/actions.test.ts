import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),auth:vi.fn(),revalidate:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(url);}}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
import {startEquipmentRndAction} from "./actions";
const id="00000000-0000-4000-8000-000000000001";
const form=(focus="mountain")=>{const f=new FormData();f.set("equipmentItemId",id);f.set("engineerContractId",id);f.set("researchFocus",focus);return f;};
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({data:{user:{id}},error:null});mocks.rpc.mockResolvedValue({error:null});});
describe("R&D research launch boundary",()=>{
  it("validates the focus before touching the database",async()=>{await expect(startEquipmentRndAction(form("invalid"))).rejects.toThrow("Orientation");expect(mocks.rpc).not.toHaveBeenCalled();});
  it("sends focus with the original safe equipment and engineer IDs",async()=>{await expect(startEquipmentRndAction(form())).rejects.toThrow("recherche=lancee");expect(mocks.rpc).toHaveBeenCalledWith("start_current_team_equipment_rnd",{p_equipment_item_id:id,p_engineer_contract_id:id,p_prototype_name:null,p_research_focus:"mountain"});expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/inventaire");});
  it("retains uniform research when no direction is selected",async()=>{await expect(startEquipmentRndAction(form(""))).rejects.toThrow("recherche=lancee");expect(mocks.rpc).toHaveBeenCalledWith("start_current_team_equipment_rnd",expect.objectContaining({p_research_focus:null}));});
  it("requires authentication and preserves server refusals",async()=>{mocks.auth.mockResolvedValue({data:{user:null},error:null});await expect(startEquipmentRndAction(form())).rejects.toThrow("connexion");expect(mocks.rpc).not.toHaveBeenCalled();mocks.auth.mockResolvedValue({data:{user:{id}},error:null});mocks.rpc.mockResolvedValue({error:{message:"Ingénieur occupé"}});await expect(startEquipmentRndAction(form())).rejects.toThrow("erreur=");expect(mocks.revalidate).not.toHaveBeenCalled();});
});
