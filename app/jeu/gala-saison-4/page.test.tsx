import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),client:vi.fn(),header:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.user}));
vi.mock("@/services/game-header-data",()=>({getGameHeaderData:mocks.header}));
vi.mock("next/navigation",()=>({notFound:()=>{throw Error('NOT_FOUND');},redirect:(path:string)=>{throw Error('REDIRECT:'+path);}}));
vi.mock("@/components/game/game-header",()=>({GameHeader:()=>null}));
vi.mock("@/components/game/season-four-gala-preview",()=>({SeasonFourGalaPreview:()=>null}));
import SeasonFourGalaPage from "./page";

beforeEach(()=>{
  vi.clearAllMocks();mocks.client.mockResolvedValue({});
  mocks.header.mockResolvedValue({displayName:'Zocoto',teamSponsorVisual:null});
});
describe('gala page server access',()=>{
  it.each([null,{id:'other-account',email:'paul.leblanc22@gmail.com'},{id:'another-admin',user_metadata:{username:'Zocoto',role:'owner'}}])('rejects unauthorized identity %j before loading private content',async user=>{
    mocks.user.mockResolvedValue({data:{user},error:null});
    await expect(SeasonFourGalaPage()).rejects.toThrow(user?'NOT_FOUND':'REDIRECT:/connexion');
    expect(mocks.header).not.toHaveBeenCalled();
  });
  it('accepts the authenticated owner independently of email or display name',async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'58140add-54c6-40af-9528-f823d0051d0f',email:'owner@example.test'}},error:null});
    expect(await SeasonFourGalaPage()).toBeTruthy();
    expect(mocks.header).toHaveBeenCalledExactlyOnceWith({},'58140add-54c6-40af-9528-f823d0051d0f');
  });
  it('fails closed on an authentication error',async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'58140add-54c6-40af-9528-f823d0051d0f'}},error:{message:'Session expired'}});
    await expect(SeasonFourGalaPage()).rejects.toThrow('REDIRECT:/connexion');
    expect(mocks.header).not.toHaveBeenCalled();
  });
});
