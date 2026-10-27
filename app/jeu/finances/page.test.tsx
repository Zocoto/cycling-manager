import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamFinanceOverview, TeamFinanceTransaction } from "@/services/team-finances";
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
const textContent = (html:string) => html.replace(/<[^>]+>/g, "").replace(/\s/g, " ");
function ledgerSection(html:string, id:"operations-a-venir"|"historique-financier") {
  const start=html.indexOf(`<details id="${id}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  let depth=0;
  for(const tag of html.slice(start).matchAll(/<details\b[^>]*>|<\/details>/g)) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if(depth===0) return html.slice(start,start+tag.index!+tag[0].length);
  }
  throw Error(`Unclosed financial section: ${id}`);
}
function metric(html:string,label:string) {
  const article=[...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)]
    .map(match=>textContent(match[0])).find(text=>text.startsWith(label));
  expect(article,`Missing finance metric: ${label}`).toBeDefined();
  return article!;
}
function treasuryFixture():TeamFinanceOverview {
  const row=(id:string,amount:number,status:TeamFinanceTransaction["status"],dayNumber:number,description:string,sourceReference=`fixture:${id}`):TeamFinanceTransaction => ({
    id,amount,status,dayNumber,description,sourceReference,category:amount<0?"rider_salary":"race_prize",postedAt:status==="posted"?"2026-10-27T10:00:00Z":null,
  });
  return {...overview,openingBalance:1000,balance:1150,projectedBalance:1240,totalIncome:310,totalExpenses:70,transactions:[
    row("sponsor-paid",100,"posted",7,"Sponsor déjà encaissé"),
    row("tour-stage",17.5,"posted",10,"Tour terminé — Étape 4", "reward:official-stage-prize:tour-edition:stage:4:rider:r1:v1"),
    row("tour-general",42.5,"posted",10,"Tour terminé — Classement général", "reward:official-race:tour-edition:rider:r1:v1"),
    row("one-day",20,"posted",11,"Course d’un jour — Victoire", "reward:official-race:one-day-edition:rider:r1:v1"),
    row("salary-paid",-30,"posted",7,"Salaire déjà payé"),
    row("future-income",80,"pending",14,"Versement à recevoir"),
    row("late-income",50,"pending",2,"Prime ancienne non versée"),
    row("future-salary",-40,"pending",21,"Salaire à payer"),
    row("cancelled-income",9999,"cancelled",28,"Prime annulée"),
    row("cancelled-expense",-8888,"cancelled",28,"Charge annulée"),
  ]};
}
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
    const html=await render(value);expect(html).toContain("Projection de trésorerie");expect(html).toContain("Historique · déjà comptabilisé");
    expect(html).not.toContain("D’où vient l’argent");
  });
  it("keeps the expense view and all three navigation links",async()=>{
    const html=await render("analyse-depenses");expect(html).toContain("Où part l’argent");expect(html).toContain("Charges brutes de la saison");
    expect(html).toContain('href="/jeu/finances"');expect(html).toContain('href="/jeu/finances?onglet=analyse-recettes"');
  });
  it("accepts an income bookmark with repeated query parameters",async()=>{expect(await render(["analyse-recettes","analyse-depenses"])).toContain("D’où vient l’argent");});
  it("protects financial data before loading it",async()=>{
    mocks.auth.mockResolvedValue({data:{user:null},error:null});
    await expect(render("analyse-recettes")).rejects.toThrow("redirect:/connexion");expect(mocks.overview).not.toHaveBeenCalled();
  });
  it("lists DF daily income and savings as receipts while retaining the gross expense",async()=>{
    mocks.overview.mockResolvedValue({ ...overview, balance:1000,projectedBalance:490,totalIncome:490,totalExpenses:1000,transactions:[
      {id:"salary",dayNumber:14,amount:-1000,category:"staff_salary",status:"pending",description:"Salaires du staff",sourceReference:"staff-salary:contract:14",postedAt:null},
      {id:"df-saving",dayNumber:14,amount:40,category:"other",status:"pending",description:"Crédit DF sur les salaires",sourceReference:"financial-director:staff_salary:salary",postedAt:null},
      {id:"df-daily",dayNumber:14,amount:450,category:"other",status:"pending",description:"Revenu quotidien du DF",sourceReference:"financial-director:daily_income:14",postedAt:null},
    ], financialDirectorEffects:[
      {id:"df-saving",sourceTransactionId:"salary",dayNumber:14,amount:40,effect:"staff_salary",baseAmount:1000,bonusPercentage:4,status:"pending",description:"Crédit DF sur les salaires"},
      {id:"df-daily",sourceTransactionId:null,dayNumber:14,amount:450,effect:"daily_income",baseAmount:null,bonusPercentage:null,status:"pending",description:"Revenu quotidien du DF"},
    ] });
    const html=ledgerSection(await render(),"operations-a-venir").replace(/\s/g," ");
    const receipts=html.slice(html.indexOf(">Recettes</h3>"),html.indexOf(">Dépenses brutes</h3>"));
    const charges=html.slice(html.indexOf(">Dépenses brutes</h3>"));
    expect(receipts).toContain("Revenu quotidien du DF");expect(receipts).toContain("DF · revenu quotidien");
    expect(receipts).toContain("DF · crédit d’économie");expect(receipts).toContain("+450 €");expect(receipts).toContain("+40 €");
    expect(charges).toContain("Dépense brute");expect(charges).toContain("−1 000 €");
    expect(charges).toContain("DF · économie");expect(charges).toContain("4 % sur 1 000 €");expect(charges).toContain("960 €");
    expect(charges).not.toContain("−960 €");expect(charges).not.toContain("Revenu quotidien du DF");
    expect(mocks.overview).toHaveBeenCalledTimes(1);
    const expenses=(await render("analyse-depenses")).replace(/\s/g," ");
    expect(expenses).toContain("Charges brutes de la saison");expect(expenses).toContain("Crédit d’économie DF");
    expect(expenses.indexOf("Charges brutes de la saison")).toBeLessThan(expenses.indexOf("Crédit d’économie DF"));
  });
  it("shows settled tours and one-day races only in history while keeping past-due pending receipts to come",async()=>{
    mocks.overview.mockResolvedValue(treasuryFixture());
    const html=await render();
    const upcoming=ledgerSection(html,"operations-a-venir");
    const history=ledgerSection(html,"historique-financier");
    expect(upcoming).toMatch(/^<details[^>]*open=""/);
    expect(history.slice(0,history.indexOf(">"))).not.toContain("open=");
    for(const description of ["Tour terminé — Étape 4","Tour terminé — Classement général","Course d’un jour — Victoire","Salaire déjà payé"]) {
      expect(history).toContain(description);expect(upcoming).not.toContain(description);
    }
    expect(upcoming).toContain("Prime ancienne non versée");
    expect(upcoming).toContain("J2 · Prime de course · À recevoir · non encaissé");
    expect(history).not.toContain("Prime ancienne non versée");
    expect(textContent(history)).toContain("Déjà encaissé · inclus dans le solde");
    expect(html).not.toContain("Prime annulée");expect(html).not.toContain("Charge annulée");
    expect(metric(html,"Encore à recevoir")).toContain("Encore à recevoir130 €");
    expect(metric(html,"Encore à payer")).toContain("Encore à payer40 €");
    expect(metric(html,"Solde de fin de saison estimé")).toContain("Solde de fin de saison estimé1 240 €");
    expect(textContent(history)).toContain("Encaissé · +180 €");
    expect(textContent(history)).toContain("Payé · −30 €");
    const allText=textContent(html);
    expect(allText).toContain("Recettes · encaissé + à recevoir310 €");
    expect(allText).toContain("Dépenses brutes · payé + à payer70 €");
    expect(allText).not.toContain("Gains prévus");
    expect(mocks.overview).toHaveBeenCalledTimes(1);
  });
  it("moves a receipt into cash and history without increasing the annual total or counting it again in the forecast",async()=>{
    const before=treasuryFixture();
    const after:TeamFinanceOverview={...before,balance:1200,transactions:before.transactions.map(row=>row.id==="late-income"?{...row,status:"posted",postedAt:"2026-10-27T12:00:00Z"}:row)};
    mocks.overview.mockResolvedValue(before);
    const beforeHtml=await render();
    mocks.overview.mockResolvedValue(after);
    const afterHtml=await render();
    expect(metric(beforeHtml,"Encore à recevoir")).toContain("130 €");
    expect(metric(afterHtml,"Encore à recevoir")).toContain("80 €");
    expect(textContent(beforeHtml)).toContain("Solde disponible · J121 150 €");
    expect(textContent(afterHtml)).toContain("Solde disponible · J121 200 €");
    expect(textContent(ledgerSection(beforeHtml,"historique-financier"))).toContain("Encaissé · +180 €");
    expect(textContent(ledgerSection(afterHtml,"historique-financier"))).toContain("Encaissé · +230 €");
    expect(ledgerSection(afterHtml,"operations-a-venir")).not.toContain("Prime ancienne non versée");
    expect(ledgerSection(afterHtml,"historique-financier")).toContain("Prime ancienne non versée");
    for(const html of [beforeHtml,afterHtml]) {
      expect(metric(html,"Solde de fin de saison estimé")).toContain("1 240 €");
      expect(textContent(html)).toContain("Recettes · encaissé + à recevoir310 €");
      expect(textContent(html)).toContain("Dépenses brutes · payé + à payer70 €");
    }
    expect(before.balance+130-40).toBe(before.projectedBalance);
    expect(after.balance+80-40).toBe(after.projectedBalance);
    expect(mocks.overview).toHaveBeenCalledTimes(2);
  });
});
