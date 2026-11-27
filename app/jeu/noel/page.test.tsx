import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
const mocked=vi.hoisted(()=>({user:{id:"user",email:"member@example.test"} as {id:string;email:string}|null,locale:"fr" as "fr"|"en"}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({})}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:async()=>({data:{user:mocked.user},error:null})}));
vi.mock("@/lib/i18n/server",()=>({getRequestLocale:async()=>mocked.locale}));
vi.mock("@/services/game-header-data",()=>({getGameHeaderData:async()=>({displayName:"Manager"})}));
vi.mock("@/components/game/game-header",()=>({GameHeader:()=> <header data-real-game-header/>}));
vi.mock("next/navigation",()=>({redirect:(href:string)=>{throw Error(`redirect:${href}`)}}));
import ChristmasPage from "./page";
import {validChristmasFrameHeight} from "./christmas-experience-frame";

beforeEach(()=>{mocked.user={id:"user",email:"member@example.test"};mocked.locale="fr";vi.useRealTimers()});
describe("public Christmas page",()=>{
  it("keeps the real header but does not load the playable frame before opening",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-30T22:59:59.999Z"));
    const html=renderToStaticMarkup(await ChristmasPage());
    expect(html).toContain("data-real-game-header");expect(html).toContain("data-christmas-upcoming");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("heure de Paris");
  });
  it("opens the validated experience after Paris midnight and forwards the language",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-30T23:00:00Z"));mocked.locale="en";
    const html=renderToStaticMarkup(await ChristmasPage());
    expect(html).toContain("data-real-game-header");
    expect(html).toContain('/jeu/noel/experience/index.html?lang=en');
    expect(html).not.toContain("data-christmas-upcoming");
  });
  it("keeps an authenticated archive after games close",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-12-31T23:00:00Z"));
    const html=renderToStaticMarkup(await ChristmasPage());
    expect(html).toContain("Les tournées de Noël sont terminées");
    expect(html).toContain("data-christmas-experience-frame");
  });
  it("requires the actual game session",async()=>{mocked.user=null;await expect(ChristmasPage()).rejects.toThrow("redirect:/connexion")});
  it("accepts only bounded finite iframe heights",()=>{
    for(const value of [480,1_400,24_000]) expect(validChristmasFrameHeight(value)).toBe(true);
    for(const value of [0,199,24_001,Number.NaN,Infinity,"1400",null]) expect(validChristmasFrameHeight(value)).toBe(false);
  });
});
