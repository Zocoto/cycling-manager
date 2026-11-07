import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),client:vi.fn(),header:vi.fn(),results:vi.fn(),live:vi.fn(),status:vi.fn()}));
vi.mock("@/services/season-four-gala-results",()=>({getSeasonFourGalaPublishedResults:mocks.results,getSeasonFourGalaLiveParticipants:mocks.live}));
vi.mock("@/services/season-four-gala-startlists",()=>({getSeasonFourGalaExportStatus:mocks.status}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.user}));
vi.mock("@/services/game-header-data",()=>({getGameHeaderData:mocks.header}));
vi.mock("next/navigation",()=>({notFound:()=>{throw Error('NOT_FOUND');},redirect:(path:string)=>{throw Error('REDIRECT:'+path);}}));
vi.mock("@/components/game/game-header",()=>({GameHeader:()=>null}));
vi.mock("@/components/game/season-four-gala-exports",()=>({SeasonFourGalaExports:()=>"Exports privés"}));
vi.mock("@/components/ui/app-link",()=>({default:({href,children}:{href:string;children:React.ReactNode})=><a href={href}>{children}</a>}));
import SeasonFourGalaPage from "./page";

beforeEach(()=>{
  vi.clearAllMocks();mocks.client.mockResolvedValue({});
  mocks.header.mockResolvedValue({displayName:'Zocoto',teamSponsorVisual:null});
  mocks.results.mockResolvedValue({});
  mocks.live.mockResolvedValue([]);
  mocks.status.mockResolvedValue({counts:{}});
});
describe('gala page server access',()=>{
  it.each([null])('rejects anonymous identity %j before loading content',async user=>{
    mocks.user.mockResolvedValue({data:{user},error:null});
    await expect(SeasonFourGalaPage()).rejects.toThrow(user?'NOT_FOUND':'REDIRECT:/connexion');
    expect(mocks.header).not.toHaveBeenCalled();
    expect(mocks.results).not.toHaveBeenCalled();
    expect(mocks.live).not.toHaveBeenCalled();
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it('shows the six results panels to an authenticated player while validation is pending',async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'ordinary-player'}},error:null});
    const html = renderToStaticMarkup(await SeasonFourGalaPage());
    expect(html).toContain('Résultats en cours de traitement');
    expect(html.match(/<figure/g)).toHaveLength(6);
    expect(html).toContain('GP Dunkerque');
    expect(html).toContain('La liste de présence est en cours de traitement.');
    expect(html).not.toContain('Exports privés');
    expect(html).not.toContain('<form');
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it('shows a validated race and attendance gifts alongside pending races',async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'ordinary-player'}},error:null});
    mocks.results.mockResolvedValue({'continental:sprint':Array.from({length:10},(_,i)=>({rank:i+1,riderName:`Coureur ${i+1}`,teamName:'Club du gala'}))});
    mocks.live.mockResolvedValue(['Un participant']);
    const html = renderToStaticMarkup(await SeasonFourGalaPage());
    expect(html).toContain('Top 10 · GP Dunkerque');
    expect(html).toContain('+3 SPR');
    expect(html).toContain('Bloc haute intensité');
    expect(html).toContain('Résultats en cours de traitement');
    expect(html).toContain('Un participant');
    expect(html).toContain('Gants Nuit dorée · +1 VAL');
    expect(html).toContain('contactez directement Zocoto');
  });
  it('accepts the authenticated owner independently of email or display name',async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'58140add-54c6-40af-9528-f823d0051d0f',email:'owner@example.test'}},error:null});
    expect(renderToStaticMarkup(await SeasonFourGalaPage())).toContain('Exports privés');
    expect(mocks.status).toHaveBeenCalledOnce();
    expect(mocks.header).toHaveBeenCalledExactlyOnceWith({},'58140add-54c6-40af-9528-f823d0051d0f');
  });
  it('fails closed on an authentication error',async()=>{
    mocks.user.mockResolvedValue({data:{user:{id:'58140add-54c6-40af-9528-f823d0051d0f'}},error:{message:'Session expired'}});
    await expect(SeasonFourGalaPage()).rejects.toThrow('REDIRECT:/connexion');
    expect(mocks.header).not.toHaveBeenCalled();
  });
});
