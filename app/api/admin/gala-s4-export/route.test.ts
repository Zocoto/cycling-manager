import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),generate:vi.fn(),database:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createSupabaseServerClient:async()=>({})}));
vi.mock('@/lib/supabase/authenticated-user',()=>({getAuthenticatedUser:mocks.user}));
vi.mock('@/services/season-four-gala-startlists',()=>({generateSeasonFourGalaStartlistExport:mocks.generate}));
vi.mock('@/services/pcm-export',()=>({generatePcmExport:mocks.database}));
import {POST} from './route';
import {GalaStartlistError} from '@/lib/game/season-four-gala-startlists';
const owner='58140add-54c6-40af-9528-f823d0051d0f';
const request=(query='',origin='https://cyclostratege.fr')=>new Request('https://cyclostratege.fr/api/admin/gala-s4-export?'+query,{method:'POST',headers:{origin,'x-cs-requested-with':'gala-s4-export'}});
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({data:{user:{id:owner}},error:null});mocks.generate.mockResolvedValue({data:new TextEncoder().encode('<startlist/>'),filename:'top_tdf.xml',contentType:'application/xml',teamCount:1,riderCount:7,template:false});mocks.database.mockResolvedValue({archive:new Uint8Array([80,75]),filename:'PCM-Gala-S4.zip'});});
describe('private gala downloads',()=>{
 it.each([null,{id:'another-player',user_metadata:{username:'Zocoto',role:'owner'}}])('rejects unauthorized user %j before any export',async user=>{
  mocks.user.mockResolvedValue({data:{user},error:null});expect((await POST(request())).status).toBe(user?404:401);expect(mocks.generate).not.toHaveBeenCalled();expect(mocks.database).not.toHaveBeenCalled();
 });
 it('rejects a cross-origin request',async()=>{expect((await POST(request('','https://other.example'))).status).toBe(403);expect(mocks.generate).not.toHaveBeenCalled();});
 it.each(['event=wrong','kind=bad','template=maybe'])('rejects invalid parameters: %s',async query=>expect((await POST(request(query))).status).toBe(400));
 it('returns a native XML attachment with private caching',async()=>{
  const response=await POST(request('event=world-tour%3Amountain'));expect(response.status).toBe(200);expect(response.headers.get('content-disposition')).toContain('filename="top_tdf.xml"');expect(response.headers.get('cache-control')).toContain('no-store');expect(await response.text()).toBe('<startlist/>');expect(mocks.generate).toHaveBeenCalledExactlyOnceWith('world-tour:mountain',false);
 });
 it('keeps model downloads explicit',async()=>{await POST(request('template=1'));expect(mocks.generate).toHaveBeenCalledExactlyOnceWith(undefined,true);});
 it('reports invalid rosters as an actionable conflict with no file',async()=>{mocks.generate.mockRejectedValue(new GalaStartlistError('7 à 8 coureurs requis'));const response=await POST(request());expect(response.status).toBe(409);expect(await response.json()).toEqual({error:'7 à 8 coureurs requis'});});
 it('uses the matching S4 database mode and preserves the old export mode',async()=>{const response=await POST(request('kind=database'));expect(response.status).toBe(200);expect(mocks.database).toHaveBeenCalledExactlyOnceWith(false,true);expect(mocks.generate).not.toHaveBeenCalled();});
});
