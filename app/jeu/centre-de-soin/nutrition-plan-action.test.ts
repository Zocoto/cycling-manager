import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyNutritionPlanAction } from "./actions";
const mocks = vi.hoisted(() => ({getUser:vi.fn(),rpc:vi.fn(),revalidatePath:vi.fn()}));
vi.mock("@/lib/supabase/server", () => ({createSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidatePath}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(`redirect:${url}`);}}));
const riderId="00000000-0000-4000-8000-000000000001";
const nutritionistContractId="00000000-0000-4000-8000-000000000002";
const dose={riderId,nutritionistContractId,interventionCode:"recovery_snack"};
const program={riderId,weightDeltaKg:0.4};
function data(interventions:unknown,programs:unknown) {const form=new FormData();form.set("interventions",JSON.stringify(interventions));form.set("weightPrograms",JSON.stringify(programs));return form;}
beforeEach(()=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:"ds"}},error:null});mocks.rpc.mockResolvedValue({data:{},error:null});});
describe("atomic nutrition plan action",()=>{
  it.each([{interventions:[]},{interventions:[dose]}])("submits programmes and supplements together",async ({interventions})=>{
    await expect(applyNutritionPlanAction(data(interventions,[program]))).rejects.toThrow("plan=confirme");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("apply_current_team_nutrition_plan",{p_interventions:interventions,p_weight_programs:[program]});
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/effectif");
  });
  it("keeps the fast batch RPC for supplements alone",async()=>{
    await expect(applyNutritionPlanAction(data([dose],[]))).rejects.toThrow("nutrition=confirmee");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("apply_current_team_nutrition_interventions",{p_interventions:[dose]});
  });
  it.each([[[],[]],[[dose,dose],[program]],[[dose],[program,program]],[[dose],[{...program,weightDeltaKg:0.3}]],
    [[dose],[{...program,weightDeltaKg:"0.2"}]],[[dose],[{...program,riderId:"foreign-format"}]],[[dose],Array(36).fill(program)],
    [null,[program]],[[{...dose,interventionCode:"bad"}],[program]]])("rejects invalid and duplicate payloads before database work",async(interventions,programs)=>{
      await expect(applyNutritionPlanAction(data(interventions,programs))).rejects.toThrow("erreur=");
      expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  it("rejects malformed JSON",async()=>{const form=data([],[program]);form.set("weightPrograms","{");await expect(applyNutritionPlanAction(form)).rejects.toThrow("erreur=");expect(mocks.rpc).not.toHaveBeenCalled();});
  it("requires authentication",async()=>{mocks.getUser.mockResolvedValueOnce({data:{user:null},error:null});await expect(applyNutritionPlanAction(data([],[program]))).rejects.toThrow("redirect:/connexion");expect(mocks.rpc).not.toHaveBeenCalled();});
  it("shows refusals with no success notice or stale refresh",async()=>{mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"Forme insuffisante"}});await expect(applyNutritionPlanAction(data([dose],[program]))).rejects.toThrow("erreur=");expect(mocks.revalidatePath).not.toHaveBeenCalled();});
});
