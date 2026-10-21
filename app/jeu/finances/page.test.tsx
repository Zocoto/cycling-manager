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
  teamPoints:0,teamRank:null,divisionCode:"national",divisionName:"Nationale",chart:[],alerts:[],financialDirectorEffects:[],
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
  it("lists DF daily income and savings as receipts while retaining the gross expense",async()=>{
    mocks.overview.mockResolvedValue({ ...overview, transactions:[
      {id:"salary",dayNumber:14,amount:-1000,category:"staff_salary",status:"pending",description:"Salaires du staff",sourceReference:"staff-salary:contract:14",postedAt:null},
      {id:"df-saving",dayNumber:14,amount:40,category:"other",status:"pending",description:"Crédit DF sur les salaires",sourceReference:"financial-director:staff_salary:salary",postedAt:null},
      {id:"df-daily",dayNumber:14,amount:450,category:"other",status:"pending",description:"Revenu quotidien du DF",sourceReference:"financial-director:daily_income:14",postedAt:null},
    ], financialDirectorEffects:[
      {id:"df-saving",sourceTransactionId:"salary",dayNumber:14,amount:40,effect:"staff_salary",baseAmount:1000,bonusPercentage:4,status:"pending",description:"Crédit DF sur les salaires"},
      {id:"df-daily",sourceTransactionId:null,dayNumber:14,amount:450,effect:"daily_income",baseAmount:null,bonusPercentage:null,status:"pending",description:"Revenu quotidien du DF"},
    ] });
    const html=(await render()).replace(/\s/g," ");
    const receipts=html.slice(html.indexOf(">Recettes</h3>"),html.indexOf(">Dépenses brutes</h3>"));
    const charges=html.slice(html.indexOf(">Dépenses brutes</h3>"));
    expect(receipts).toContain("Revenu quotidien du DF");expect(receipts).toContain("DF · revenu quotidien");
    expect(receipts).toContain("DF · crédit d’économie");expect(receipts).toContain("+450 €");expect(receipts).toContain("+40 €");
    expect(charges).toContain("Dépense brute");expect(charges).toContain("−1 000 €");
    expect(charges).toContain("DF · économie");expect(charges).toContain("4 % sur 1 000 €");expect(charges).toContain("960 €");
    expect(charges).not.toContain("−960 €");expect(charges).not.toContain("Revenu quotidien du DF");
    expect(mocks.overview).toHaveBeenCalledTimes(1);
    const expenses=(await render("analyse-depenses")).replace(/\s/g," ");
    expect(expenses).toContain("Charges engagées");expect(expenses).toContain("Crédit d’économie DF");
    expect(expenses.indexOf("Charges engagées")).toBeLessThan(expenses.indexOf("Crédit d’économie DF"));
  });
});
