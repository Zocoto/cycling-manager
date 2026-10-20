import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamFinanceOverview } from "@/services/team-finances";
const mocks=vi.hoisted(()=>({ client:vi.fn(),auth:vi.fn(),header:vi.fn(),overview:vi.fn(),redirect:vi.fn((url:string)=>{throw Error(`redirect:${url}`);}) }));
vi.mock("next/navigation",()=>({ redirect:mocks.redirect }));
vi.mock("@/lib/supabase/server",()=>({ createSupabaseServerClient:mocks.client }));
vi.mock("@/lib/supabase/authenticated-user",()=>({ getAuthenticatedUser:mocks.auth }));
vi.mock("@/services/game-header-data",()=>({ getGameHeaderData:mocks.header }));
vi.mock("@/services/team-finances",()=>({ getCurrentTeamFinanceOverview:mocks.overview }));
vi.mock("@/components/game/game-header",()=>({ GameHeader:()=>null }));
vi.mock("@/components/game/back-to-office-link",()=>({ BackToOfficeLink:()=>null }));
vi.mock("@/components/game/finance-balance-chart",()=>({ FinanceBalanceChart:()=> <div>Projection de trésorerie</div> }));
vi.mock("@/components/ui/app-link",()=>({ default:({children,prefetchOnIntent,...props}:{children:ReactNode;prefetchOnIntent?:boolean})=>{void prefetchOnIntent;return <a {...props}>{children}</a>;} }));
import Page from "./page";
const overview:TeamFinanceOverview={teamId:"team",teamName:"Équipe test",seasonName:"Saison 4",currentDayNumber:12,currency:"EUR",
  openingBalance:1000,balance:1070,projectedBalance:1110,totalIncome:140,totalExpenses:30,canSpend:true,
  teamPoints:0,teamRank:null,divisionCode:"national",divisionName:"Nationale",chart:[],alerts:[],
  transactions:[
    {id:"sponsor",dayNumber:7,amount:100,category:"sponsor",status:"posted",description:"Versement sponsor",sourceReference:"sponsor:contract:7",postedAt:null},
    {id:"race",dayNumber:28,amount:40,category:"race_prize",status:"pending",description:"Prime connue",sourceReference:"reward:official-race:edition",postedAt:null},
    {id:"salary",dayNumber:7,amount:-30,category:"rider_salary",status:"posted",description:"Salaire",sourceReference:"rider-salary:contract:7",postedAt:null},
  ]};
beforeEach(()=>{
  vi.clearAllMocks();mocks.client.mockResolvedValue({});mocks.auth.mockResolvedValue({data:{user:{id:"player",email:"player@example.test"}},error:null});
  mocks.header.mockResolvedValue({displayName:"DS",teamSponsorVisual:null});mocks.overview.mockResolvedValue(overview);
});
async function render(onglet?:string|string[]){return renderToStaticMarkup(await Page({searchParams:Promise.resolve({onglet})}));}
describe("finance tabs",()=>{
  it("opens income directly and reuses the existing financial overview exactly once",async()=>{
    const html=await render("analyse-recettes");
    expect(html).toContain("Analyse des recettes");expect(html).toContain("D’où vient l’argent");
    expect(html).not.toContain("Où part l’argent");expect(html).not.toContain("Projection de trésorerie");
    expect(html).toMatch(/href="\/jeu\/finances\?onglet=analyse-recettes"[^>]*aria-current="page"/);
    expect(html).toContain("sm:grid-cols-3");
    expect(mocks.overview).toHaveBeenCalledExactlyOnceWith(expect.anything(),"player");
    expect(mocks.header).toHaveBeenCalledTimes(1);expect(mocks.client).toHaveBeenCalledTimes(1);
  });
  it.each([undefined,"inconnu"])("keeps the treasury as default for %s",async(value)=>{
    const html=await render(value);expect(html).toContain("Projection de trésorerie");expect(html).toContain("Gains et pertes");
    expect(html).not.toContain("D’où vient l’argent");
  });
  it("keeps the expense view and all three navigation links",async()=>{
    const html=await render("analyse-depenses");expect(html).toContain("Où part l’argent");expect(html).toContain("Charges engagées");
    expect(html).toContain('href="/jeu/finances"');expect(html).toContain('href="/jeu/finances?onglet=analyse-recettes"');
  });
  it("accepts an income bookmark with repeated query parameters",async()=>{expect(await render(["analyse-recettes","analyse-depenses"])).toContain("D’où vient l’argent");});
  it("protects financial data before loading it",async()=>{
    mocks.auth.mockResolvedValue({data:{user:null},error:null});
    await expect(render("analyse-recettes")).rejects.toThrow("redirect:/connexion");expect(mocks.overview).not.toHaveBeenCalled();
  });
});
