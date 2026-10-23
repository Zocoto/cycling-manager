import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),entries:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createSupabaseServerClient:async()=>({})}));
vi.mock('@/lib/supabase/authenticated-user',()=>({getAuthenticatedUser:mocks.auth}));
vi.mock('@/services/season-four-gala-registration',()=>({getSeasonFourGalaEntries:mocks.entries}));
import {GET} from './route';
const request=(query='program=continental&profile=sprint&page=0')=>new Request('https://cyclostratege.fr/api/game/gala-s4/entries?'+query);
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({data:{user:{id:'player'}},error:null});mocks.entries.mockResolvedValue({teams:[],total:0,hasMore:false});});
describe('public gala entrants within the game',()=>{
 it('requires a session',async()=>{mocks.auth.mockResolvedValue({data:{user:null},error:null});expect((await GET(request())).status).toBe(401);expect(mocks.entries).not.toHaveBeenCalled();});
 it.each(['program=continental&profile=cobbles','program=world-tour&profile=sprint','program=continental&profile=sprint&page=-1','program=continental&profile=sprint&page=1001'])('rejects invalid or unbounded input %s',async query=>{expect((await GET(request(query))).status).toBe(400);expect(mocks.entries).not.toHaveBeenCalled();});
 it('reads one bounded page with private caching',async()=>{const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(mocks.entries).toHaveBeenCalledExactlyOnceWith({},'continental','sprint',0);});
 it('does not invent entrants when the database is unavailable',async()=>{mocks.entries.mockRejectedValue(Error('timeout'));expect((await GET(request())).status).toBe(503);});
});
