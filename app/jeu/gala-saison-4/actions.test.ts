import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),abort:vi.fn(),path:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("next/cache",()=>({revalidatePath:mocks.path}));
import {saveSeasonFourGalaRegistrationAction} from "./actions";
import {initialGalaRegistrationState} from "@/lib/game/season-four-gala-registration";
const ids=Array.from({length:7},(_,index)=>`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`);
const payload={program:"world-tour",selections:{mountain:ids,hills:ids,cobbles:ids}};
function form(value:unknown=payload,intent="save"){const form=new FormData();form.set("intent",intent);form.set("selection",JSON.stringify(value));return form;}
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({data:{user:{id:"own-user"}},error:null});mocks.rpc.mockReturnValue({abortSignal:mocks.abort});mocks.abort.mockResolvedValue({data:"own-registration",error:null});});
describe("gala registration action",()=>{
 it('requires authentication before every mutation',async()=>{mocks.auth.mockResolvedValue({data:{user:null},error:null});expect((await saveSeasonFourGalaRegistrationAction(initialGalaRegistrationState,form())).status).toBe('error');expect(mocks.rpc).not.toHaveBeenCalled();});
 it('registers the three compositions with one atomic call and no user-supplied owner',async()=>{expect((await saveSeasonFourGalaRegistrationAction(initialGalaRegistrationState,form())).status).toBe('success');expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('save_current_season_four_gala_registration',{p_program:'world-tour',p_selections:payload.selections});expect(mocks.path).toHaveBeenCalledExactlyOnceWith('/jeu/gala-saison-4');});
 it.each([{...payload,team_id:ids[0]},{...payload,selections:{mountain:ids,hills:ids,sprint:ids}},{...payload,selections:{...payload.selections,mountain:ids.slice(1)}},{...payload,selections:{...payload.selections,mountain:Array(7).fill(ids[0])}}])('rejects malformed or forged selection %j',async value=>{expect((await saveSeasonFourGalaRegistrationAction(initialGalaRegistrationState,form(value))).status).toBe('error');expect(mocks.rpc).not.toHaveBeenCalled();});
 it('withdraws only through the ownership-checked RPC',async()=>{expect((await saveSeasonFourGalaRegistrationAction(initialGalaRegistrationState,form(null,'withdraw'))).status).toBe('success');expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('withdraw_current_season_four_gala_registration');});
 it('keeps the page unchanged after a closed or failed registration',async()=>{mocks.abort.mockResolvedValue({error:{message:'Les inscriptions du gala sont closes.'}});expect(await saveSeasonFourGalaRegistrationAction(initialGalaRegistrationState,form())).toEqual({status:'error',message:'Les inscriptions du gala sont closes.'});expect(mocks.path).not.toHaveBeenCalled();});
 it('does not claim success after an uncertain network outcome',async()=>{mocks.abort.mockRejectedValue(new Error('timeout'));expect((await saveSeasonFourGalaRegistrationAction(initialGalaRegistrationState,form())).status).toBe('error');expect(mocks.path).not.toHaveBeenCalled();});
});
